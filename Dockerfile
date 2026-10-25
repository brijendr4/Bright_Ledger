FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY blockchain/package.json blockchain/package.json
RUN npm ci

COPY . .

RUN npm run build:backend

ENV NODE_ENV=production

EXPOSE 4000

CMD ["npm", "run", "start:backend"]
