FROM node:24-alpine

WORKDIR /usr/src/app

LABEL org.opencontainers.image.source="https://github.com/HeinThuNyiNyi/butler-devops-CA2"

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

USER node

CMD ["node", "src/app.js"]
