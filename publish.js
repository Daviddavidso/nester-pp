/* ==========================================================================
   СОХРАНЕНИЕ НА САЙТ — общий модуль для админок витрин.

   Подключается ПОСЛЕ admin.js. Админка сообщает модулю, как собрать файл
   данных и как себя проверить:

     window.PUBLISH = {
       build:    function () { return '...текст файла data.js...'; },
       validate: function () { return true; },   // необязательно
       after:    'селектор',                     // куда воткнуть панель
     };

   Всё остальное модуль делает сам: рисует блок с кнопками, спрашивает
   пароль, ходит в api.php, показывает состояние. Если api.php рядом нет
   (админку открыли локально или хостинг без PHP), кнопки не появляются —
   остаётся прежний путь: скачать файл и положить его руками.
   ========================================================================== */

(function () {
  'use strict';

  var cfg = window.PUBLISH;
  if (!cfg || typeof cfg.build !== 'function') return;

  var API = cfg.api || 'api.php';

  /* Вход подтверждает не cookie, а токен: сервис публикации живёт на другом
     домене (vercel.app), и cookie туда из браузера не ходят. Токен выдаёт
     сервер после пароля, живёт 30 дней. */
  var TOKEN_KEY = 'vybor:publish-token';
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  /* Пока сервис публикации недоступен, панель работает в ручном режиме:
     «Сохранить на сайт» скачивает файл каталога для отправки разработчику,
     «Скачать сайт целиком» ведёт на архив репозитория. */
  var manual = false;

  var inFlight = false;
  var reqSeq = 0;
  var authed = false;
  var lastPublished = { at: null };
  var afterLogin = null;
  var authHandled = false;
  var published = null;      // что уже уехало на сайт из этой вкладки

  /* ---------------------------------------------- разметка ------------- */

  /* Кнопки — в стиле стеклянных пилюль сайта (.glass в styles.css): корпус
     из полупрозрачного стекла, блик по верхней кромке, у главной — красная
     заливка #E4142A→#C81022→#96101F (белый текст на ней 5.9:1; плоский
     ярко-красный #FF2D2D в заливку нельзя — белый текст падает до 3.7:1).
     Светлая рамка обязательна: она несёт контраст границы 3:1 на тёмном фоне. */
  var CSS = [
    '.pub { margin: 20px 0; padding: 16px 18px; border: 1px solid rgba(255,255,255,.14);',
    '       border-radius: 18px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;',
    '       isolation: isolate; }',
    '.pub[hidden], .pub__btn[hidden] { display: none; }',
    '.pub__btn { position: relative; isolation: isolate; display: inline-flex; align-items: center;',
    '            justify-content: center; gap: 8px; min-height: 44px; padding: 10px 20px;',
    '            border: 1px solid var(--glass-line, rgba(255,255,255,.40)); border-radius: 999px;',
    '            cursor: pointer; color: var(--text, #fff); font: inherit; font-weight: 500; font-size: 15px;',
    '            background: linear-gradient(180deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,.05) 38%,',
    '              rgba(255,255,255,.02) 62%, rgba(255,255,255,.12) 100%), var(--glass-body, rgba(22,22,28,.55));',
    '            -webkit-backdrop-filter: blur(18px) saturate(170%); backdrop-filter: blur(18px) saturate(170%);',
    '            box-shadow: inset 0 1.5px 0 rgba(255,255,255,.72), inset 0 -12px 26px rgba(255,255,255,.06),',
    '              0 14px 34px -14px rgba(0,0,0,.95);',
    '            transition: transform .28s ease, border-color .28s ease; }',
    '.pub__btn::before { content: ""; position: absolute; left: 7%; right: 7%; top: 2px; height: 42%;',
    '            border-radius: 999px; background: linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,0));',
    '            filter: blur(4px); opacity: .55; pointer-events: none; }',
    '.pub__btn:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.55); }',
    '.pub__btn:active { transform: translateY(0); }',
    '.pub__btn:focus-visible { outline: 2px solid #FFFFFF; outline-offset: 3px;',
    '            box-shadow: 0 0 0 2px #08080A, inset 0 1.5px 0 rgba(255,255,255,.72),',
    '              0 14px 34px -14px rgba(0,0,0,.95); }',
    '.pub__btn--main { border-color: rgba(255,255,255,.45); color: #fff;',
    '            background: linear-gradient(180deg, rgba(255,255,255,.26) 0%, rgba(255,255,255,.06) 34%,',
    '              rgba(255,45,45,.18) 58%, rgba(255,255,255,.14) 100%),',
    '              linear-gradient(180deg, #E4142A 0%, var(--accent-fill, #C81022) 55%, #96101F 100%); }',
    '.pub__btn--main::after { content: ""; position: absolute; left: 8%; right: 8%; bottom: -14px; height: 26px;',
    '            z-index: -1; border-radius: 999px; background: var(--accent, #FF2D2D); filter: blur(18px);',
    '            opacity: .5; pointer-events: none; }',
    '.pub__btn[aria-disabled="true"] { cursor: progress; }',
    '.pub__state { flex: 1 1 100%; margin: 0; font-size: .92rem; }',
    '.pub__state[data-dirty="true"] { color: light-dark(#8A5300, #FFB454); font-weight: 600; }',
    '.pub__spin { width: 14px; height: 14px; border: 2px solid currentColor;',
    '             border-right-color: transparent; border-radius: 50%; animation: pubspin .8s linear infinite; }',
    '@keyframes pubspin { to { transform: rotate(360deg); } }',
    '@media (prefers-reduced-motion: reduce) { .pub__spin { display: none; }',
    '  .pub__btn, .pub__btn:hover { transition: none; transform: none; } }',
    '.pub__dlg { max-width: 440px; padding: 22px; border: 1px solid light-dark(#c9c9d1, #3a3a44);',
    '            border-radius: 14px; background: light-dark(#ffffff, #17171d); color: CanvasText;',
    '            box-shadow: 0 20px 60px rgba(0,0,0,.55); }',
    '.pub__dlg::backdrop { background: rgba(0,0,0,.7); }',
    '.pub__dlg input[type="password"], .pub__dlg input[type="text"] { min-height: 44px; padding: 10px 12px; width: 100%;',
    '            border: 1px solid rgba(128,128,128,.9); border-radius: 10px;',
    '            background: Canvas; color: CanvasText; font: inherit; }',
    '.pub__row { display: flex; gap: 8px; align-items: flex-start; }',
    '.pub__row input { flex: 1 1 auto; min-width: 0; }',
    '.pub__err { color: light-dark(#C62828, #FFB4B4); font-weight: 600; font-size: .88rem; min-height: 0; }',
    '.pub__err:empty { display: none; }',
    '.pub__hint { opacity: .75; font-size: .85rem; }',
    '.pub__vh { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;',
    '           border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* Живые области создаём на старте и больше не трогаем: область, созданная
     в момент сообщения, у части связок браузер+скринридер не читается. */
  var live = document.createElement('p');
  live.className = 'pub__vh';
  live.setAttribute('role', 'status');
  var alert = document.createElement('p');
  alert.className = 'pub__vh';
  alert.setAttribute('role', 'alert');
  document.body.insertBefore(alert, document.body.firstChild);
  document.body.insertBefore(live, document.body.firstChild);

  var box = document.createElement('div');
  box.className = 'pub';
  box.innerHTML =
    '<button class="pub__btn pub__btn--main" type="button" data-pub="save">Сохранить на сайт</button>' +
    '<button class="pub__btn" type="button" data-pub="zip" hidden>Скачать сайт целиком</button>' +
    '<button class="pub__btn" type="button" data-pub="rollback" hidden>Вернуть предыдущую версию</button>' +
    '<button class="pub__btn" type="button" data-pub="logout" hidden>Выйти</button>' +
    '<p class="pub__state" data-pub="state">Проверяю, работает ли сохранение на сайт…</p>';

  var dlg = document.createElement('dialog');
  dlg.className = 'pub__dlg';
  dlg.setAttribute('aria-labelledby', 'pub-title');
  dlg.setAttribute('aria-describedby', 'pub-intro');
  dlg.innerHTML =
    '<form data-pub="form" novalidate>' +
      '<h2 id="pub-title" style="margin:0 0 8px">Сохранение на сайт</h2>' +
      '<p id="pub-intro" style="margin:0 0 16px">Введите пароль сайта — после этого правки уедут на сайт. ' +
        'Пароль спрашиваем один раз, дальше кнопка работает сразу.</p>' +
      '<label for="pub-pass" style="display:block;font-weight:600;margin-bottom:6px">Пароль сайта</label>' +
      '<div class="pub__row">' +
        '<input type="password" id="pub-pass" name="sitekey" autocomplete="current-password" ' +
          'autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" ' +
          'aria-describedby="pub-pass-hint pub-pass-err">' +
        '<button class="pub__btn" type="button" data-pub="toggle" aria-pressed="false" aria-label="Показать пароль">' +
          '<span aria-hidden="true">👁</span></button>' +
      '</div>' +
      '<p class="pub__hint" id="pub-pass-hint">Общий пароль этого сайта, не ваш личный. Его даёт разработчик.</p>' +
      '<p class="pub__err" id="pub-pass-err"></p>' +
      '<div style="display:flex;gap:10px;margin-top:18px">' +
        '<button class="pub__btn" type="button" data-pub="cancel">Отмена</button>' +
        '<button class="pub__btn pub__btn--main" type="submit" data-pub="ok">Войти и сохранить</button>' +
      '</div>' +
    '</form>';

  var confirmDlg = document.createElement('dialog');
  confirmDlg.className = 'pub__dlg';
  confirmDlg.setAttribute('role', 'alertdialog');
  confirmDlg.setAttribute('aria-labelledby', 'pub-c-title');
  confirmDlg.setAttribute('aria-describedby', 'pub-c-text');
  confirmDlg.innerHTML =
    '<h2 id="pub-c-title" style="margin:0 0 8px">Сохранить каталог на сайте?</h2>' +
    '<p id="pub-c-text" style="margin:0"></p>' +
    '<div style="display:flex;gap:10px;margin-top:18px">' +
      '<button class="pub__btn" type="button" data-pub="c-no">Отмена</button>' +
      '<button class="pub__btn pub__btn--main" type="button" data-pub="c-yes">Сохранить на сайт</button>' +
    '</div>';

  /* Если страница уже принесла свои кнопки (общая оболочка админки), берём
     их. Свой блок рисуем только там, где панель осталась старая — иначе
     на экране оказались бы две пары одинаковых кнопок. */
  var shell = document.getElementById('publish');

  function el(name, root) { return (root || box).querySelector('[data-pub="' + name + '"]'); }

  var btnSave, btnZip, btnRoll, btnOut, stateLine, extraSave;

  if (shell) {
    box = null;
    btnSave = shell;
    extraSave = document.getElementById('publish-2');
    btnZip = document.getElementById('zip');
    btnRoll = document.getElementById('rollback');
    btnOut = document.getElementById('logout');
    stateLine = document.getElementById('publish-state');
  } else {
    var anchor = cfg.after ? document.querySelector(cfg.after) : null;
    if (anchor) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else {
      var main = document.querySelector('main') || document.body;
      main.insertBefore(box, main.firstChild);
    }
    btnSave = el('save'); btnZip = el('zip'); btnRoll = el('rollback'); btnOut = el('logout');
    stateLine = el('state');
  }

  document.body.appendChild(dlg);
  document.body.appendChild(confirmDlg);

  /* Живые области оболочки уже есть — свои не плодим. */
  var shellStatus = document.getElementById('a-status');
  if (shellStatus) { live.remove(); alert.remove(); live = shellStatus; alert = document.getElementById('a-alert'); }

  /* Диалог подтверждения оболочки (#ask) переиспользуем: он уже вычитан
     и одинаково ведёт себя во всех витринах. */
  var shellAsk = document.getElementById('ask');
  var pass = dlg.querySelector('#pub-pass');
  var passErr = dlg.querySelector('#pub-pass-err');

  /* ---------------------------------------------- объявления ----------- */

  var timers = {};
  function say(text, assertive) {
    var node = assertive ? alert : live;
    var key = assertive ? 'a' : 's';
    clearTimeout(timers[key]);
    node.textContent = '';
    /* Пустой такт: одинаковый текст подряд иначе не объявляется. */
    timers[key] = setTimeout(function () { node.textContent = text; }, 80);
  }

  function focusRing(node) {
    if (!node) return;
    node.focus();
  }

  /* ---------------------------------------------- сеть ----------------- */

  function api(action, payload, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 20000);
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action, token: getToken() }, payload || {})),
      signal: ctrl.signal
    }).then(function (res) {
      /* Успех — только настоящий JSON с ok:true. Иначе страница-заглушка
         хостинга («200 и html») прочиталась бы как «готово». */
      var isJson = (res.headers.get('content-type') || '').indexOf('application/json') !== -1;
      if (!isJson) return { status: res.status, ok: false, data: {}, notApi: true };
      return res.json().catch(function () { return {}; }).then(function (d) {
        return { status: res.status, ok: res.ok, data: d };
      });
    }).finally(function () { clearTimeout(timer); });
  }

  function setBusy(on) {
    inFlight = on;
    btnSave.setAttribute('aria-disabled', on ? 'true' : 'false');
    var spin = btnSave.querySelector('.pub__spin');
    if (on && !spin) {
      spin = document.createElement('span');
      spin.className = 'pub__spin';
      spin.setAttribute('aria-hidden', 'true');
      btnSave.appendChild(spin);
    }
    if (!on && spin) spin.remove();
  }

  /* Что сравнивать на «есть ли несохранённые правки». Собранный файл для
     этого не годится: в его шапке стоит время сборки. */
  function snapshot() {
    return typeof cfg.stateHash === 'function' ? cfg.stateHash() : cfg.build();
  }

  function hashOf(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h) + ':' + s.length;
  }

  function niceTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString()
      ? 'сегодня в ' + t
      : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' в ' + t;
  }

  /* Состояние несут слова, а не только цвет. Живой областью строка не
     является: она меняется на каждую правку и заговорила бы сама с собой. */
  function refresh() {
    var when = niceTime(lastPublished.at);
    var now;
    try { now = hashOf(snapshot()); } catch (e) { now = null; }
    var pending = now === null || now !== published;
    stateLine.setAttribute('data-dirty', pending ? 'true' : 'false');
    if (pending) {
      stateLine.textContent = when
        ? 'Есть правки, которых нет на сайте. Последнее сохранение: ' + when + '.'
        : 'Есть правки, которых нет на сайте. Нажмите «Сохранить на сайт».';
    } else {
      stateLine.textContent = when ? 'Всё сохранено на сайте: ' + when + '.' : 'На сайте текущая версия.';
    }
  }

  function problem(res) {
    if (res.notApi) return 'Сайт ответил не по делу — сохранение не прошло. Правки на месте, ничего не потеряно.';
    var msg = res.data && res.data.error ? String(res.data.error).slice(0, 140) : '';
    if (res.status === 413) return msg || 'Слишком тяжёлая картинка — сайт её не принял. Правки остались здесь.';
    if (res.status >= 500) return 'На сайте ошибка ' + res.status + '. Правки остались здесь, попробуйте через пару минут.';
    return (msg || 'Сайт отказался принять правки.') + ' Правки остались здесь.';
  }

  function run(action) {
    if (inFlight) { say('Идёт сохранение, подождите.'); return; }
    setBusy(true);
    var my = ++reqSeq;
    timers.slow = setTimeout(function () { say('Сохраняю на сайт…'); }, 1000);

    var body = action === 'rollback' ? {} : { data: cfg.build() };
    api(action, body, 25000).then(function (res) {
      if (my !== reqSeq) return;
      clearTimeout(timers.slow);
      setBusy(false);

      if (res.status === 401) {
        authed = false;
        setToken('');
        afterLogin = function () { run(action); };
        openAuth();
        return;
      }
      if (!res.ok || !res.data.ok) { say(problem(res), true); return; }

      authed = true;
      lastPublished = res.data.published || lastPublished;
      published = action === 'rollback' ? null : hashOf(snapshot());
      btnOut.hidden = false; btnZip.hidden = false; btnRoll.hidden = false;
      refresh();
      say(action === 'rollback'
        ? 'Прежняя версия возвращается на сайт: изменения появятся у посетителей в течение пары минут.'
        : 'Сохранено. Сайт обновится сам в течение пары минут.');
      if (action === 'rollback') setTimeout(function () { location.reload(); }, 1500);
    }).catch(function (err) {
      if (my !== reqSeq) return;
      clearTimeout(timers.slow);
      setBusy(false);
      say(err && err.name === 'AbortError'
        ? 'Сайт не ответил. Ничего не сохранено, правки на месте — попробуйте ещё раз.'
        : 'Связи с сайтом нет. Ничего не сохранено, правки на месте.', true);
    });
  }

  /* ---------------------------------------------- подтверждение -------- */

  var pendingRun = null;

  function ask(title, text, yes, fn) {
    var d = shellAsk || confirmDlg;
    if (d.open) return;
    pendingRun = fn;
    if (shellAsk) {
      document.getElementById('ask-title').textContent = title;
      document.getElementById('ask-text').textContent = text;
      var y = document.getElementById('ask-yes');
      y.textContent = yes;
      y.setAttribute('data-pub-run', '1');      // это наше подтверждение, не удаление
      d.showModal();
      document.getElementById('ask-no').focus({ preventScroll: true });
      return;
    }
    confirmDlg.querySelector('#pub-c-title').textContent = title;
    confirmDlg.querySelector('#pub-c-text').textContent = text;
    el('c-yes', confirmDlg).textContent = yes;
    confirmDlg.showModal();
    el('c-no', confirmDlg).focus();   // фокус на безопасную кнопку
  }

  /* Ядро админки делает работу в обработчике кнопки и там же чистит своё
     pending; наш запуск помечен атрибутом, чтобы не спутать с удалением. */
  if (shellAsk) {
    document.getElementById('ask-yes').addEventListener('click', function () {
      if (this.getAttribute('data-pub-run') !== '1') return;
      this.removeAttribute('data-pub-run');
      var fn = pendingRun;
      pendingRun = null;
      if (fn) fn();
    });
    document.getElementById('ask-no').addEventListener('click', function () {
      var y = document.getElementById('ask-yes');
      if (y.getAttribute('data-pub-run') === '1') { y.removeAttribute('data-pub-run'); pendingRun = null; }
    });
  }

  el('c-no', confirmDlg).addEventListener('click', function () {
    pendingRun = null;
    confirmDlg.close();
    focusRing(btnSave);
  });

  /* Работу делаем здесь, а не в обработчике close: событие close приходит
     не во всех окружениях, и действие тогда молча не случается. */
  el('c-yes', confirmDlg).addEventListener('click', function () {
    var fn = pendingRun;
    pendingRun = null;
    confirmDlg.close();
    if (fn) fn();
  });

  confirmDlg.addEventListener('cancel', function () { pendingRun = null; });

  /* ---------------------------------------------- кнопки --------------- */

  /* Ручной путь: тот же файл, что и «Скачать data.js», но с объяснением. */
  function manualDownload() {
    var text;
    try { text = cfg.build(); } catch (e) { say('Не получилось собрать файл. Попробуйте кнопку «Скачать data.js» внизу.', true); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    if (stateLine) {
      stateLine.removeAttribute('data-dirty');
      stateLine.textContent = 'Файл data.js с правками скачан. Отправьте его разработчику — и правки появятся на сайте.';
    }
    say('Файл data.js скачан. Отправьте его разработчику — и правки появятся на сайте.');
  }

  function onSaveClick() {
    if (manual) {
      ask('Сохранение через разработчика',
          'Сейчас скачается файл data.js с вашими правками. Отправьте его разработчику в Telegram — ' +
          'он выложит правки на сайт.',
          'Скачать файл',
          manualDownload);
      return;
    }
    if (inFlight) { say('Идёт сохранение, подождите.'); return; }
    if (typeof cfg.validate === 'function' && !cfg.validate()) return;
    ask('Сохранить каталог на сайте?',
        (cfg.confirmText || 'Каталог на сайте будет заменён этой версией.') +
        ' Прежняя версия сохранится — её вернёт кнопка «Вернуть предыдущую версию».',
        'Сохранить на сайт',
        function () { run('publish'); });
  }
  btnSave.addEventListener('click', onSaveClick);
  if (extraSave) extraSave.addEventListener('click', onSaveClick);

  btnRoll.addEventListener('click', function () {
    ask('Вернуть предыдущую версию?',
        'Сайт откатится к каталогу, который был до последнего сохранения.',
        'Вернуть',
        function () { run('rollback'); });
  });

  btnOut.addEventListener('click', function () {
    api('logout').catch(function () {});   /* серверу это только для сведения */
    setToken('');
    authed = false;
    btnOut.hidden = true;
    say('Вы вышли. Правки остались в браузере.');
  });

  btnZip.addEventListener('click', function () {
    if (manual) {
      if (cfg.zipUrl) { window.location.href = cfg.zipUrl; say('Архив сайта пошёл в загрузки.'); }
      return;
    }
    say('Собираю архив сайта…');
    api('zip', null, 15000).then(function (res) {
      if (res.status === 401) { authed = false; setToken(''); afterLogin = null; openAuth(); return; }
      if (res.ok && res.data.ok && res.data.url) {
        /* Ссылка отдаёт файл (attachment), страница никуда не уходит. */
        window.location.href = res.data.url;
        say('Архив сайта пошёл в загрузки.');
      } else {
        say(problem(res), true);
      }
    }).catch(function () { say('Связи с сайтом нет — архив не собрался. Попробуйте ещё раз.', true); });
  });

  /* ---------------------------------------------- вход ----------------- */

  function cleanup() {
    pass.value = '';
    pass.type = 'password';
    passErr.textContent = '';
    pass.removeAttribute('aria-invalid');
    el('toggle', dlg).setAttribute('aria-pressed', 'false');
  }

  function openAuth() {
    if (dlg.open) return;
    authHandled = false;
    cleanup();
    dlg.showModal();
    pass.focus();
  }

  el('cancel', dlg).addEventListener('click', function () {
    afterLogin = null;
    authHandled = true;
    cleanup();
    dlg.close();
    focusRing(btnSave);
  });

  /* Имя кнопки постоянное, состояние — в aria-pressed: пара «меняющееся имя
     + aria-pressed» читается как «Скрыть пароль, нажата», то есть наоборот. */
  el('toggle', dlg).addEventListener('click', function () {
    var shown = pass.type === 'text';
    var a = pass.selectionStart, b = pass.selectionEnd;
    pass.type = shown ? 'password' : 'text';
    this.setAttribute('aria-pressed', shown ? 'false' : 'true');
    try { pass.setSelectionRange(a, b); } catch (e) { /* не все типы дают */ }
  });

  el('form', dlg).addEventListener('submit', function (e) {
    e.preventDefault();
    var value = pass.value.trim();
    var ok = el('ok', dlg);
    if (!value) {
      pass.setAttribute('aria-invalid', 'true');
      passErr.textContent = 'Ошибка: введите пароль.';
      pass.focus();
      return;
    }
    ok.setAttribute('aria-disabled', 'true');
    api('login', { password: value }, 20000).then(function (res) {
      ok.setAttribute('aria-disabled', 'false');
      if (res.ok && res.data.ok) {
        authed = true;
        if (res.data.token) setToken(res.data.token);
        lastPublished = res.data.published || lastPublished;
        btnOut.hidden = false; btnZip.hidden = false; btnRoll.hidden = false;
        var next = afterLogin;
        afterLogin = null;
        authHandled = true;
        cleanup();
        dlg.close();
        if (next) next();
        return;
      }
      /* Ошибка одного поля: текст рядом с полем и фокус туда же.
         В живую область дублировать нельзя — прозвучит дважды. */
      pass.setAttribute('aria-invalid', 'true');
      passErr.textContent = 'Ошибка: ' + ((res.data && res.data.error) || 'пароль не подошёл.');
      pass.focus();
      pass.select();
    }).catch(function () {
      ok.setAttribute('aria-disabled', 'false');
      pass.setAttribute('aria-invalid', 'true');
      passErr.textContent = 'Ошибка: нет связи с сайтом. Правки на месте, попробуйте ещё раз.';
      pass.focus();
    });
  });

  pass.addEventListener('input', function () {
    pass.removeAttribute('aria-invalid');
    passErr.textContent = '';
  });

  dlg.addEventListener('close', function () {
    if (authHandled) { authHandled = false; return; }
    afterLogin = null;
    cleanup();
    focusRing(btnSave);
  });

  /* ---------------------------------------------- старт ---------------- */

  api('state', null, 15000).then(function (res) {
    if (!(res.data && res.data.ok)) throw new Error('нет api.php');
    authed = !!res.data.auth;
    lastPublished = res.data.published || lastPublished;
    btnOut.hidden = !authed; btnZip.hidden = !authed; btnRoll.hidden = !authed;
    try { published = hashOf(snapshot()); } catch (e) { published = null; }
    refresh();
    /* Правки в админке модуль не отслеживает — просто пересчитываем состояние. */
    setInterval(refresh, 2000);
  }).catch(function () {
    /* Сервис публикации недоступен — переходим в ручной режим: «Сохранить
       на сайт» скачивает файл для отправки разработчику, «Скачать сайт
       целиком» отдаёт архив с GitHub. Возврат версии без сервиса невозможен. */
    manual = true;
    if (btnSave) btnSave.hidden = false;
    if (btnZip) btnZip.hidden = !cfg.zipUrl;
    if (btnRoll) btnRoll.hidden = true;
    if (btnOut) btnOut.hidden = true;
    if (stateLine) {
      stateLine.removeAttribute('data-dirty');
      stateLine.textContent = 'Правки сохраняются в этом браузере. «Сохранить на сайт» скачает файл каталога — '
        + 'отправьте его разработчику, и правки появятся на сайте.';
    }
  });
})();
