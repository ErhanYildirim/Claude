// Task #147 — WebSocket /ws/esg-canvas/:graphId: çok kullanıcılı canvas işbirliği
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket }          from "@fastify/websocket";
import { prisma }                   from "@voltfox/db";

// ── Renk paleti (userId hash ile deterministik renk) ──────────────────────────
const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// ── Veri yapıları ─────────────────────────────────────────────────────────────

interface Peer {
  socket:      WebSocket;
  userId:      string;
  name:        string;
  color:       string;
  lockedNodes: Set<string>;
}

interface CommentPin {
  id:        string;
  userId:    string;
  name:      string;
  nodeId:    string | null;
  x:         number;
  y:         number;
  text:      string;
  createdAt: string;
}

// graphId → peers map
const rooms    = new Map<string, Map<string, Peer>>();
// graphId → ephemeral comment pins (max 50)
const comments = new Map<string, CommentPin[]>();

function getRoom(graphId: string): Map<string, Peer> {
  if (!rooms.has(graphId)) rooms.set(graphId, new Map());
  return rooms.get(graphId)!;
}

function getComments(graphId: string): CommentPin[] {
  if (!comments.has(graphId)) comments.set(graphId, []);
  return comments.get(graphId)!;
}

function safeSend(ws: WebSocket, msg: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(graphId: string, msg: unknown, excludeUserId?: string) {
  const room = rooms.get(graphId);
  if (!room) return;
  for (const peer of room.values()) {
    if (peer.userId === excludeUserId) continue;
    safeSend(peer.socket, msg);
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const wsCanvasRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/ws/esg-canvas/:graphId",
    { websocket: true, config: { public: true } },
    async (socket, request) => {
      const { graphId } = request.params as { graphId: string };
      const query       = request.query as Record<string, string>;
      const token       = query.token;
      const displayName = (query.name ?? "Anonim").slice(0, 40);

      // ── Kimlik doğrulama ─────────────────────────────────────────────────
      let userId = "anon-" + crypto.randomUUID().slice(0, 8);

      if (token && app.hasDecorator("supabase")) {
        const { data: { user }, error } = await app.supabase.auth.getUser(token);
        if (error || !user) {
          safeSend(socket, { type: "error", code: "UNAUTHORIZED", message: "Geçersiz token" });
          socket.close(1008, "Unauthorized");
          return;
        }
        userId = user.id;

        // Tenant isolation — graph bu tenant'a ait mi?
        const tenantMember = await prisma.tenantMember.findFirst({
          where:  { userId },
          select: { tenantId: true },
        });

        if (tenantMember) {
          const graph = await (prisma as unknown as { esgPlaygroundGraph: { findFirst: (args: unknown) => Promise<unknown> } })
            .esgPlaygroundGraph.findFirst({
              where: { id: graphId, tenantId: tenantMember.tenantId },
            });
          if (!graph) {
            safeSend(socket, { type: "error", code: "FORBIDDEN", message: "Canvas bulunamadı veya erişim reddedildi" });
            socket.close(1008, "Forbidden");
            return;
          }
        }
      }

      const color = userColor(userId);
      const room  = getRoom(graphId);

      // Aynı userId zaten bağlıysa eski bağlantıyı kapat
      const existing = room.get(userId);
      if (existing) {
        existing.socket.close(1000, "Replaced by new connection");
        room.delete(userId);
      }

      const peer: Peer = { socket, userId, name: displayName, color, lockedNodes: new Set() };
      room.set(userId, peer);

      // ── Karşılama — mevcut peers + comment pins gönder ───────────────────
      const peersArr = [...room.values()]
        .filter(p => p.userId !== userId)
        .map(p => ({ userId: p.userId, name: p.name, color: p.color }));

      safeSend(socket, {
        type:     "welcome",
        userId,
        name:     displayName,
        color,
        peers:    peersArr,
        comments: getComments(graphId),
      });

      // Diğerlerine katılım bildir
      broadcast(graphId, { type: "join", userId, name: displayName, color }, userId);

      // ── İstemci mesajları ─────────────────────────────────────────────────
      socket.on("message", (raw: Buffer | string) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(raw.toString()); }
        catch { return; }

        switch (msg.type) {

          case "ping":
            safeSend(socket, { type: "pong", ts: new Date().toISOString() });
            break;

          case "cursor":
            broadcast(graphId, {
              type: "cursor",
              userId, name: displayName, color,
              x: msg.x, y: msg.y,
            }, userId);
            break;

          case "lock": {
            const nodeId = String(msg.nodeId ?? "");
            if (!nodeId) break;
            // Başka biri kilitlemişse reddet
            const locker = [...room.values()].find(p => p.lockedNodes.has(nodeId) && p.userId !== userId);
            if (locker) {
              safeSend(socket, { type: "lock_denied", nodeId, lockedBy: locker.userId, lockedByName: locker.name });
              break;
            }
            peer.lockedNodes.add(nodeId);
            broadcast(graphId, { type: "lock", userId, nodeId }, userId);
            break;
          }

          case "unlock": {
            const nodeId = String(msg.nodeId ?? "");
            if (!nodeId) break;
            peer.lockedNodes.delete(nodeId);
            broadcast(graphId, { type: "unlock", userId, nodeId }, userId);
            break;
          }

          case "comment": {
            const text = String(msg.text ?? "").slice(0, 500).trim();
            if (!text) break;
            const pin: CommentPin = {
              id:        crypto.randomUUID(),
              userId,
              name:      displayName,
              nodeId:    typeof msg.nodeId === "string" ? msg.nodeId : null,
              x:         typeof msg.x === "number" ? msg.x : 0,
              y:         typeof msg.y === "number" ? msg.y : 0,
              text,
              createdAt: new Date().toISOString(),
            };
            const pins = getComments(graphId);
            pins.push(pin);
            if (pins.length > 50) pins.splice(0, pins.length - 50); // en fazla 50
            broadcast(graphId, { type: "comment", ...pin });         // kendine de gönder
            safeSend(socket, { type: "comment", ...pin });
            break;
          }
        }
      });

      // ── Temizle ──────────────────────────────────────────────────────────
      function cleanup() {
        // Bu peer'in kilitlediği nodeları serbest bırak
        for (const nodeId of peer.lockedNodes) {
          broadcast(graphId, { type: "unlock", userId, nodeId }, userId);
        }
        peer.lockedNodes.clear();
        room.delete(userId);
        broadcast(graphId, { type: "leave", userId });
        if (room.size === 0) {
          rooms.delete(graphId);
          comments.delete(graphId); // oda boşsa yorumları da temizle
        }
      }

      socket.on("close",  cleanup);
      socket.on("error", (err: Error) => {
        app.log.warn({ err, graphId, userId }, "[WS Canvas] Socket hatası");
        cleanup();
      });
    },
  );
};
