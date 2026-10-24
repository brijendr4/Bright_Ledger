FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY blockchain/package.json blockchain/package.json
RUN npm ci

COPY . .

EXPOSE 5173 4000 8545
