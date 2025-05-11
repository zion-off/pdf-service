FROM node:18 AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY *.ts ./

RUN npm run build

FROM ghcr.io/puppeteer/puppeteer:22.12.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3000

WORKDIR /usr/src/app

COPY --from=builder /build/package*.json ./
COPY --from=builder /build/node_modules ./node_modules/

COPY --from=builder /build/dist/ ./dist/
COPY extension/ ./dist/extension/

EXPOSE 3000

CMD ["node", "dist/index.js"]