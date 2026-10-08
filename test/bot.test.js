const test = require('node:test');
const assert = require('node:assert/strict');
const { createBot, webAppLink } = require('../src/bot');

const URL_ = 'https://example.github.io/2048/?bot=test_bot';

function setup() {
  const calls = [];
  const api = async (method, params) => {
    calls.push({ method, params });
    return { message_id: 1 };
  };
  return { bot: createBot({ api, webAppUrl: URL_ }), calls };
}

const message = (text, type = 'private') => ({
  update_id: 1,
  message: { message_id: 1, chat: { id: 10, type }, from: { id: 1 }, text },
});

test('/start answers with a button that opens the mini app', async () => {
  const { bot, calls } = setup();
  await bot.handleUpdate(message('/start'));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'sendMessage');
  const button = calls[0].params.reply_markup.inline_keyboard[0][0];
  assert.equal(button.web_app.url, URL_);
});

test('any private message gets the same play button', async () => {
  const { bot, calls } = setup();
  await bot.handleUpdate(message('привет'));
  assert.equal(calls[0].params.reply_markup.inline_keyboard[0][0].text, 'Играть');
});

test('group messages are ignored, web_app buttons only work in private chats', async () => {
  const { bot, calls } = setup();
  await bot.handleUpdate(message('/start', 'group'));
  assert.equal(calls.length, 0);
});

test('buttons from the old text version get a short answer', async () => {
  const { bot, calls } = setup();
  await bot.handleUpdate({ update_id: 2, callback_query: { id: 'q', from: { id: 1 }, data: 'm:left' } });
  assert.equal(calls[0].method, 'answerCallbackQuery');
  assert.equal(calls[0].params.callback_query_id, 'q');
});

test('webAppLink adds the bot name to the url', () => {
  assert.equal(webAppLink('https://a.github.io/2048/', 'gameEZZ_bot'), 'https://a.github.io/2048/?bot=gameEZZ_bot');
  assert.equal(webAppLink('https://a.github.io/2048/?v=2', 'x_bot'), 'https://a.github.io/2048/?v=2&bot=x_bot');
});
