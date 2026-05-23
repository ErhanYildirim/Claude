import fp from "fastify-plugin";
import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

const requestIdPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("requestId", "");

  app.addHook("onRequest", async (request) => {
    // Client'tan gelen ID'yi al, yoksa üret
    const incoming = request.headers["x-request-id"];
    request.requestId = (typeof incoming === "string" && incoming.length > 0 && incoming.length <= 64)
      ? incoming
      : randomUUID();
  });

  // Response'a request ID'yi ekle (istemci loglama için)
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.requestId);
  });
};

export default fp(requestIdPlugin, { name: "request-id" });
