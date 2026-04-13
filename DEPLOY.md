# Deploy

## Локальная проверка

```bash
npm test
docker compose config
```

## Запуск на VPS

1. Установить Docker Engine и Docker Compose Plugin.
2. Скопировать проект на сервер.
3. Создать `.env` на основе `.env.example`.
4. Запустить:

```bash
docker compose up -d --build
```

## Обновление

```bash
git pull
docker compose up -d --build
```

## Что делает конфиг

- Поднимает production-контейнер Node.js на порту `3000`
- Добавляет `healthcheck` по `GET /health`
- Подключает volume `blackjack_data` для SQLite-файла
- Перезапускает сервис автоматически через `restart: unless-stopped`
