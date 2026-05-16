# ── Build aşaması ─────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Bağımlılıkları önce kopyala (layer cache)
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN npm ci --workspace=apps/api --workspace=packages/db --include-workspace-root

# Kaynak kodları kopyala
COPY tsconfig.base.json ./
COPY apps/api/ ./apps/api/
COPY packages/db/ ./packages/db/
COPY src/ ./src/
COPY cbam-defaults.json ./

# Prisma client üret + TypeScript derle
RUN npx prisma generate --schema=packages/db/schema.prisma
RUN npm run build --workspace=apps/api

# ── Runtime aşaması ───────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Güvenlik: root olmayan kullanıcı
RUN addgroup --system voltfox && adduser --system --ingroup voltfox voltfox

# Sadece üretim bağımlılıklarını yükle
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN npm ci --workspace=apps/api --workspace=packages/db --include-workspace-root --omit=dev

# Build çıktısı ve statik veriler
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY cbam-defaults.json ./

USER voltfox

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/src/server.js"]
