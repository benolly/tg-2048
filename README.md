# 2048 в Telegram

Мини-апп с игрой 2048 и бот, который его открывает.

- `webapp/` страница игры: свайпы, анимации, цвета из темы Telegram, прогресс и рекорд в облаке Telegram. Лежит на GitHub Pages в ветке `gh-pages`.
- `index.js` бот: на любое сообщение отвечает кнопкой "Играть" и ставит кнопку меню рядом с полем ввода.

Сама игра работает без бота: кнопка меню хранится на стороне Telegram, а страница на GitHub Pages. Бот нужен только чтобы отвечать на `/start`.

## Бот

Нужен Node.js 18 или новее. Файл `.env`:

```
BOT_TOKEN=токен от BotFather
WEBAPP_URL=https://имя.github.io/tg-2048/
```

```bash
npm start
```

## Игра локально

```bash
npm run dev
```

Открыть http://localhost:5173. Без Telegram прогресс хранится в localStorage.

## Обновить страницу на GitHub Pages

Поменять `?v=` у файлов в `webapp/index.html`, чтобы Telegram не взял старую версию из кэша, закоммитить и выполнить:

```bash
git subtree push --prefix webapp origin gh-pages
```

## Тесты

```bash
npm test
```
