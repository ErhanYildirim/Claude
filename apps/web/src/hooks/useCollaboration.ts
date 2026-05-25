import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

export interface RemoteCursor {
  userId:  string;
  name:    string;
  color:   string;
  x:       number;
  y:       number;
}

export interface RemotePeer {
  userId: string;
  name:   string;
  color:  string;
}

export interface CommentPin {
  id:        string;
  userId:    string;
  name:      string;
  nodeId:    string | null;
  x:         number;
  y:         number;
  text:      string;
  createdAt: string;
}

interface UseCollaborationReturn {
  connected:    boolean;
  peers:        RemotePeer[];
  cursors:      Map<string, RemoteCursor>;
  lockedNodes:  Map<string, { userId: string; name: string; color: string }>;
  comments:     CommentPin[];
  myUserId:     string | null;
  myColor:      string | null;
  sendCursor:   (x: number, y: number) => void;
  lockNode:     (nodeId: string) => void;
  unlockNode:   (nodeId: string) => void;
  addComment:   (x: number, y: number, text: string, nodeId?: string) => void;
}

const WS_BASE = (() => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/v1`;
})();

const CURSOR_THROTTLE_MS = 80;

export function useCollaboration(graphId: string | undefined, enabled: boolean): UseCollaborationReturn {
  const wsRef             = useRef<WebSocket | null>(null);
  const [connected, setConnected]   = useState(false);
  const [peers,     setPeers]       = useState<RemotePeer[]>([]);
  const [cursors,   setCursors]     = useState<Map<string, RemoteCursor>>(new Map());
  const [lockedNodes, setLockedNodes] = useState<Map<string, { userId: string; name: string; color: string }>>(new Map());
  const [comments,  setComments]    = useState<CommentPin[]>([]);
  const [myUserId,  setMyUserId]    = useState<string | null>(null);
  const [myColor,   setMyColor]     = useState<string | null>(null);
  const lastCursorRef = useRef<number>(0);

  useEffect(() => {
    if (!graphId || !enabled) return;

    let ws: WebSocket;
    let pingTimer: ReturnType<typeof setInterval>;
    let dead = false;

    async function connect() {
      const { data: { session } } = await supabase.auth.getSession();
      const token    = session?.access_token ?? "";
      const name     = encodeURIComponent(session?.user?.email?.split("@")[0] ?? "Kullanıcı");
      const url      = `${WS_BASE}/ws/esg-canvas/${graphId}?token=${token}&name=${name}`;

      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (dead) { ws.close(); return; }
        setConnected(true);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      };

      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingTimer);
        if (!dead) setTimeout(connect, 3000); // yeniden bağlan
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (evt) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(evt.data as string); }
        catch { return; }

        switch (msg.type) {

          case "welcome":
            setMyUserId(msg.userId as string);
            setMyColor(msg.color as string);
            setPeers((msg.peers as RemotePeer[]) ?? []);
            setComments((msg.comments as CommentPin[]) ?? []);
            break;

          case "join":
            setPeers(ps => [...ps.filter(p => p.userId !== msg.userId), {
              userId: msg.userId as string,
              name:   msg.name   as string,
              color:  msg.color  as string,
            }]);
            break;

          case "leave":
            setPeers(ps => ps.filter(p => p.userId !== msg.userId));
            setCursors(m => { const n = new Map(m); n.delete(msg.userId as string); return n; });
            setLockedNodes(m => {
              const n = new Map(m);
              for (const [nodeId, lock] of n) { if (lock.userId === msg.userId) n.delete(nodeId); }
              return n;
            });
            break;

          case "cursor":
            setCursors(m => new Map(m).set(msg.userId as string, {
              userId: msg.userId as string,
              name:   msg.name   as string,
              color:  msg.color  as string,
              x:      msg.x      as number,
              y:      msg.y      as number,
            }));
            break;

          case "lock":
            setLockedNodes(m => new Map(m).set(msg.nodeId as string, {
              userId: msg.userId as string,
              name:   "",  // will be enriched from peers
              color:  "",
            }));
            // Enrich from peer list
            setPeers(ps => {
              const peer = ps.find(p => p.userId === msg.userId);
              if (!peer) return ps;
              setLockedNodes(m => new Map(m).set(msg.nodeId as string, { userId: peer.userId, name: peer.name, color: peer.color }));
              return ps;
            });
            break;

          case "unlock":
            setLockedNodes(m => { const n = new Map(m); n.delete(msg.nodeId as string); return n; });
            break;

          case "comment":
            setComments(cs => {
              const exists = cs.find(c => c.id === (msg.id as string));
              if (exists) return cs;
              return [...cs, msg as unknown as CommentPin].slice(-50);
            });
            break;
        }
      };
    }

    connect();

    return () => {
      dead = true;
      clearInterval(pingTimer);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setConnected(false);
      setPeers([]);
      setCursors(new Map());
      setLockedNodes(new Map());
      setComments([]);
    };
  }, [graphId, enabled]);

  const sendCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorRef.current < CURSOR_THROTTLE_MS) return;
    lastCursorRef.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cursor", x, y }));
    }
  }, []);

  const lockNode = useCallback((nodeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "lock", nodeId }));
    }
  }, []);

  const unlockNode = useCallback((nodeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unlock", nodeId }));
    }
  }, []);

  const addComment = useCallback((x: number, y: number, text: string, nodeId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "comment", x, y, text, nodeId: nodeId ?? null }));
    }
  }, []);

  return { connected, peers, cursors, lockedNodes, comments, myUserId, myColor, sendCursor, lockNode, unlockNode, addComment };
}
