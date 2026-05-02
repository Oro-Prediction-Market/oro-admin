# syntax=docker/dockerfile:1.7
#
# Oro admin dashboard — Vite SPA served by nginx.
# Built with Bun (works with yarn.lock or package-lock.json transparently).
#
#   docker build -t harbor.oro.fun/oro/admin:0.1.0 .

FROM oven/bun:1.3-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY bun.lock* yarn.lock* package-lock.json* ./
RUN bun install

COPY tsconfig*.json vite.config.ts index.html components.json ./
COPY public ./public
COPY src    ./src

ARG VITE_API_BASE_URL=https://api.oro.fun/admin
ARG VITE_API_URL=https://api.oro.fun
ARG VITE_WS_URL=wss://api.oro.fun
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_WS_URL=${VITE_WS_URL}
RUN bun run build

# ── runtime: nginx:alpine on :8080 ─────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
ENV NGINX_PORT=8080

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R 101:101 /var/cache/nginx /var/run /etc/nginx/conf.d /usr/share/nginx/html

USER 101
EXPOSE 8080
