# No Prisma yet (DB not set up): when it is, re-add `npx prisma generate` to the build and copy node_modules/.prisma + prisma/ to runtime.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist dist
USER node
EXPOSE 3001
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3001/healthz >/dev/null || exit 1
# worker: same image, override with `node dist/worker.js`
CMD ["node", "dist/main.js"]
