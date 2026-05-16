# ── Build aşaması ─────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=apps/web --include-workspace-root

COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

# Build zamanı env değişkenleri (VITE_ prefix'li)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build --workspace=apps/web

# ── Runtime aşaması (nginx) ───────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA routing: 404'leri index.html'e yönlendir
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost/health || exit 1
