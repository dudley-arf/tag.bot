FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install

COPY . .
RUN bun install --production

FROM oven/bun:alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app .

CMD ["bun", "index.ts"]
