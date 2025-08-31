# ===== build =====
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm i --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY knexfile.ts ./knexfile.ts
RUN pnpm build


# ===== runtime =====
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/knexfile.ts ./knexfile.ts
# uploads dir
RUN mkdir -p /data/uploads
ENV UPLOADS_DIR=/data/uploads
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/server.js"]