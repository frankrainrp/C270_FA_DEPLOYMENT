# Owner: Kaiduo - DevOps Architecture and CI/CD Integration
FROM node:24-alpine

WORKDIR /usr/src/app

LABEL org.opencontainers.image.source="https://github.com/frankrainrp/C270_FA_DEPLOYMENT"

COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

EXPOSE 3000 9090
ENV PORT=3000
ENV METRICS_PORT=9090
ENV NODE_ENV=production

USER node

CMD ["node", "src/app.js"]
