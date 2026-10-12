#!/usr/bin/env node
/* =========================================================================
   Ключ публикации админки maeb-fin.ru.

   Админка сохраняет каталог прямо в репозиторий Daviddavidso/nester-pp
   через GitHub API. Для этого ей нужен токен GitHub — fine-grained,
   только на этот репозиторий, право Contents: Read and write.

   Токен лежит в publish-key.js в зашифрованном виде: AES-GCM, ключ
   выводится из пароля админки через PBKDF2-SHA256 (600 000 итераций).
   Пароль одновременно открывает админку и расшифровывает токен — без
   пароля из файла ничего не достать, а подобрать его перебором дорого.

   Пароль хранится локально в .pass-note (в git не попадает).

   Команды:
     node tools/publish-key.mjs token      вписать/заменить токен GitHub
     node tools/publish-key.mjs password   сменить пароль админки
     node tools/publish-key.mjs check      проверить, что ключ рабочий
     node tools/publish-key.mjs init       создать ключ без токена
                                           (вход работает, публикация — файлом)

   Токен вводится скрыто и никуда, кроме publish-key.js в зашифрованном
   виде, не пишется.
   ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_FILE = path.join(ROOT, 'publish-key.js');
const PASS_FILE = path.join(ROOT, '.pass-note');
const REPO = 'Daviddavidso/nester-pp';
const ITER = 600000;

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

async function deriveKey(password, salt, iter) {
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function seal(password, payload) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITER);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function open(password, box) {
  const key = await deriveKey(password, unb64(box.salt), box.iter);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return JSON.parse(dec.decode(pt));
}

function readBox() {
  if (!fs.existsSync(KEY_FILE)) return null;
  const m = /window\.PUBLISH_KEY\s*=\s*(\{[\s\S]*?\});/.exec(fs.readFileSync(KEY_FILE, 'utf8'));
  return m ? JSON.parse(m[1]) : null;
}

function writeBox(box) {
  const text =
    '/* Ключ публикации админки: токен GitHub, зашифрованный паролем админки\n' +
    '   (PBKDF2-SHA256 ' + box.iter + ' итераций + AES-GCM). Собирается командой\n' +
    '   node tools/publish-key.mjs — руками не править. */\n' +
    'window.PUBLISH_KEY = ' + JSON.stringify(box) + ';\n';
  fs.writeFileSync(KEY_FILE, text);
}

function readPass() {
  if (!fs.existsSync(PASS_FILE)) return '';
  const m = /^password:\s*(\S+)/m.exec(fs.readFileSync(PASS_FILE, 'utf8'));
  return m ? m[1] : '';
}

function writePass(pw) {
  fs.writeFileSync(PASS_FILE,
    'Пароль админки https://maeb-fin.ru/admin.html (он же расшифровывает ключ публикации).\n' +
    'Файл в .gitignore — в репозиторий не попадает.\n\n' +
    'password: ' + pw + '\n', { mode: 0o600 });
}

function newPassword() {
  /* Без похожих символов (0/o, 1/l/i), только строчные — клиенту проще вводить. */
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(bytes, (b) => abc[b % abc.length]).join('');
  return 'maeb-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
}

function ask(question, hidden) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (c) => { buf += c; });
      stdin.on('end', () => resolve(buf.split('\n')[0].trim()));
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value.trim());
          return;
        }
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') {
          if (value.length) { value = value.slice(0, -1); if (!hidden) process.stdout.write('\b \b'); }
          continue;
        }
        value += c;
        process.stdout.write(hidden ? '' : c);
      }
      if (hidden) process.stdout.write('\r' + question + '•'.repeat(Math.min(value.length, 40)) + ' (' + value.length + ')');
    };
    stdin.on('data', onData);
  });
}

async function checkToken(token) {
  const r = await fetch('https://api.github.com/repos/' + REPO, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'maeb-publish-key' }
  });
  if (r.status === 401) return { ok: false, why: 'GitHub не принял токен (401): опечатка, токен отозван или истёк.' };
  if (!r.ok) return { ok: false, why: 'GitHub ответил ' + r.status + ': у токена нет доступа к ' + REPO + '.' };
  const d = await r.json();
  if (!d.permissions || !d.permissions.push) {
    return { ok: false, why: 'Токен видит репозиторий, но писать в него не может. Нужно право Contents: Read and write.' };
  }
  return { ok: true, expires: r.headers.get('github-authentication-token-expiration') || 'без срока' };
}

async function main() {
  const cmd = process.argv[2] || 'check';

  if (cmd === 'init') {
    if (readBox()) { console.log('publish-key.js уже есть. Для смены пароля: password, для токена: token.'); return; }
    const pw = readPass() || newPassword();
    writePass(pw);
    writeBox(await seal(pw, { gh: '' }));
    console.log('Готово: ключ без токена. Пароль админки — в .pass-note.');
    return;
  }

  const pw = readPass();
  if (!pw) { console.error('Нет .pass-note с паролем админки. Сначала: node tools/publish-key.mjs init'); process.exit(1); }
  const box = readBox();
  let payload = { gh: '' };
  if (box) {
    try { payload = await open(pw, box); }
    catch (e) { console.error('Пароль из .pass-note не открывает publish-key.js. Ключ собран с другим паролем.'); process.exit(1); }
  }

  if (cmd === 'check') {
    if (!payload.gh) { console.log('Вход: работает. Токена нет — «Сохранить на сайт» скачивает файл.'); return; }
    const res = await checkToken(payload.gh);
    console.log(res.ok ? 'Всё в порядке: токен рабочий, срок действия — ' + res.expires + '.' : 'ПРОБЛЕМА: ' + res.why);
    process.exit(res.ok ? 0 : 2);
  }

  if (cmd === 'token') {
    const token = await ask('Вставьте токен GitHub (github_pat_…) и нажмите Enter: ', true);
    if (!token) { console.error('Пусто — ничего не меняю.'); process.exit(1); }
    if (!/^github_pat_/.test(token)) {
      console.error('Это не fine-grained токен (должен начинаться с github_pat_). Классический токен даёт доступ ко всем ' +
        'репозиториям сразу — класть такой в админку нельзя. Создайте fine-grained только на ' + REPO + '.');
      process.exit(1);
    }
    process.stdout.write('Проверяю токен на GitHub… ');
    const res = await checkToken(token);
    if (!res.ok) { console.log('\n' + res.why); process.exit(2); }
    console.log('годится, срок действия — ' + res.expires + '.');
    writeBox(await seal(pw, { gh: token }));
    console.log('publish-key.js обновлён. Осталось выложить: bash deploy.sh "Ключ публикации"');
    return;
  }

  if (cmd === 'password') {
    const typed = await ask('Новый пароль (Enter — придумать случайный): ', false);
    const next = typed || newPassword();
    if (next.length < 12) { console.error('Короче 12 символов — слишком легко подобрать. Не меняю.'); process.exit(1); }
    writeBox(await seal(next, payload));
    writePass(next);
    console.log('Пароль сменён, новый — в .pass-note. Выложить: bash deploy.sh "Новый пароль админки"');
    return;
  }

  console.error('Неизвестная команда. Есть: token, password, check, init.');
  process.exit(1);
}

main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
