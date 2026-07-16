# Stage 1: Сборка фронтенда React + Vite
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Запуск бэкенда Node.js и раздача собранной статики
FROM node:20-alpine
WORKDIR /app/backend

# Установка зависимостей бэкенда (только production)
COPY backend/package*.json ./
RUN npm install --omit=dev

# Копирование исходного кода бэкенда
COPY backend/ ./

# Копирование собранного фронтенда в директорию, откуда бэкенд раздает статику
COPY --from=frontend-builder /app/frontend/dist ./dist

# Создание папки для персистентной базы данных SQLite
RUN mkdir -p /app/data

# Переменные окружения по умолчанию
ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_PATH=/app/data/finance.db

EXPOSE 5000

# Запуск приложения
CMD ["node", "src/index.js"]
