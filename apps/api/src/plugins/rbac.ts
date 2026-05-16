import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@voltfox/db";

// Rol hiyerarşisi: owner > admin > analyst > viewer
export const ROLE_RANK: Record<string, number> = {
  viewer:  1,
  analyst: 2,
  admin:   3,
  owner:   4,
};

// userId yoksa (dev bypass) rol kontrolü atla
export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  minRole: "viewer" | "analyst" | "admin" | "owner",
): Promise<boolean> {
  if (!request.userId) return true; // dev bypass — X-Tenant-ID ile gelen istekler

  const member = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
    select: { role: true },
  });

  if (!member) {
    reply.status(403).send({ error: "FORBIDDEN", message: "Bu tenant'a erişim yetkiniz yok." });
    return false;
  }

  const userRank = ROLE_RANK[member.role] ?? 0;
  const minRank  = ROLE_RANK[minRole] ?? 999;

  if (userRank < minRank) {
    reply.status(403).send({
      error: "INSUFFICIENT_ROLE",
      message: `Bu işlem için en az '${minRole}' rolü gerekli. Mevcut rol: '${member.role}'.`,
    });
    return false;
  }

  return true;
}

// Kullanıcının rolünü döndür (yoksa null)
export async function getMemberRole(tenantId: string, userId: string): Promise<string | null> {
  const m = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  });
  return m?.role ?? null;
}
