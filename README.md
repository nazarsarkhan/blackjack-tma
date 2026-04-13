# Blackjack TMA Backend

Backend для Telegram Mini App с игрой в блэкджек.

## Что реализовано

- SQLite схема `users`, `games`, `transactions`
- Виртуальный баланс со стартовым значением
- История игр, транзакции и агрегированная статистика
- Интеграция баланса в игровой backend

## Запуск

```bash
npm install
npm run init-db
npm start
```

База по умолчанию создаётся в `data/blackjack.sqlite`.

## API

- `POST /api/users`
- `GET /api/users/:telegramId`
- `GET /api/users/:telegramId/balance`
- `GET /api/users/:telegramId/games`
- `GET /api/users/:telegramId/transactions`
- `GET /api/users/:telegramId/stats`

## Логика баланса

- Новый игрок получает `STARTING_BALANCE`
- При завершении раунда игра записывается в `games`
- В `transactions` создаются записи `bet` и `payout`
- Если баланса не хватает, новый раунд и `double` отклоняются
