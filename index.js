const fs = require('node:fs');
const path = require('node:path');
const { createBot, webAppLink } = require('./src/bot');

const root = __dirname;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

loadEnv(path.join(root, '.env'));

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Не задан BOT_TOKEN. Положи его в файл .env');
  process.exit(1);
}

const webAppBase = process.env.WEBAPP_URL || '';
if (!webAppBase.startsWith('https://')) {
  console.error('Не задан WEBAPP_URL. Нужен https-адрес, где лежит папка webapp');
  process.exit(1);
}

const base = `https://api.telegram.org/bot${token}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, params = {}) {
  const res = await fetch(`${base}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(`${method}: ${data.description}`);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

async function main() {
  const me = await api('getMe');
  console.log(`Бот @${me.username} запущен`);

  const webAppUrl = webAppLink(webAppBase, me.username);

  await api('setMyCommands', { commands: [{ command: 'start', description: 'Открыть игру' }] });
  await api('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Играть', web_app: { url: webAppUrl } },
  });
  console.log(`Мини-апп: ${webAppUrl}`);

  const bot = createBot({ api, webAppUrl });

  let offset = 0;
  for (;;) {
    let updates;
    try {
      updates = await api('getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message', 'callback_query'],
      });
    } catch (err) {
      console.error('getUpdates:', err.message);
      await sleep(3000);
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      try {
        await bot.handleUpdate(update);
      } catch (err) {
        console.error(`update ${update.update_id}:`, err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
