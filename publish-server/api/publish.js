/* ==========================================================================
   ПУБЛИКАЦИЯ КАТАЛОГА «ФИНВЫБОР» (maeb-fin.ru) ИЗ АДМИНКИ.

   Живёт на Vercel. Сайт — статика на GitHub Pages, поэтому «Сохранить
   на сайт» работает так: функция проверяет пароль админки, выдаёт токен
   на 30 дней и по команде публикации коммитит data.js прямо в репозиторий
   Daviddavidso/nester-pp — GitHub Pages пересобирает сайт за минуту-другую.

   Секретов в коде нет:
   — эталон пароля — файл .admin-pass в публичном репозитории
     (sha256 от соли и пароля, сам пароль из него не восстановить);
   — ключ подписи токенов выводится из GH_TOKEN;
   — GH_TOKEN лежит в Environment Variables проекта: fine-grained personal
     access token с доступом ТОЛЬКО к репозиторию Daviddavidso/nester-pp
     и правом Contents: Read and write. Пока переменной нет, вход работает,
     а сохранение вежливо отказывает — ничего не ломается.

   Протокол тот же, что был у api.php в репозитории (state / login /
   logout / publish / rollback / zip), только вместо cookie — токен
   в теле запроса: cookie между choice7.ru и vercel.app не ходят.
   ========================================================================== */

'use strict';

const crypto = require('crypto');

const REPO   = 'Daviddavidso/nester-pp';
const BRANCH = 'main';
const FILE   = 'data.js';
const SALT   = 'maeb-v1-3c36f8';

const LIFETIME  = 30 * 24 * 60 * 60 * 1000; // 30 дней — как было у api.php
const MAX_BYTES = 8 * 1024 * 1024;
/* Куски, без которых присланный файл считается битым: защита от того,
   чтобы на сайт уехала пустышка или чужой текст. */
const NEEDLES = ['const OFFERS', 'const BRAND'];

const ORIGINS = [
  'https://maeb-fin.ru',
  'https://www.maeb-fin.ru',
  'http://maeb-fin.ru',
  'http://www.maeb-fin.ru',
  'https://daviddavidso.github.io',
  'http://localhost:4700',
  'http://127.0.0.1:4700'
];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* Ключ подписи токенов. Известен только этой функции: выводится из GH_TOKEN,
   которого нет ни в коде, ни в репозитории. До настройки переменной публикация
   всё равно выключена, так что слабый запасной ключ ничем не рискует. */
function signKey() {
  return sha('maeb-sign:' + (process.env.GH_TOKEN || 'unconfigured'));
}
const hmac = (s) => crypto.createHmac('sha256', signKey()).update(s).digest('hex');

/* Эталон пароля — .admin-pass из репозитория (он и раньше там лежал). */
let passCache = { value: '', at: 0 };
async function passHash() {
  if (passCache.value && Date.now() - passCache.at < 10 * 60 * 1000) return passCache.value;
  const r = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/.admin-pass',
    { headers: { 'User-Agent': 'maeb-publish' } });
  if (!r.ok) throw new Error('Не удалось прочитать эталон пароля (' + r.status + ').');
  const v = (await r.text()).trim();
  if (!/^[0-9a-f]{64}$/.test(v)) throw new Error('Эталон пароля повреждён.');
  passCache = { value: v, at: Date.now() };
  return v;
}

function makeToken() {
  const exp = Date.now() + LIFETIME;
  return exp + '.' + hmac(String(exp));
}

function tokenOk(t) {
  if (typeof t !== 'string') return false;
  const i = t.indexOf('.');
  if (i < 1) return false;
  const exp = t.slice(0, i);
  const sig = t.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = hmac(exp);
  if (sig.length !== want.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(want, 'hex')); }
  catch (e) { return false; }
}

async function passOk(p) {
  const a = Buffer.from(sha(SALT + String(p || '')));
  const b = Buffer.from(await passHash());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function gh(path, init) {
  const headers = Object.assign({
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'maeb-publish',
    'X-GitHub-Api-Version': '2022-11-28'
  }, (init && init.headers) || {});
  if (process.env.GH_TOKEN) headers['Authorization'] = 'Bearer ' + process.env.GH_TOKEN;
  return fetch('https://api.github.com' + path, Object.assign({}, init, { headers: headers }));
}

/* «Последнее сохранение» — дата последнего коммита, трогавшего data.js. */
async function lastPublished() {
  try {
    const r = await gh('/repos/' + REPO + '/commits?path=' + FILE + '&sha=' + BRANCH + '&per_page=1');
    if (!r.ok) return { at: null, hash: null };
    const list = await r.json();
    const c = Array.isArray(list) && list[0];
    return { at: c ? (c.commit.committer.date || c.commit.author.date) : null, hash: null };
  } catch (e) { return { at: null, hash: null }; }
}

async function currentSha() {
  const r = await gh('/repos/' + REPO + '/contents/' + FILE + '?ref=' + BRANCH);
  if (!r.ok) throw new Error('GitHub не отдал текущий файл (' + r.status + ').');
  return (await r.json()).sha;
}

async function putFile(content, message) {
  const prev = await currentSha();
  const r = await gh('/repos/' + REPO + '/contents/' + FILE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      branch: BRANCH,
      sha: prev,
      content: Buffer.from(content, 'utf8').toString('base64'),
      committer: { name: 'Админка ВЫБОР', email: 'admin@choice7.ru' }
    })
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error('GitHub не принял файл (' + r.status + '): ' + (d.message || '').slice(0, 100));
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ORIGINS.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const out = (code, data) => { res.statusCode = code; res.end(JSON.stringify(data)); };

  if (req.method !== 'POST') return out(405, { ok: false, error: 'Только POST.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') body = {};
  const action = String(body.action || '');
  const authed = tokenOk(body.token);

  try {
    if (action === 'state') {
      return out(200, { ok: true, auth: authed, published: await lastPublished() });
    }

    if (action === 'login') {
      if (!(await passOk(body.password))) {
        return out(401, { ok: false, error: 'Пароль не подошёл. Проверьте раскладку и заглавные буквы.' });
      }
      return out(200, { ok: true, auth: true, token: makeToken(), published: await lastPublished() });
    }

    if (action === 'logout') return out(200, { ok: true, auth: false });

    if (!authed) return out(401, { ok: false, error: 'Нужно войти заново.', auth: false });

    if (action === 'zip') {
      /* Репозиторий публичный — архив отдаёт сам GitHub, собирать нечего. */
      return out(200, { ok: true, url: 'https://codeload.github.com/' + REPO + '/zip/refs/heads/' + BRANCH });
    }

    if (action === 'publish' || action === 'rollback') {
      if (!process.env.GH_TOKEN) {
        return out(503, { ok: false, error: 'Сохранение ещё подключается, попробуйте чуть позже. Правки на месте, ничего не потерялось.' });
      }

      let data;
      if (action === 'rollback') {
        const r = await gh('/repos/' + REPO + '/commits?path=' + FILE + '&sha=' + BRANCH + '&per_page=2');
        if (!r.ok) throw new Error('GitHub не отдал историю (' + r.status + ').');
        const list = await r.json();
        if (!Array.isArray(list) || list.length < 2) {
          return out(409, { ok: false, error: 'Предыдущей версии нет — откатывать не к чему.' });
        }
        const raw = await gh('/repos/' + REPO + '/contents/' + FILE + '?ref=' + list[1].sha,
          { headers: { 'Accept': 'application/vnd.github.raw' } });
        if (!raw.ok) throw new Error('GitHub не отдал прежнюю версию (' + raw.status + ').');
        data = await raw.text();
        await putFile(data, 'Каталог: возврат предыдущей версии из админки');
      } else {
        data = String(body.data || '');
        if (!data) return out(400, { ok: false, error: 'Пустые данные — публиковать нечего.' });
        if (Buffer.byteLength(data, 'utf8') > MAX_BYTES) {
          return out(413, { ok: false, error: 'Слишком много данных: скорее всего, дело в тяжёлой картинке. Уменьшите её и попробуйте снова.' });
        }
        for (const n of NEEDLES) {
          if (data.indexOf(n) === -1) {
            return out(400, { ok: false, error: 'Файл собран неправильно: не хватает блока «' + n + '».' });
          }
        }
        if (data.indexOf('<?') !== -1) return out(400, { ok: false, error: 'В данных недопустимый фрагмент кода.' });
        await putFile(data, 'Каталог: публикация из админки');
      }
      return out(200, { ok: true, published: { at: new Date().toISOString(), hash: sha(data) } });
    }

    return out(400, { ok: false, error: 'Неизвестная команда.' });
  } catch (e) {
    return out(500, { ok: false, error: String((e && e.message) || 'Ошибка на сервере.').slice(0, 180) });
  }
};
