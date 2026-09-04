FROM node:22-bookworm-slim

WORKDIR /app

# openssl é exigido pelo engine do Prisma; build-essential/python3 cobrem
# qualquer dependência nativa (bcrypt etc.) que precise compilar no install.
# chromium é o motor de PDF do Relatório da Análise Financeira
# (financial-report-pdf.service.ts, via puppeteer-core apontando pro
# binário do sistema — não o Chromium embutido do puppeteer completo, mais
# leve e mais confiável de instalar via apt numa imagem Debian).
# fonts-crosextra-carlito: sem isso, a stack de fontes do relatório
# ('Aptos','Calibri','Segoe UI',Arial — todas proprietárias da Microsoft,
# nenhuma existe no Debian) caía inteira no fallback genérico "sans-serif",
# que essa imagem resolve pra DejaVu Sans — visivelmente mais larga que
# Calibri. Como a régua de coluna do relatório (financial-report-html.
# service.ts) foi calibrada medindo texto em Calibri real (no navegador),
# o PDF gerado no container link estourava a coluna e quebrava linha onde
# a prévia não quebrava. Carlito é metricamente compatível com Calibri
# (mesmas larguras de caractere) — corrige a divergência preview↔PDF sem
# precisar recalibrar a régua.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 build-essential chromium fonts-crosextra-carlito \
  && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

EXPOSE 3002

# O código-fonte real vem do bind mount (docker-compose.yml) — não é
# copiado na imagem. Isso permite editar arquivos no host (Windows) e só
# precisar de "docker compose restart backend" para aplicar, sem rebuild
# de imagem, exceto quando package.json muda.
#
# A cada start: regenera o client do Prisma (barato, garante que bate com
# o schema atual do bind mount), aplica migrações pendentes, compila
# (nest build, sem --watch — watch mode vazava memória/handles quando
# rodado em background) e sobe a build compilada.
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx nest build && node dist/main.js"]
