const WELCOME = '<b>2048</b>\nСвайпай плитки, одинаковые складываются. Собери 2048.';

// Добавляет имя бота в адрес мини-аппа, чтобы кнопка "Поделиться" знала, на кого ссылаться.
function webAppLink(base, botName) {
  const url = new URL(base);
  url.searchParams.set('bot', botName);
  return url.toString();
}

function createBot({ api, webAppUrl }) {
  const playButton = { inline_keyboard: [[{ text: 'Играть', web_app: { url: webAppUrl } }]] };

  async function handleUpdate(update) {
    if (update.callback_query) {
      // Кнопки от старой текстовой версии игры.
      return api('answerCallbackQuery', {
        callback_query_id: update.callback_query.id,
        text: 'Игра обновилась. Напиши /start',
      });
    }

    const msg = update.message;
    if (!msg || msg.chat.type !== 'private') return;

    return api('sendMessage', {
      chat_id: msg.chat.id,
      text: WELCOME,
      parse_mode: 'HTML',
      reply_markup: playButton,
    });
  }

  return { handleUpdate };
}

module.exports = { createBot, webAppLink };
