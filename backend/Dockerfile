# Método FAL — API NestJS (produção)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 build-essential \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json nest-cli.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npx nest build

# Runner: precisa de chromium + fonte Carlito porque o Relatório da Análise
# Financeira (financial-report-pdf.service.ts) usa puppeteer-core apontando
# pro binário do sistema (mais leve/confiável via apt numa imagem Debian do
# que o Chromium embutido do puppeteer completo). fonts-crosextra-carlito é
# metricamente compatível com Calibri (mesma largura de caractere) — sem
# ela, o container cai no fallback DejaVu Sans, mais largo, e o PDF gerado
# quebra linha onde a prévia (calibrada medindo Calibri real no navegador)
# não quebra.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl wget chromium fonts-crosextra-carlito \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system fal \
  && useradd --system --gid fal --create-home fal
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && chown -R fal:fal /app
USER fal
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=10 --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
