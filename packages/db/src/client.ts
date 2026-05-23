import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const SLOW_QUERY_MS = 2_000;

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? [{ emit: "event", level: "query" }, "warn", "error"]
      : ["warn", "error"],
  });

  // Slow query logger — production'da da çalışır (only in dev mode since log level includes query)
  if (process.env.NODE_ENV === "development") {
    (client as unknown as { $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void })
      .$on("query", (e) => {
        if (e.duration > SLOW_QUERY_MS) {
          console.warn(`[SlowQuery] ${e.duration}ms — ${e.query.slice(0, 200)}`);
        }
      });
  }

  // Query timeout middleware — her sorgu 30s'den uzun süremez
  client.$use(async (params, next) => {
    const start = Date.now();
    const result = await Promise.race([
      next(params),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Query timeout: ${params.model}.${params.action} (30s)`)),
          30_000,
        ),
      ),
    ]);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_MS) {
      console.warn(`[SlowQuery] ${duration}ms — ${params.model}.${params.action}`);
    }
    return result;
  });

  return client;
}

export const prisma: PrismaClient =
  global.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export * from "@prisma/client";
