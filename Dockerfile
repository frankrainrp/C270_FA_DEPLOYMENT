FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=development

USER node

CMD ["node", "src/app.js"]
