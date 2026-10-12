/* =========================================================================
   ФинВыбор (maeb-fin.ru) — черновик правок из админки.

   Админка держит правки в localStorage этого браузера, а сайт показывает
   их хозяину вместо опубликованного каталога. Здесь решается, что делать
   с черновиком:

   — совпадает с тем, что уже лежит на сайте → он больше не нужен, удаляем;
   — только что сохранён на сайт (publishedAt) → сайт ещё обновляется,
     показываем правки с пометкой «сохранено»; через 20 минут черновик
     считается отработанным и удаляется сам;
   — иначе это несохранённые правки.

   Подключается и на сайте (перед script.js), и в админке (перед admin.js),
   после data.js.
   ========================================================================= */

(function () {
  'use strict';

  var KEY = 'maeb:draft';
  /* «Посмотреть как посетитель» — только для этой вкладки. */
  var VIEW_LIVE_KEY = 'maeb:view-live';
  var FRESH_MS = 20 * 60 * 1000;

  /* То, что сейчас опубликовано. Админка подменяет его, когда убедится,
     что сайт уже отдаёт новую версию, — пересобрать const из data.js нельзя. */
  var liveOverride = null;

  function live() {
    if (liveOverride) return liveOverride;
    return {
      content: CONTENT,
      offers: OFFERS,
      library: (typeof LIBRARY !== 'undefined' && Array.isArray(LIBRARY)) ? LIBRARY : []
    };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return d && Array.isArray(d.offers) && d.content ? d : null;
    } catch (e) {
      return null;
    }
  }

  /* Бросает исключение, если браузер не дал записать: админка это ловит
     и предлагает скачать файл, чтобы правки не потерялись. */
  function write(state, publishedAt) {
    var d = { content: state.content, offers: state.offers, library: state.library || [] };
    if (publishedAt) d.publishedAt = publishedAt;
    localStorage.setItem(KEY, JSON.stringify(d));
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* приватный режим */ }
  }

  /* Сравниваем по смыслу, а не по тексту: у оффера в черновике бывают
     пустые поля и поля чужой категории, которых в data.js нет, а порядок
     ключей зависит от того, как оффер правили. В data.js попадают ровно
     эти поля — их и сравниваем. */
  var OFFER_KEYS = ['cat', 'partner', 'title', 'logo', 'logoExt', 'tone', 'tag', 'hot', 'url'];

  function canonOffer(o) {
    var keys = OFFER_KEYS.concat((typeof SPEC_ORDER === 'object' && SPEC_ORDER[o.cat]) || []);
    var out = {};
    keys.forEach(function (k) {
      if (o[k]) out[k] = o[k] === true ? true : String(o[k]);
    });
    return out;
  }

  function tidy(v) {
    if (Array.isArray(v)) return v.map(tidy);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).sort().forEach(function (k) {
        var x = v[k];
        if (x === '' || x === null || x === undefined || x === false) return;
        out[k] = tidy(x);
      });
      return out;
    }
    return v;
  }

  function canon(s) {
    return JSON.stringify(tidy({
      content: s.content || {},
      offers: (s.offers || []).map(canonOffer),
      library: (s.library || []).map(function (it) {
        return { name: it.name, ext: it.ext || 'png', data: it.data };
      })
    }));
  }

  function sameAsLive(s) {
    try { return canon(s) === canon(live()); } catch (e) { return false; }
  }

  /* kind: 'none' — черновика нет (или он отработал и удалён);
           'edits' — есть несохранённые правки;
           'published' — правки только что сохранены на сайт, сайт обновляется. */
  function status() {
    var d = read();
    if (!d) return { kind: 'none' };
    if (sameAsLive(d)) { clear(); return { kind: 'none' }; }
    if (d.publishedAt) {
      var age = Date.now() - Date.parse(d.publishedAt);
      if (!(age >= 0 && age < FRESH_MS)) { clear(); return { kind: 'none' }; }
      return { kind: 'published', draft: d, at: d.publishedAt };
    }
    return { kind: 'edits', draft: d };
  }

  function viewLive(on) {
    try {
      if (on === undefined) return sessionStorage.getItem(VIEW_LIVE_KEY) === '1';
      if (on) sessionStorage.setItem(VIEW_LIVE_KEY, '1');
      else sessionStorage.removeItem(VIEW_LIVE_KEY);
    } catch (e) { return false; }
    return !!on;
  }

  /* Разбор присланного data.js в данные — для проверки «сайт уже обновился?»
     и для возврата прежней версии. Файл свой, с этого же сайта. */
  function parseDataFile(text) {
    /* eslint-disable-next-line no-new-func */
    var f = new Function(text + '\n;return { content: CONTENT, offers: OFFERS, ' +
      'library: (typeof LIBRARY !== "undefined" && Array.isArray(LIBRARY)) ? LIBRARY : [] };');
    return f();
  }

  window.MaebDraft = {
    KEY: KEY,
    read: read,
    write: write,
    clear: clear,
    status: status,
    canon: canon,
    sameAsLive: sameAsLive,
    viewLive: viewLive,
    parseDataFile: parseDataFile,
    setLive: function (s) { liveOverride = s; },
    live: live
  };
})();
