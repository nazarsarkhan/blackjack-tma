# Telegram Mini App — Blackjack

## Проект
Телеграм мини-апп с игрой Блэкджек. Стандартные казино правила с house edge.

## Архитектура
- Backend: Node.js + Express + WebSocket
- Frontend: React + Telegram Web App SDK
- Database: SQLite (баланс пользователей, история игр)
- Deploy: готово к запуску на VPS

## House Edge (стандартные казино правила)
- Дилер бьёт до мягких 17
- Блэкджек платит 3:2
- Дилер выигрывает при равном bust
- Нет surrender

## Задачи агентов

### Агент 1 — Backend + игровая логика
- Игровой движок (колода, раздача, подсчёт очков)
- REST API + WebSocket сервер
- Управление сессиями игры

### Агент 2 — Frontend
- Telegram Mini App на React
- Красивый UI: стол, карты с анимацией
- Интеграция с Telegram Web App SDK

### Агент 3 — База данных и баланс
- SQLite схема (users, games, transactions)
- Система виртуального баланса
- История игр и статистика

### Агент 4 — Тесты и деплой
- Тесты игровой логики
- Docker конфиг
- Инструкция по деплою
