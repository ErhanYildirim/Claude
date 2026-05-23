import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyError } from "fastify";

const isProd = process.env.NODE_ENV === "production";

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const requestId = (request as { requestId?: string }).requestId ?? request.id;
    const status    = error.statusCode ?? 500;

    // Validation hatalarını (Fastify schema) 400'e map et
    if (error.validation) {
      return reply.status(400).send({
        error:     "VALIDATION_ERROR",
        message:   "İstek verisi geçersiz.",
        details:   error.validation,
        requestId,
      });
    }

    // 5xx — structured log yaz, stack trace production'da gizle
    if (status >= 500) {
      app.log.error({
        err: {
          message: error.message,
          stack:   error.stack,
          code:    error.code,
        },
        requestId,
        method:  request.method,
        url:     request.url,
      }, "[Error] Sunucu hatası");
    }

    return reply.status(status).send({
      error:     error.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
      message:   status >= 500 && isProd
        ? "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin."
        : error.message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    const requestId = (request as { requestId?: string }).requestId ?? request.id;
    reply.status(404).send({
      error:     "NOT_FOUND",
      message:   `${request.method} ${request.url} bulunamadı.`,
      requestId,
    });
  });
};

export default fp(errorHandlerPlugin, { name: "error-handler" });
