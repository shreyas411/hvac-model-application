FROM node:25-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:25-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/prisma prisma
COPY --from=build /app/dist dist
USER node
EXPOSE 3001
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3001/healthz >/dev/null || exit 1
# worker: same image, override with `node dist/worker.js`
CMD ["node", "dist/main.js"]
