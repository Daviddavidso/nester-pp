/* ==========================================================================
   СОХРАНЕНИЕ НА САЙТ — админка maeb-fin.ru.

   Сайт — статика на GitHub Pages, сервера у него нет. Поэтому «Сохранить
   на сайт» кладёт собранный админкой data.js прямо в репозиторий
   Daviddavidso/nester-pp через GitHub API, и Pages за минуту-другую
   пересобирает сайт. Модуль сам проверяет, когда новая версия дошла до
   сайта, и сообщает «Готово».

   Ключ к репозиторию — fine-grained токен GitHub только на этот
   репозиторий (Contents: Read and write). В publish-key.js он лежит
   зашифрованным паролем админки; расшифровывает его вход в админку
   (admin.html) и держит в sessionStorage до закрытия вкладки.

   Ключа нет или он перестал действовать — панель переходит в ручной
   режим: кнопка честно называется «Скачать файл с правками» и отдаёт
   data.js, который можно прислать разработчику.

   Разметка панели — в admin.html (секция «Сохранение на сайт»),
   окно подтверждения и объявления — общие с админкой (SITE_ADMIN).
   ========================================================================== */

(function () {
  'use strict';

  var cfg = window.PUBLISH;
  var admin = window.SITE_ADMIN;
  if (!cfg || !admin || !window.MaebDraft) return;

  var GH = 'https://api.github.com';
  var TOKEN_KEY = 'maeb:gh';
  var POLL_EVERY = 10000;
  var POLL_FOR = 6 * 60 * 1000;

  function $(id) { return document.getElementById(id); }

  var btnSave = $('pub-save');
  var btnRoll = $('pub-rollback');
  var stateLine = $('pub-state');
  var errLine = $('pub-error');
  if (!btnSave || !stateLine) return;

  var token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { token = ''; }

  /* manual: null — публикация работает; 'nokey' — ключ не подключён;
     'dead' — ключ был, но GitHub его больше не принимает. */
  var manual = token ? null : 'nokey';
  var busy = false;
  var lastSaved = null;        // дата последнего сохранения data.js (из истории GitHub)
  var poll = null;             // { until, timer, announced }
  var timedOut = false;

  /* ------------------------------------------------------- объявления -- */

  /* Сообщения — через админку: она кладёт их в открытое окно, если оно
     есть. Иначе «Готово», пришедшее во время правки оффера, не услышать. */
  function say(text) { admin.say(text); }

  function showError(text) {
    errLine.textContent = '';
    /* Пустой такт: одинаковая ошибка подряд иначе не объявляется. */
    setTimeout(function () { errLine.textContent = text; }, 60);
    /* Открыто окно (правка оффера) — панель за ним для скринридера немая,
       поэтому ошибку дублируем в объявление внутри окна. */
    if (document.querySelector('dialog[open]')) say(text);
  }

  function clearError() { errLine.textContent = ''; }

  function niceTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString()
      ? 'сегодня в ' + t
      : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' в ' + t;
  }

  /* ------------------------------------------------------- состояние --- */

  function setLabel(btn, text) {
    var l = btn.querySelector('.glass__label');
    (l || btn).textContent = text;
  }

  /* Кнопку прячем — фокус сначала на главную, иначе он падает в body. */
  function hide(btn) {
    if (!btn || btn.hidden) return;
    if (document.activeElement === btn) btnSave.focus();
    btn.hidden = true;
  }

  function applyMode() {
    setLabel(btnSave, manual ? 'Скачать файл с правками' : 'Сохранить на сайт');
    if (manual) hide(btnRoll);
    else if (btnRoll) btnRoll.hidden = false;
  }

  /* Строка состояния — обычный текст, не живая область: она пересчитывается
     каждые две секунды и заговорила бы сама с собой. Пишем, только если
     текст поменялся. Состояние несут слова, цвет лишь вторит им. */
  function render() {
    var text, dirty = false;
    if (busy) {
      text = 'Сохраняю на сайт…';
    } else {
      var st = MaebDraft.status();
      if (manual === 'dead') {
        text = 'Ключ сохранения на сайт больше не действует — его должен обновить разработчик. ' +
               'Пока «Скачать файл с правками» скачивает data.js: отправьте его разработчику.';
        dirty = st.kind === 'edits';
      } else if (manual) {
        text = 'Сохранение на сайт ещё не подключено. «Скачать файл с правками» скачает data.js — ' +
               'отправьте его разработчику, и правки появятся на сайте.';
        dirty = st.kind === 'edits';
      } else if (st.kind === 'edits') {
        dirty = true;
        text = 'Есть правки, которых нет на сайте. Нажмите «Сохранить на сайт».';
      } else if (st.kind === 'published') {
        text = timedOut
          ? 'Сохранено ' + niceTime(st.at) + '. Сайт ещё обновляется — иногда это до 10 минут, делать ничего не нужно.'
          : 'Сохранено ' + niceTime(st.at) + '. Сайт обновляется — обычно это 1–2 минуты.';
      } else {
        text = 'Всё сохранено: на сайте та же версия, что здесь.' +
               (lastSaved ? ' Последнее сохранение — ' + niceTime(lastSaved) + '.' : '');
      }
    }
    if (stateLine.textContent !== text) stateLine.textContent = text;
    stateLine.setAttribute('data-dirty', dirty ? 'true' : 'false');
  }

  function setBusy(on) {
    busy = on;
    btnSave.setAttribute('aria-disabled', on ? 'true' : 'false');
    if (btnRoll) btnRoll.setAttribute('aria-disabled', on ? 'true' : 'false');
    var spin = btnSave.querySelector('.pub-spin');
    if (on && !spin) {
      spin = document.createElement('span');
      spin.className = 'pub-spin';
      spin.setAttribute('aria-hidden', 'true');
      btnSave.appendChild(spin);
    }
    if (!on && spin) spin.remove();
    render();
  }

  /* ---------------------------------------------------------- GitHub --- */

  function fail(kind, status, extra) {
    var e = new Error(kind);
    e.kind = kind; e.status = status || 0; e.extra = extra || '';
    return e;
  }

  function gh(path, init, accept) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 25000);
    var opts = Object.assign({ cache: 'no-store', signal: ctrl.signal }, init || {});
    opts.headers = Object.assign({
      'Accept': accept || 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    }, (init && init.headers) || {});
    return fetch(GH + path, opts).then(function (res) {
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.status === 401) throw fail('dead', 401);
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') throw fail('rate', 403);
      if (res.status === 403 || res.status === 404) throw fail('dead', res.status);
      if (res.status === 409) throw fail('conflict', 409);
      if (res.status === 422) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          var msg = String((d && d.message) || '');
          throw fail(/sha/i.test(msg) ? 'conflict' : 'rejected', 422, msg);
        });
      }
      if (res.status === 413) throw fail('big', 413);
      throw fail('server', res.status);
    }, function (err) {
      clearTimeout(timer);
      throw fail(err && err.name === 'AbortError' ? 'timeout' : 'network');
    });
  }

  var repoPath = '/repos/' + cfg.repo;

  function currentSha() {
    return gh(repoPath + '/contents/' + cfg.file + '?ref=' + encodeURIComponent(cfg.branch))
      .then(function (r) { return r.json(); })
      .then(function (d) { return d.sha; });
  }

  /* UTF-8 → base64 без устаревших escape/unescape. */
  function b64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /* Кладём файл. Если между чтением и записью файл успели поменять
     (вторая вкладка, разработчик), GitHub отвечает конфликтом — тогда
     берём свежую отметку и пробуем ещё раз. */
  function putFile(text, message, retried) {
    return currentSha().then(function (sha) {
      return gh(repoPath + '/contents/' + cfg.file, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, content: b64(text), sha: sha, branch: cfg.branch })
      });
    }).catch(function (e) {
      if (e.kind === 'conflict' && !retried) return putFile(text, message, true);
      throw e;
    });
  }

  function loadLastSaved() {
    if (manual) return;
    gh(repoPath + '/commits?path=' + encodeURIComponent(cfg.file) + '&sha=' + encodeURIComponent(cfg.branch) + '&per_page=1')
      .then(function (r) { return r.json(); })
      .then(function (list) {
        var c = Array.isArray(list) && list[0];
        lastSaved = c ? (c.commit.committer.date || c.commit.author.date) : null;
        render();
      })
      .catch(function (e) { if (e.kind === 'dead') goManual('dead', false); });
  }

  /* ------------------------------------------------------- ошибки ------ */

  function goManual(reason, announce) {
    manual = reason;
    applyMode();
    render();
    if (announce) {
      showError('Ошибка: ключ сохранения на сайт больше не действует. Правки на месте. ' +
                'Нажмите «Скачать файл с правками» и отправьте файл разработчику.');
    }
  }

  function explain(e) {
    switch (e && e.kind) {
      case 'dead': goManual('dead', true); return;
      case 'rate': showError('Ошибка: GitHub временно ограничил запросы. Правки на месте — попробуйте через несколько минут.'); return;
      case 'timeout': showError('Ошибка: сервер сохранения не ответил. Правки на месте — нажмите «Сохранить на сайт» ещё раз.'); return;
      case 'network': showError('Ошибка: нет связи с сервером сохранения. Проверьте интернет и нажмите «Сохранить на сайт» ещё раз.'); return;
      case 'big': showError('Ошибка: файл слишком большой — скорее всего, из-за тяжёлой картинки. Уменьшите её и сохраните снова.'); return;
      case 'conflict': showError('Ошибка: каталог на сайте только что изменился. Обновите страницу и сохраните ещё раз.'); return;
      case 'noprev': showError('Ошибка: предыдущей версии нет — возвращать не к чему.'); return;
      case 'badprev': showError('Ошибка: предыдущая версия каталога повреждена, возвращать её нельзя.'); return;
      case 'build': showError('Ошибка: не получилось собрать каталог. Правки на месте — скачайте копию кнопкой «Скачать data.js».'); return;
      default:
        showError('Ошибка: сохранение не прошло' + (e && e.status ? ' (код ' + e.status + ')' : '') +
                  '. Правки на месте — попробуйте через пару минут.');
    }
  }

  /* ------------------------------------------- «дошло ли до сайта» ----- */

  /* Раз в 10 секунд читаем data.js с самого сайта и сравниваем с тем, что
     сохранили. Объявляем только смену состояния, фокус не трогаем. */
  function startPolling(target) {
    stopPolling();
    timedOut = false;
    poll = { target: target, until: Date.now() + POLL_FOR, timer: null };
    tick();
  }

  function stopPolling() {
    if (poll && poll.timer) clearTimeout(poll.timer);
    poll = null;
  }

  function tick() {
    if (!poll) return;
    var p = poll;
    fetch(cfg.liveUrl + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (text) {
        if (poll !== p) return;
        var s = null;
        try { s = text ? MaebDraft.parseDataFile(text) : null; } catch (e) { s = null; }
        if (s && MaebDraft.canon(s) === MaebDraft.canon(p.target)) {
          MaebDraft.setLive(s);
          stopPolling();
          lastSaved = new Date().toISOString();
          render();
          say('Готово — правки на сайте, их видят посетители.');
          return;
        }
        next(p);
      }, function () { if (poll === p) next(p); });
  }

  function next(p) {
    if (Date.now() > p.until) {
      stopPolling();
      timedOut = true;
      render();
      say('Сайт ещё обновляется. Правки сохранены — иногда сайт обновляется до 10 минут.');
      return;
    }
    p.timer = setTimeout(tick, POLL_EVERY);
  }

  /* ----------------------------------------------------------- действия */

  function download() {
    var text;
    try { text = admin.buildDataFile(); } catch (e) { explain({ kind: 'build' }); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript;charset=utf-8' }));
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    say('Файл data.js скачан. Отправьте его разработчику — он выложит правки на сайт.');
  }

  function publish() {
    var text, snap;
    try { text = admin.buildDataFile(); snap = admin.getState(); }
    catch (e) { explain({ kind: 'build' }); return; }

    clearError();
    setBusy(true);
    putFile(text, 'Каталог: сохранение из админки').then(function () {
      var at = new Date().toISOString();
      try { MaebDraft.write(snap, at); } catch (e) { /* хранилище недоступно — переживём */ }
      setBusy(false);
      say('Сохранено. Сайт обновится за 1–2 минуты — сообщу, когда правки появятся.');
      startPolling(snap);
    }, function (e) {
      setBusy(false);
      explain(e);
    });
  }

  function rollback() {
    clearError();
    setBusy(true);
    var oldText, oldState;
    gh(repoPath + '/commits?path=' + encodeURIComponent(cfg.file) + '&sha=' + encodeURIComponent(cfg.branch) + '&per_page=2')
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!Array.isArray(list) || list.length < 2) throw fail('noprev');
        return gh(repoPath + '/contents/' + cfg.file + '?ref=' + list[1].sha, null, 'application/vnd.github.raw');
      })
      .then(function (r) { return r.text(); })
      .then(function (text) {
        oldText = text;
        try { oldState = MaebDraft.parseDataFile(text); } catch (e) { throw fail('badprev'); }
        if (!oldState || !Array.isArray(oldState.offers)) throw fail('badprev');
        return putFile(oldText, 'Каталог: возврат предыдущей версии из админки');
      })
      .then(function () {
        try { MaebDraft.write(oldState, new Date().toISOString()); } catch (e) {}
        /* Без перезагрузки: она обрывает речь и теряет фокус. Экран
           админки просто перерисовывается из прежней версии. */
        admin.reload();
        setBusy(false);
        say('Прежняя версия возвращается на сайт. Это займёт 1–2 минуты — сообщу, когда сайт обновится.');
        startPolling(oldState);
      })
      .catch(function (e) {
        setBusy(false);
        explain(e);
      });
  }

  btnSave.addEventListener('click', function () {
    if (busy) { say('Идёт сохранение, подождите.'); return; }
    clearError();
    if (manual) { download(); return; }
    if (MaebDraft.status().kind !== 'edits') {
      say('Сохранять нечего: на сайте уже эта версия.');
      return;
    }
    admin.askConfirm({
      title: 'Сохранить правки на сайт?',
      text: 'Каталог и тексты на сайте заменятся этой версией. Прежнюю можно будет вернуть ' +
            'кнопкой «Вернуть предыдущую версию».',
      ok: 'Сохранить на сайт',
      cancel: 'Не сохранять',
      onOk: publish
    });
  });

  if (btnRoll) btnRoll.addEventListener('click', function () {
    if (busy) { say('Идёт сохранение, подождите.'); return; }
    clearError();
    admin.askConfirm({
      title: 'Вернуть предыдущую версию?',
      text: 'Сайт вернётся к каталогу и текстам, которые были до последнего сохранения. ' +
            'Несохранённые правки в этом браузере пропадут.',
      ok: 'Вернуть версию',
      cancel: 'Не возвращать',
      onOk: rollback
    });
  });

  /* -------------------------------------------------------------- старт */

  applyMode();
  render();
  loadLastSaved();

  /* Сохранили, а потом перезагрузили страницу — досматриваем, дошло ли. */
  var st0 = MaebDraft.status();
  if (!manual && st0.kind === 'published') startPolling(st0.draft);

  /* Вход в админку случается уже после старта модуля: экран входа
     расшифровывает ключ и сообщает об этом событием. */
  document.addEventListener('maeb:unlocked', function () {
    try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { token = ''; }
    manual = token ? null : 'nokey';
    applyMode();
    render();
    loadLastSaved();
    var st = MaebDraft.status();
    if (!manual && st.kind === 'published' && !poll) startPolling(st.draft);
  });

  /* Правки в админке модуль не отслеживает — просто пересчитываем строку. */
  setInterval(function () { if (!busy) render(); }, 2000);
})();
