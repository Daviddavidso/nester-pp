/* =========================================================================
   ФинВыбор (maeb-fin.ru) — админка.

   Работает без сервера: правки лежат в localStorage этого браузера, а на
   сайт попадают файлом data.js, который админка собирает и отдаёт кнопкой
   «Скачать data.js».

   Почему так, а не «настоящая» админка с базой: сайт статический, ему не
   нужен ни хостинг с PHP, ни пароли, ни бэкапы. Файл — это и есть база.
   ========================================================================= */

(function () {
  'use strict';

  var DRAFT_KEY = 'maeb:draft';

  /* Что лежит в папке logos. Список руками: браузер не умеет читать папку
     на статическом хостинге. Добавили файл — допишите строку сюда. */
  var LOGOS = [
    ['akbars', '.png', 'Ак Барс'], ['alfa', '.png', 'Альфа-Банк'],
    ['bistrodengi', '.png', 'Быстроденьги'], ['denginadom', '.png', 'Деньги на дом'],
    ['dozarplaty', '.png', 'До зарплаты'], ['ekapusta', '.png', 'Екапуста'],
    ['finmoll', '.png', 'Финмолл'], ['forabank', '.png', 'Фора-Банк'],
    ['gpb', '.png', 'Газпромбанк'], ['ligamfo', '.png', 'ЛигаМФО'],
    ['limezaim', '.png', 'Лайм-Займ'], ['maxcredit', '.png', 'Max Credit'],
    ['migcredit', '.png', 'МигКредит'], ['moneyman', '.png', 'MoneyMan'],
    ['mts', '.png', 'МТС Банк'], ['nebus', '.png', 'Небус'],
    ['otp', '.png', 'ОТП Банк'], ['ozon', '.png', 'Озон Банк'],
    ['platiza', '.png', 'Платиза'], ['prostoyvopros', '.png', 'Простой вопрос'],
    ['psb', '.png', 'ПСБ'], ['renessans', '.png', 'Ренессанс'],
    ['sber', '.svg', 'Сбербанк'], ['smsfinance', '.png', 'СМС Финанс'],
    ['sovcom', '.png', 'Совкомбанк'], ['tbank', '.png', 'Т-Банк'],
    ['turbozaim', '.png', 'Турбозайм'], ['ubrr', '.png', 'УБРиР'],
    ['vtb', '.png', 'ВТБ'], ['webbankir', '.png', 'Webbankir'],
    ['zaymer', '.png', 'Займер'], ['zenit', '.png', 'Зенит'],
    /* Пресеты, докачанные для групп «Банки» и «МФО» (favicon 128px). */
    ['bspb', '.png', 'Банк Санкт-Петербург'], ['carmoney', '.png', 'CarMoney'],
    ['halva', '.png', 'Халва'], ['lockobank', '.png', 'Локо-Банк'],
    ['modulbank', '.png', 'Модульбанк'], ['nskbl', '.png', 'Банк Левобережный'],
    ['pochtabank', '.png', 'Почта Банк'], ['raiffeisen', '.png', 'Райффайзен Банк'],
    ['rshb', '.png', 'Россельхозбанк'], ['tochka', '.png', 'Точка'],
    ['uralsib', '.png', 'Уралсиб'], ['webzaim', '.png', 'Веб-займ']
  ];

  /* Готовые логотипы банков и МФО: те же файлы из папки logos, разложенные
     по группам, чтобы не искать нужный банк в общем списке. value — имя
     файла без расширения, как и у остальных пунктов селекта. */
  var URL_LOGO = '__url__';
  var PRESETS = [
    { label: 'Банки', items: [
      ['ozon', 'Ozon Банк'], ['akbars', 'Ак Барс Банк'], ['alfa', 'Альфа-Банк'],
      ['zenit', 'Банк Зенит'], ['nskbl', 'Банк Левобережный'], ['bspb', 'Банк Санкт-Петербург'],
      ['vtb', 'ВТБ'], ['gpb', 'Газпромбанк'], ['lockobank', 'Локо-Банк'],
      ['modulbank', 'Модульбанк'], ['mts', 'МТС Банк'], ['otp', 'ОТП Банк'],
      ['pochtabank', 'Почта Банк'], ['psb', 'ПСБ'], ['raiffeisen', 'Райффайзен Банк'],
      ['renessans', 'Ренессанс Банк'], ['rshb', 'Россельхозбанк'], ['sber', 'Сбербанк'],
      ['sovcom', 'Совкомбанк'], ['tbank', 'Т-Банк'], ['tochka', 'Точка'],
      ['ubrr', 'УБРиР'], ['uralsib', 'Уралсиб'], ['halva', 'Халва']
    ] },
    { label: 'МФО', items: [
      ['carmoney', 'CarMoney'], ['moneyman', 'MoneyMan'], ['bistrodengi', 'Быстроденьги'],
      ['webzaim', 'Веб-займ'], ['webbankir', 'Веббанкир'], ['dozarplaty', 'До Зарплаты'],
      ['ekapusta', 'еКапуста'], ['zaymer', 'Займер'], ['limezaim', 'Лайм-Займ'],
      ['migcredit', 'МигКредит'], ['platiza', 'Платиза'], ['turbozaim', 'Турбозайм']
    ] }
  ];

  function isPreset(key) {
    for (var g = 0; g < PRESETS.length; g++)
      for (var i = 0; i < PRESETS[g].items.length; i++)
        if (PRESETS[g].items[i][0] === key) return true;
    return false;
  }

  function isHttpLogo(v) { return /^https?:\/\//i.test(String(v || '')); }

  /* Тёмная буква на светлой подложке, белая — на тёмной. Тот же расчёт,
     что и в script.js: клиент выбирает цвет плашки сам, и жёлтый Т-Банк
     с белой буквой давал 1.3:1. */
  function monoInk(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return '#FFFFFF';
    var v = m[1], parts = [], i, c;
    for (i = 0; i < 3; i++) {
      c = parseInt(v.substr(i * 2, 2), 16) / 255;
      parts.push(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    var lum = 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    return lum > 0.18 ? '#0B0B0E' : '#FFFFFF';
  }

  /* ------------------------------------------------------------ СОСТОЯНИЕ */

  var state = { content: null, offers: null, library: null };
  var editing = -1;   /* индекс редактируемого оффера, -1 — новый */
  var activeCat = 'all';   /* выбранная категория-фильтр в списке офферов */

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function load() {
    var draft = null;
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw);
    } catch (e) { draft = null; }

    if (draft && Array.isArray(draft.offers) && draft.content) {
      state.content = draft.content;
      state.offers = draft.offers;
      state.library = Array.isArray(draft.library) ? draft.library : [];
    } else {
      state.content = clone(CONTENT);
      state.offers = clone(OFFERS);
      /* Старый data.js может быть собран до появления библиотеки. */
      state.library = (typeof LIBRARY !== 'undefined' && Array.isArray(LIBRARY)) ? clone(LIBRARY) : [];
    }
  }

  function persist(message) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch (e) {
      showError(['Браузер не дал сохранить правки. Обычно это режим инкогнито ' +
                 'или переполненное хранилище. Скачайте data.js прямо сейчас, ' +
                 'иначе правки потеряются при перезагрузке.']);
      return;
    }
    clearError();
    say(message);
    renderExport();
  }

  /* Пока открыто модальное окно, всё за его пределами для скринридера
     не существует: сообщение в #status при открытом «Оффере» уходило
     в никуда. Поэтому ищем контейнер внутри открытого окна. */
  function openDialog() {
    var dialogs = document.querySelectorAll('dialog[open]');
    return dialogs.length ? dialogs[dialogs.length - 1] : null;
  }

  function msgBox(kind) {
    var dlg = openDialog();
    var inside = dlg && dlg.querySelector('[data-box="' + kind + '"]');
    return inside || $(kind === 'error' ? 'error-box' : 'status');
  }

  var sayTimer = null;

  function say(message) {
    var node = msgBox('status');
    if (!node || !message) return;
    /* Одинаковый текст подряд не объявится — сначала чистим. Задержка
       не нулевая: сразу после сохранения переезжает фокус, а переход
       фокуса сбрасывает очередь вежливых объявлений у NVDA и JAWS. */
    node.textContent = '';
    window.clearTimeout(sayTimer);
    sayTimer = window.setTimeout(function () { node.textContent = message; }, 150);
  }

  function showError(list) {
    var node = msgBox('error');
    /* Сначала показываем узел, потом наполняем: наоборот текст ложится
       в спрятанный элемент, и объявления не случается. */
    node.hidden = false;
    node.textContent = '';
    node.appendChild(el('strong', null, list.length === 1
      ? 'Не получилось сохранить — одна ошибка:'
      : 'Не получилось сохранить — ошибок: ' + list.length));
    var ul = el('ul');
    list.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    node.appendChild(ul);
    node.focus();
  }

  function clearError() {
    [$('error-box'), document.querySelector('[data-box="error"]')].forEach(function (node) {
      if (!node) return;
      node.hidden = true;
      node.textContent = '';
    });
  }

  function catById(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return null;
  }

  /* Селект логотипа собирается через innerHTML — тексты приходят из имён
     файлов и названий офферов, экранируем как в любом чужом тексте. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------- БИБЛИОТЕКА КАРТИНОК
     Загруженные картинки живут в state.library и уезжают в data.js вместе
     с каталогом: одну картинку можно выбрать для любого оффера, а не только
     для того, где её загрузили. У оффера в поле logo стоит «lib:имя». */

  function libFind(name) {
    var lib = state.library || [];
    for (var i = 0; i < lib.length; i++) if (lib[i].name === name) return lib[i];
    return null;
  }

  function extFromDataUrl(u) {
    if (u.indexOf('data:image/svg+xml') === 0) return 'svg';
    if (u.indexOf('data:image/jpeg') === 0) return 'jpg';
    if (u.indexOf('data:image/webp') === 0) return 'webp';
    return 'png';
  }

  /* Что показать в <img src>: data: и http(s)-ссылки как есть, lib: из
     библиотеки, остальное — файл из папки logos. Пустая строка — плашка. */
  function logoSrc(logo, logoExt) {
    if (!logo) return '';
    if (logo.indexOf('data:') === 0) return logo;
    if (isHttpLogo(logo)) return logo;
    if (logo.indexOf('lib:') === 0) {
      var it = libFind(logo.slice(4));
      return it ? it.data : '';
    }
    return 'logos/' + logo + (logoExt || extOf(logo));
  }

  /* Раньше загруженная картинка лежала прямо в оффере строкой data:…
     Переносим такие в библиотеку, чтобы ими можно было пользоваться
     и в других офферах. Имя — из названия оффера. */
  function migrateLogos() {
    var moved = 0;
    state.library = state.library || [];
    state.offers.forEach(function (o) {
      if (!o.logo || o.logo.indexOf('data:') !== 0) return;
      moved++;
      var base = String(o.title || '').replace(/[<>]/g, '').trim().slice(0, 40) ||
                 'картинка-' + moved;
      var name = base, n = 2;
      while (libFind(name)) name = base + '-' + (n++);
      state.library.push({ name: name, ext: extFromDataUrl(o.logo), data: o.logo });
      o.logo = 'lib:' + name;
      delete o.logoExt;
    });
    return moved;
  }

  /* ------------------------------------------------------- ФОРМА ОФФЕРА */

  function fillSelects() {
    var cat = $('f-cat');
    CATEGORIES.forEach(function (c) {
      if (c.id === 'all') return;   /* «Все офферы» — не категория товара */
      var o = el('option', null, c.label);
      o.value = c.id;
      cat.appendChild(o);
    });

    syncLogoSelect('');
  }

  function extOf(file) {
    for (var i = 0; i < LOGOS.length; i++) if (LOGOS[i][0] === file) return LOGOS[i][1];
    return '.png';
  }

  /* Пункты селекта логотипа: пустой, «Мои картинки» из библиотеки, группы
     «Банки» и «МФО», ссылка из интернета, остальные файлы из папки logos.
     Если в данных стоит имя, которого нигде нет, не теряем его молча —
     показываем пунктом с пометкой. */
  function logoOptions(sel) {
    sel = sel || '';
    var isUrl = isHttpLogo(sel);
    var opts = '<option value=""' + (sel ? '' : ' selected') + '>— без логотипа —</option>';

    var lib = state.library || [];
    if (lib.length) {
      opts += '<optgroup label="Мои картинки">' + lib.map(function (it) {
        var v = 'lib:' + it.name;
        return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' +
               esc(it.name) + '</option>';
      }).join('') + '</optgroup>';
    }

    PRESETS.forEach(function (g) {
      opts += '<optgroup label="' + esc(g.label) + '">' + g.items.map(function (it) {
        return '<option value="' + esc(it[0]) + '"' + (it[0] === sel ? ' selected' : '') + '>' +
               esc(it[1]) + '</option>';
      }).join('') + '</optgroup>';
    });

    /* Ссылка на чужой хостинг: файл не хранится у нас, в logo лежит URL. */
    opts += '<option value="' + URL_LOGO + '"' + (isUrl ? ' selected' : '') + '>По ссылке из интернета…</option>';

    if (sel.indexOf('data:') === 0) {
      /* Немигрированный черновик: картинка лежит прямо в оффере. */
      opts += '<option value="' + esc(sel) + '" selected>своя картинка (в оффере)</option>';
    } else if (sel.indexOf('lib:') === 0 && !libFind(sel.slice(4))) {
      opts += '<option value="' + esc(sel) + '" selected>' + esc(sel.slice(4)) + ' (нет в библиотеке)</option>';
    } else if (sel && !isUrl && sel.indexOf('lib:') !== 0 && sel !== URL_LOGO) {
      var known = false;
      for (var i = 0; i < LOGOS.length; i++) if (LOGOS[i][0] === sel) { known = true; break; }
      if (!known) opts += '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (файла нет)</option>';
    }

    /* Файлы, не попавшие в группы, идут общим списком, как и раньше. */
    return opts + LOGOS.filter(function (l) { return !isPreset(l[0]); }).map(function (l) {
      return '<option value="' + esc(l[0]) + '"' + (l[0] === sel ? ' selected' : '') + '>' +
             esc(l[2] + ' (' + l[0] + l[1] + ')') + '</option>';
    }).join('');
  }

  /* Пересобираем содержимое, но не сам узел селекта: замена узла роняет
     фокус и слушатели. */
  function syncLogoSelect(sel) {
    $('f-logo').innerHTML = logoOptions(sel);
  }

  /* Поле «Ссылка на картинку» видно только при пункте «По ссылке из
     интернета…». Прячем обёртку через hidden; если фокус в этот момент
     внутри поля, сначала возвращаем его селекту — иначе он падает на body.
     logo передаётся при заполнении формы: URL из оффера встаёт в поле. */
  function syncUrlField(logo) {
    var wrap = $('f-logo-url-field');
    var input = $('f-logo-url');
    if (typeof logo === 'string') input.value = isHttpLogo(logo) ? logo : '';
    var show = $('f-logo').value === URL_LOGO;
    if (show) {
      wrap.hidden = false;
    } else {
      if (wrap.contains(document.activeElement)) $('f-logo').focus();
      fieldError(input, '');
      wrap.hidden = true;
    }
  }

  /* Превью и ссылка «Скачать текущую картинку» показывают то, что сейчас
     выбрано в селекте. href, имя файла и подпись меняются только вместе:
     устаревшее имя при новой картинке хуже, чем ничего. */
  function updateLogoAids() {
    var sel = $('f-logo').value;
    var it = null;
    if (sel.indexOf('lib:') === 0) it = libFind(sel.slice(4));
    else if (sel.indexOf('data:') === 0) it = { name: 'картинка', ext: extFromDataUrl(sel), data: sel };
    else if (sel === URL_LOGO) {
      /* Картинка по ссылке: превью показываем, а «скачать» не предлагаем —
         файл и так лежит в интернете по этому адресу. */
      var u = $('f-logo-url').value.trim();
      if (isHttpLogo(u)) it = { data: u, remote: true };
    }

    var box = $('f-logo-preview');
    if (it) {
      $('f-logo-preview-img').src = it.data;
      box.hidden = false;
    } else {
      $('f-logo-preview-img').removeAttribute('src');
      box.hidden = true;
    }

    var dl = $('f-logo-dl');
    if (it && it.remote) {
      dl.textContent = '';
    } else if (it) {
      var fname = it.name + '.' + (it.ext || 'png');
      dl.innerHTML = '<a class="dl" download="' + esc(fname) + '" href="' + it.data + '">' +
        'Скачать текущую картинку<span class="visually-hidden"> (' + esc(fname) + ')</span></a>';
    } else {
      dl.textContent = '';
    }
  }

  function logoFileReset() {
    var input = $('f-logo-file');
    input.value = '';
    input.removeAttribute('aria-invalid');
    $('f-logo-file-err').textContent = '';
  }

  /* Свою картинку вписываем в 512px на канвасе: фотографии с телефона
     весят мегабайты, а в data.js они поедут текстом. SVG не трогаем —
     это вектор, канвас его только испортит. */
  function readLogoFile(file, done, fail) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return fail('Файл больше 4 МБ. Сожмите картинку и попробуйте снова.');
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) return fail('Нужна картинка: PNG, JPG, WebP или SVG.');

    var fr = new FileReader();
    fr.onerror = function () { fail('Не получилось прочитать файл.'); };
    fr.onload = function () {
      if (file.type === 'image/svg+xml') return done(fr.result);
      var img = new Image();
      img.onerror = function () { fail('Файл не открылся как картинка.'); };
      img.onload = function () {
        var k = Math.min(1, 512 / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * k));
        var h = Math.max(1, Math.round(img.height * k));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        done(file.type === 'image/jpeg' ? c.toDataURL('image/jpeg', .85) : c.toDataURL('image/png'));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* Поля условий зависят от категории: у займа ставка, у РКО — открытие
     счёта. Держать все поля сразу — форма превращается в анкету на 15 строк. */
  function renderSpecFields(catId, values) {
    var box = $('spec-fields');
    box.textContent = '';

    var keys = SPEC_ORDER[catId];
    if (!keys) {
      box.appendChild(el('p', 'admin-hint', 'Сначала выберите категорию — поля условий зависят от неё.'));
      return;
    }

    keys.forEach(function (key) {
      var p = el('p', 'field');
      var id = 'f-spec-' + key;
      var label = el('label', null, SPEC_LABELS[key] || key);
      label.htmlFor = id;
      var input = el('input');
      input.type = 'text';
      input.id = id;
      input.dataset.spec = key;
      input.value = (values && values[key]) || '';
      p.appendChild(label);
      p.appendChild(input);
      box.appendChild(p);
    });

    var hint = el('p', 'admin-hint',
      'Пустое поле просто не покажется на карточке. Цифру, в которой не уверены, ' +
      'лучше не писать вовсе: неточные условия в рекламе — это претензии к вам, а не к банку.');
    box.appendChild(hint);
  }

  function fieldError(input, text) {
    var wrap = input.closest('.field');
    var box = wrap.querySelector('.field-error');
    if (!box) {
      box = el('span', 'field-error');
      box.id = input.id + '-error';
      wrap.appendChild(box);
    }
    box.textContent = text || '';
    if (text) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby',
        [input.dataset.hint || '', box.id].filter(Boolean).join(' '));
    } else {
      input.removeAttribute('aria-invalid');
      if (input.dataset.hint) input.setAttribute('aria-describedby', input.dataset.hint);
      else input.removeAttribute('aria-describedby');
    }
  }

  /* Открыть окно редактирования: нативный dialog сам ловит фокус и Escape
     и на закрытии вернёт фокус на кнопку, с которой открыли. */
  function openOfferDialog() {
    clearError();
    /* Ошибки прошлого открытия снимаем: иначе у корректно заполненного
       оффера поля встречают человека красными рамками. */
    ['f-cat', 'f-partner', 'f-title', 'f-url'].forEach(function (id) { fieldError($(id), ''); });
    var d = $('offer-dialog');
    if (!d.open) d.showModal();
    $('f-cat').focus();
  }

  function resetForm() {
    editing = -1;
    $('offer-form').reset();
    syncLogoSelect('');
    syncUrlField('');
    updateLogoAids();
    logoFileReset();
    $('f-tone').value = '#2A2A32';
    renderSpecFields('', null);
    $('form-title').textContent = 'Новый оффер';
    ['f-cat', 'f-partner', 'f-title', 'f-url'].forEach(function (id) { fieldError($(id), ''); });
    clearError();
    renderList();
  }

  function editOffer(i) {
    var o = state.offers[i];
    if (!o) return;
    editing = i;

    $('f-cat').value = o.cat || '';
    $('f-partner').value = o.partner || '';
    $('f-title').value = o.title || '';
    $('f-tag').value = o.tag || '';
    $('f-hot').checked = !!o.hot;
    /* Логотип бывает файлом из папки, а бывает картинкой из библиотеки —
       селект пересобирается под то, что стоит у оффера. */
    syncLogoSelect(o.logo || '');
    syncUrlField(o.logo || '');
    updateLogoAids();
    logoFileReset();
    $('f-tone').value = o.tone || '#2A2A32';
    $('f-url').value = o.url || '';
    renderSpecFields(o.cat, o);

    $('form-title').textContent = 'Оффер: ' + (o.partner || '') + ' — ' + (o.title || '');
    openOfferDialog();
  }

  function readForm() {
    var offer = {
      cat: $('f-cat').value,
      partner: $('f-partner').value.trim(),
      title: $('f-title').value.trim(),
      url: $('f-url').value.trim()
    };
    var tag = $('f-tag').value.trim();
    if (tag) offer.tag = tag;
    if ($('f-hot').checked) offer.hot = true;

    var logo = $('f-logo').value;
    if (logo === URL_LOGO) {
      /* Картинка по ссылке: в logo кладём URL как есть. Пустое поле —
         значит логотипа нет, встанет плашка с буквой. */
      var picUrl = $('f-logo-url').value.trim();
      if (picUrl) offer.logo = picUrl;
    } else if (logo.indexOf('lib:') === 0 || logo.indexOf('data:') === 0) {
      offer.logo = logo;    /* картинка из библиотеки или data: — расширение не нужно */
    } else if (logo) {
      offer.logo = logo;
      var ext = extOf(logo);
      if (ext !== '.png') offer.logoExt = ext;
    }
    var tone = $('f-tone').value;
    if (tone && tone.toLowerCase() !== '#2a2a32') offer.tone = tone.toUpperCase();

    document.querySelectorAll('#spec-fields input[data-spec]').forEach(function (input) {
      var v = input.value.trim();
      if (v) offer[input.dataset.spec] = v;
    });

    return offer;
  }

  function validate(offer) {
    var errors = [];

    function bad(id, text) {
      fieldError($(id), text);
      errors.push(text);
    }
    ['f-cat', 'f-partner', 'f-title', 'f-url'].forEach(function (id) { fieldError($(id), ''); });

    if (!offer.cat) bad('f-cat', 'Не выбрана категория оффера.');
    if (!offer.partner) bad('f-partner', 'Не заполнено название банка или МФО.');
    if (!offer.title) bad('f-title', 'Не заполнено название продукта.');

    if (!offer.url) {
      bad('f-url', 'Не заполнена ссылка. Без неё кнопке некуда вести.');
    } else if (!/^https?:\/\/.+/i.test(offer.url)) {
      bad('f-url', 'Ссылка должна начинаться с https:// и вести на страницу партнёра.');
    }

    /* Ссылка на картинку проверяется только когда выбран пункт «По ссылке». */
    if ($('f-logo').value === URL_LOGO) {
      fieldError($('f-logo-url'), '');
      var picUrl = $('f-logo-url').value.trim();
      if (picUrl && !/^https?:\/\/.+/i.test(picUrl)) {
        bad('f-logo-url', 'Ссылка на картинку должна начинаться с https://.');
      }
    }
    return errors;
  }

  /* ------------------------------------------------------------- СПИСОК */

  /* Кнопки-категории над списком — тот же класс .filter, что и на сайте,
     поэтому вид и цвет совпадают с главной. Категория без офферов кнопки
     не получает; если выбранная опустела, возвращаемся к «Все офферы». */
  function renderCatFilters() {
    var row = $('admin-filters');
    if (!row) return;

    var available = CATEGORIES.filter(function (c) {
      return c.id === 'all' || state.offers.some(function (o) { return o.cat === c.id; });
    });
    if (activeCat !== 'all' && !available.some(function (c) { return c.id === activeCat; })) {
      activeCat = 'all';
    }

    row.textContent = '';
    available.forEach(function (cat) {
      var btn = el('button', 'filter');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', cat.id === activeCat ? 'true' : 'false');
      btn.dataset.cat = cat.id;
      var dot = el('span', 'filter__dot');
      dot.setAttribute('aria-hidden', 'true');
      btn.appendChild(dot);
      btn.appendChild(el('span', null, cat.label));
      btn.addEventListener('click', function () {
        if (activeCat === cat.id) return;
        activeCat = cat.id;
        row.querySelectorAll('.filter').forEach(function (b) {
          b.setAttribute('aria-pressed', b.dataset.cat === activeCat ? 'true' : 'false');
        });
        renderList();
        /* На сайте смена категории озвучивается, в админке не озвучивалась:
           человек нажимал кнопку и не знал, что список под ней сменился. */
        say($('offers-counter').textContent);
      });
      row.appendChild(btn);
    });
  }

  function renderList() {
    var box = $('offer-list');
    box.textContent = '';

    var total = state.offers.length;
    var shown = activeCat === 'all'
      ? total
      : state.offers.filter(function (o) { return o.cat === activeCat; }).length;
    var catName = activeCat === 'all'
      ? 'Все офферы'
      : (catById(activeCat) ? catById(activeCat).label : activeCat);

    $('offers-counter').textContent = !total
      ? 'Каталог пуст. Нажмите «Добавить оффер».'
      : activeCat === 'all'
        ? 'Все офферы: ' + total + ' шт.'
        : catName + ': ' + shown + ' шт. (всего в каталоге ' + total + ')';

    if (total && !shown) {
      box.appendChild(el('li', 'admin-list__empty',
        'В категории «' + catName + '» пока нет офферов. Нажмите «Добавить оффер».'));
      return;
    }

    state.offers.forEach(function (o, i) {
      if (activeCat !== 'all' && o.cat !== activeCat) return;

      var li = el('li', 'admin-item');
      li.dataset.index = i;

      var src = logoSrc(o.logo, o.logoExt);
      if (src) {
        var tile = el('div', 'admin-item__logo');
        var img = el('img');
        img.src = src;
        img.alt = '';
        tile.appendChild(img);
        li.appendChild(tile);
      } else {
        var mono = el('div', 'admin-item__mono', (o.partner || '?').charAt(0).toUpperCase());
        var tone = o.tone || '#2A2A32';
        mono.style.background = tone;
        /* Как на сайте: на светлой подложке белая буква не видна. */
        mono.style.color = monoInk(tone);
        mono.setAttribute('aria-hidden', 'true');
        li.appendChild(mono);
      }

      var text = el('div');
      text.appendChild(el('p', 'admin-item__partner', o.partner));
      text.appendChild(el('p', 'admin-item__title', o.title));
      var cat = catById(o.cat);
      text.appendChild(el('span', 'admin-item__cat', cat ? cat.label : o.cat));
      if (!o.url) text.appendChild(el('span', 'admin-item__no-url', 'нет ссылки'));
      li.appendChild(text);

      var tools = el('div', 'admin-item__tools');
      tools.appendChild(toolBtn('Изменить', o, i, 'edit'));
      tools.appendChild(toolBtn('Удалить', o, i, 'del'));
      li.appendChild(tools);

      box.appendChild(li);
    });
  }

  var ICONS = {
    edit: '<path d="M2 14h12M3 11.2 11.1 3.1a1.4 1.4 0 0 1 2 0l.8.8a1.4 1.4 0 0 1 0 2L5.8 14H3v-2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    up:   '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    del:  '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5 5 13.5h6l.5-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  function toolBtn(label, offer, index, kind, disabled) {
    var b = el('button', 'icon-btn' + (kind === 'del' ? ' icon-btn--danger' : ''));
    b.type = 'button';
    /* Имя кнопки называет конкретный оффер: двадцать кнопок «Удалить»
       подряд в списке — это ребус, а не интерфейс. */
    b.setAttribute('aria-label', label + ': ' + offer.partner + ' — ' + offer.title);
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + ICONS[kind] + '</svg>';
    if (disabled) b.disabled = true;

    b.addEventListener('click', function () {
      if (kind === 'edit') return editOffer(index);
      if (kind === 'del') return askDelete(index);
      move(index, kind === 'up' ? -1 : 1);
    });
    return b;
  }

  function move(index, delta) {
    var to = index + delta;
    if (to < 0 || to >= state.offers.length) return;
    var item = state.offers.splice(index, 1)[0];
    state.offers.splice(to, 0, item);
    if (editing === index) editing = to;
    persist('«' + item.partner + ' — ' + item.title + '» теперь на позиции ' + (to + 1) + '.');
    renderList();
    /* Фокус возвращаем на ту же кнопку у переехавшего оффера, иначе после
       нажатия он улетает на body и продолжать с клавиатуры невозможно. */
    var items = $('offer-list').children;
    if (items[to]) {
      var btn = items[to].querySelector(delta < 0 ? '[aria-label^="Поднять"]' : '[aria-label^="Опустить"]');
      if (btn && !btn.disabled) btn.focus();
      else items[to].querySelector('.icon-btn').focus();
    }
  }

  /* Одно окно подтверждения на всю админку, обработчики вешаются один раз.
     Раньше их вешали при каждом вызове, а снимали только по клику на
     «Отмена» или «Удалить»: закрытие через Escape оставляло живой
     обработчик со старым номером оффера, и следующее подтверждённое
     удаление сносило заодно тот, прошлый. */
  var confirmAction = null;

  (function initConfirm() {
    var dlg = $('confirm');
    if (!dlg) return;

    $('confirm-ok').addEventListener('click', function () {
      var run = confirmAction;
      confirmAction = null;
      dlg.close();
      if (run) run();
    });
    $('confirm-cancel').addEventListener('click', function () { dlg.close(); });
    /* Escape и крестик закрывают окно сами — здесь только гасим действие. */
    dlg.addEventListener('close', function () { confirmAction = null; });
  })();

  function askConfirm(opts) {
    var dlg = $('confirm');
    $('confirm-title').textContent = opts.title;
    $('confirm-text').textContent = opts.text;
    $('confirm-ok').querySelector('.glass__label').textContent = opts.ok;
    confirmAction = opts.onOk;
    dlg.showModal();
    /* Фокус на безопасной кнопке: Enter по привычке ничего не удалит. */
    $('confirm-cancel').focus();
  }

  function askDelete(index) {
    var o = state.offers[index];
    askConfirm({
      title: 'Удалить оффер «' + o.partner + ' — ' + o.title + '»?',
      text: 'Он пропадёт из каталога. На сайте исчезнет после публикации.',
      ok: 'Удалить оффер',
      onOk: function () {
        state.offers.splice(index, 1);
        if (editing === index) resetForm();
        else if (editing > index) editing--;
        persist('Оффер «' + o.partner + ' — ' + o.title + '» удалён.');
        renderList();
        focusAfterRemoval(index);
      }
    });
  }

  /* Номер оффера — это его место в общем каталоге, а на экране показан
     только один раздел. Поэтому следующую строку ищем по разметке, а не
     по номеру: иначе фокус уезжает на чужой оффер или на body. */
  function focusAfterRemoval(index) {
    var items = $('offer-list').querySelectorAll('.admin-item');
    var target = null;
    for (var i = 0; i < items.length; i++) {
      if (Number(items[i].dataset.index) >= index) { target = items[i]; break; }
    }
    if (!target && items.length) target = items[items.length - 1];
    var btn = target && target.querySelector('.icon-btn');
    if (btn) btn.focus();
    else $('list-title').focus();
  }

  /* -------------------------------------------------------------- ТЕКСТЫ */

  function textInput(id, label, value, rows) {
    var p = el('p', 'field');
    var l = el('label', null, label);
    l.htmlFor = id;
    var input = rows ? el('textarea') : el('input');
    if (!rows) input.type = 'text'; else input.rows = rows;
    input.id = id;
    input.value = value || '';
    p.appendChild(l);
    p.appendChild(input);
    return p;
  }

  function renderTextsForm() {
    var c = state.content;

    $('t-badge').value = c.badge || '';
    $('t-title').value = c.title || '';
    $('t-leadtitle').value = c.leadTitle || '';
    $('t-lead').value = c.lead || '';
    $('t-how-title').value = (c.how && c.how.title) || '';
    $('t-how-lead').value = (c.how && c.how.lead) || '';
    $('t-why-title').value = (c.why && c.why.title) || '';
    $('t-why-lead').value = (c.why && c.why.lead) || '';
    $('t-faq-title').value = (c.faq && c.faq.title) || '';
    $('t-faq-lead').value = (c.faq && c.faq.lead) || '';
    $('t-disclaimer').value = (c.footer && c.footer.disclaimer) || '';
    $('t-legal').value = (c.footer && c.footer.legal) || '';

    var stats = $('stats-fields');
    stats.textContent = '';
    (c.stats || []).forEach(function (s, i) {
      var g = el('div', 'group');
      g.appendChild(el('h4', null, 'Цифра ' + (i + 1)));
      g.appendChild(textInput('t-stat-v-' + i, 'Значение', s.value));
      g.appendChild(textInput('t-stat-l-' + i, 'Подпись', s.label));
      stats.appendChild(g);
    });

    var steps = $('steps-fields');
    steps.textContent = '';
    ((c.how && c.how.steps) || []).forEach(function (s, i) {
      var g = el('div', 'group');
      g.appendChild(el('h4', null, 'Шаг ' + (i + 1)));
      g.appendChild(textInput('t-step-t-' + i, 'Заголовок шага', s.title));
      g.appendChild(textInput('t-step-x-' + i, 'Текст шага', s.text, 3));
      steps.appendChild(g);
    });

    var reasons = $('reasons-fields');
    reasons.textContent = '';
    ((c.why && c.why.items) || []).forEach(function (r, i) {
      var g = el('div', 'group');
      g.appendChild(el('h4', null, 'Причина ' + (i + 1)));
      g.appendChild(textInput('t-why-t-' + i, 'Заголовок', r.title));
      g.appendChild(textInput('t-why-x-' + i, 'Текст', r.text, 3));
      reasons.appendChild(g);
    });

    renderFaqFields();
  }

  function renderFaqFields() {
    var box = $('faq-fields');
    box.textContent = '';
    ((state.content.faq && state.content.faq.items) || []).forEach(function (item, i) {
      var g = el('div', 'group');
      g.appendChild(el('h4', null, 'Вопрос ' + (i + 1)));
      g.appendChild(textInput('t-faq-q-' + i, 'Вопрос', item.q));
      g.appendChild(textInput('t-faq-a-' + i, 'Ответ', item.a, 3));

      var actions = el('p', 'admin-actions');
      var del = el('button', 'glass glass--sm');
      del.type = 'button';
      del.setAttribute('aria-label', 'Удалить вопрос: ' + item.q);
      del.appendChild(el('span', 'glass__label', 'Удалить вопрос'));
      del.addEventListener('click', function () {
        askConfirm({
          title: 'Удалить вопрос «' + item.q + '»?',
          text: 'Вопрос и ответ к нему пропадут со страницы. Отменить это можно ' +
                'только кнопкой «Отменить все правки» в разделе «Публикация».',
          ok: 'Удалить вопрос',
          onOk: function () {
            collectTexts();
            state.content.faq.items.splice(i, 1);
            persist('Вопрос удалён. Не забудьте опубликовать изменения.');
            renderTextsForm();
            $('faq-add').focus();
          }
        });
      });
      actions.appendChild(del);
      g.appendChild(actions);

      box.appendChild(g);
    });
  }

  /* Собирает всё, что напечатано в форме текстов, обратно в состояние. */
  function collectTexts() {
    var c = state.content;

    c.badge = $('t-badge').value.trim();
    c.title = $('t-title').value.trim();
    c.leadTitle = $('t-leadtitle').value.trim();
    c.lead = $('t-lead').value.trim();

    (c.stats || []).forEach(function (s, i) {
      var v = $('t-stat-v-' + i), l = $('t-stat-l-' + i);
      if (v) s.value = v.value.trim();
      if (l) s.label = l.value.trim();
    });

    c.how = c.how || {};
    c.how.title = $('t-how-title').value.trim();
    c.how.lead = $('t-how-lead').value.trim();
    (c.how.steps || []).forEach(function (s, i) {
      var t = $('t-step-t-' + i), x = $('t-step-x-' + i);
      if (t) s.title = t.value.trim();
      if (x) s.text = x.value.trim();
    });

    c.why = c.why || {};
    c.why.title = $('t-why-title').value.trim();
    c.why.lead = $('t-why-lead').value.trim();
    (c.why.items || []).forEach(function (r, i) {
      var t = $('t-why-t-' + i), x = $('t-why-x-' + i);
      if (t) r.title = t.value.trim();
      if (x) r.text = x.value.trim();
    });

    c.faq = c.faq || {};
    c.faq.title = $('t-faq-title').value.trim();
    c.faq.lead = $('t-faq-lead').value.trim();
    (c.faq.items || []).forEach(function (item, i) {
      var q = $('t-faq-q-' + i), a = $('t-faq-a-' + i);
      if (q) item.q = q.value.trim();
      if (a) item.a = a.value.trim();
    });

    c.footer = c.footer || {};
    c.footer.disclaimer = $('t-disclaimer').value.trim();
    c.footer.legal = $('t-legal').value.trim();
  }

  /* ----------------------------------------------------------- ЭКСПОРТ */

  function q(value) {
    return "'" + String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, '\\n') + "'";
  }

  /* Открываем наружу для модуля публикации (publish.js): он собирает тот же
     файл, что уходит в «Скачать data.js», и отправляет его на сайт. */
  window.SITE_ADMIN = { buildDataFile: function () { return buildDataFile(); } };

  function buildDataFile() {
    var c = state.content;
    var out = [];

    out.push('/* =========================================================================');
    out.push('   ФинВыбор (maeb-fin.ru) — каталог и тексты сайта.');
    out.push('   Файл собран админкой (admin.html). Можно править и руками.');
    out.push('   ========================================================================= */');
    out.push('');
    out.push('const BRAND = ' + JSON.stringify(typeof BRAND === 'object' ? BRAND : {}, null, 2).replace(/"([^"]+)":/g, '$1:') + ';');
    out.push('');
    out.push('const WORK_SINCE = ' + (typeof WORK_SINCE === 'number' ? WORK_SINCE : 2025) + ';');
    out.push('');
    out.push('const CONTACT_TELEGRAM = ' + q(typeof CONTACT_TELEGRAM === 'string' ? CONTACT_TELEGRAM : '') + ';');
    out.push('');

    out.push('const CATEGORIES = [');
    CATEGORIES.forEach(function (cat, i) {
      out.push('  { id: ' + q(cat.id) + ', label: ' + q(cat.label) +
               ', short: ' + q(cat.short || cat.label) + ', cta: ' + q(cat.cta) + ' }' +
               (i === CATEGORIES.length - 1 ? '' : ','));
    });
    out.push('];');
    out.push('');

    out.push('const SPEC_LABELS = {');
    var lk = Object.keys(SPEC_LABELS);
    lk.forEach(function (k, i) {
      out.push('  ' + k + ': ' + q(SPEC_LABELS[k]) + (i === lk.length - 1 ? '' : ','));
    });
    out.push('};');
    out.push('');

    out.push('const SPEC_ORDER = {');
    var ok = Object.keys(SPEC_ORDER);
    ok.forEach(function (k, i) {
      out.push('  ' + k + ': [' + SPEC_ORDER[k].map(q).join(', ') + ']' + (i === ok.length - 1 ? '' : ','));
    });
    out.push('};');
    out.push('');

    /* Тексты: обычный JSON, только кавычки у ключей убраны — так файл
       читается человеком, а не только движком. */
    out.push('const CONTENT = ' + JSON.stringify(c, null, 2).replace(/^(\s*)"([A-Za-z_]\w*)":/gm, '$1$2:') + ';');
    out.push('');

    /* Картинки, загруженные через админку. Выбираются в селекте логотипа
       группой «Мои картинки», у оффера тогда стоит logo: 'lib:имя'. */
    out.push('const LIBRARY = [');
    (state.library || []).forEach(function (it, i) {
      out.push('  { name: ' + q(it.name) + ', ext: ' + q(it.ext || 'png') +
               ', data: ' + q(it.data) + ' }' +
               (i === state.library.length - 1 ? '' : ','));
    });
    out.push('];');
    out.push('');

    out.push('const OFFERS = [');
    state.offers.forEach(function (o, i) {
      var parts = [];
      ['cat', 'partner', 'title', 'logo', 'logoExt', 'tone', 'tag'].forEach(function (k) {
        if (o[k]) parts.push(k + ': ' + q(o[k]));
      });
      if (o.hot) parts.push('hot: true');
      parts.push('url: ' + q(o.url));
      (SPEC_ORDER[o.cat] || []).forEach(function (k) {
        if (o[k]) parts.push(k + ': ' + q(o[k]));
      });
      out.push('  { ' + parts.join(', ') + ' }' + (i === state.offers.length - 1 ? '' : ','));
    });
    out.push('];');
    out.push('');

    return out.join('\n');
  }

  function renderExport() {
    $('export-text').value = buildDataFile();
  }

  function download() {
    var blob = new Blob([buildDataFile()], { type: 'text/javascript;charset=utf-8' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    say('Файл data.js скачан. Положите его на хостинг рядом с index.html — и правки увидят все.');
  }

  /* --------------------------------------------------------------- СТАРТ */

  load();
  var migrated = migrateLogos();
  fillSelects();

  /* Запоминаем «родные» подсказки полей: когда рядом появится текст ошибки,
     aria-describedby придётся собрать заново, и подсказку терять нельзя. */
  document.querySelectorAll('#offer-form [aria-describedby]').forEach(function (input) {
    input.dataset.hint = input.getAttribute('aria-describedby');
  });

  renderSpecFields('', null);
  renderCatFilters();
  renderList();
  renderTextsForm();
  renderExport();

  /* Старые загрузки переехали в библиотеку — говорим об этом сразу,
     а не после первого сохранения. */
  if (migrated) {
    persist('Загруженные картинки перенесены в библиотеку «Мои картинки» — ' +
            'теперь их можно выбирать для любого оффера. Не забудьте скачать data.js.');
  }

  $('f-logo').addEventListener('change', function () {
    /* Что выбрали, то сразу видно: превью и ссылка скачивания.
       Пункт «По ссылке» дополнительно открывает поле для URL. */
    syncUrlField();
    updateLogoAids();
  });

  /* URL вписан — превью обновляется на лету, как при выборе из библиотеки. */
  $('f-logo-url').addEventListener('input', updateLogoAids);

  /* Проверяем по уходу из поля, как и ссылку оффера: ошибка на первой же
     букве только раздражает. */
  $('f-logo-url').addEventListener('blur', function () {
    var v = this.value.trim();
    if (v && !/^https?:\/\/.+/i.test(v)) {
      fieldError(this, 'Ссылка на картинку должна начинаться с https://.');
    } else {
      fieldError(this, '');
    }
  });

  /* Битая ссылка — прячем превью, а не показываем сломанную картинку. */
  $('f-logo-preview-img').addEventListener('error', function () {
    $('f-logo-preview').hidden = true;
  });

  $('f-logo-file').addEventListener('change', function () {
    var input = this;
    var file = input.files && input.files[0];
    /* Каждая новая попытка начинается с чистого листа */
    $('f-logo-file-err').textContent = '';
    input.removeAttribute('aria-invalid');

    readLogoFile(file, function (dataUrl) {
      /* В библиотеку — сразу: она общая для всех офферов, а не часть формы.
         В оффер картинка попадёт кнопкой «Сохранить оффер», как и остальное. */
      var base = String(file.name || '').replace(/\.[^.]+$/, '')
        .replace(/[<>]/g, '').trim().slice(0, 40) || 'картинка';
      var ext = file.type === 'image/svg+xml' ? 'svg'
              : file.type === 'image/jpeg' ? 'jpg' : 'png';
      state.library = state.library || [];
      var name = base, n = 2;
      while (libFind(name)) name = base + '-' + (n++);   // имена в списке должны различаться
      state.library.push({ name: name, ext: ext, data: dataUrl });

      /* Без перерисовки формы: фокус остаётся на поле файла, в селекте
         встаёт новая картинка, превью и ссылка скачивания — рядом. */
      syncLogoSelect('lib:' + name);
      updateLogoAids();
      persist('Картинка добавлена в библиотеку и выбрана — не забудьте сохранить оффер.');
    }, function (msg) {
      $('f-logo-file-err').textContent = msg;
      input.setAttribute('aria-invalid', 'true');
      input.value = '';
      say(msg);
    });
  });

  $('f-cat').addEventListener('change', function () {
    /* Уже введённые условия не теряем: если ключ есть и в новой категории,
       значение переедет вместе с полем. */
    var current = {};
    document.querySelectorAll('#spec-fields input[data-spec]').forEach(function (input) {
      current[input.dataset.spec] = input.value;
    });
    renderSpecFields(this.value, current);
  });

  /* Ссылку проверяем по уходу из поля, а не на каждое нажатие: иначе
     человек получает «ошибку» на первой же букве. */
  $('f-url').addEventListener('blur', function () {
    var v = this.value.trim();
    if (v && !/^https?:\/\/.+/i.test(v)) {
      fieldError(this, 'Ссылка должна начинаться с https:// и вести на страницу партнёра.');
    } else {
      fieldError(this, '');
    }
  });

  $('offer-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var offer = readForm();
    var errors = validate(offer);

    /* Одна ошибка — ведём прямо в поле, сводка тут только мешает.
       Несколько — показываем список, иначе человек чинит их по одной. */
    if (errors.length === 1) {
      clearError();
      var firstBad = document.querySelector('#offer-form [aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    if (errors.length) {
      showError(errors);
      /* Сводку человек прочитал — дальше его надо привести туда, где чинить. */
      var bad = document.querySelector('#offer-form [aria-invalid="true"]');
      if (bad) setTimeout(function () { bad.focus(); }, 1200);
      return;
    }

    var isNew = editing < 0;
    if (isNew) state.offers.push(offer);
    else state.offers[editing] = offer;

    /* Новый оффер показываем в его категории, чтобы он сразу был на виду. */
    if (isNew && offer.cat) activeCat = offer.cat;

    /* Окно закрываем ДО сообщения об успехе: сказанное при открытом окне
       попадает в контейнер внутри него, и вместе с окном пропадает. */
    $('offer-dialog').close();
    persist(isNew
      ? 'Оффер «' + offer.partner + ' — ' + offer.title + '» добавлен в каталог.'
      : 'Оффер «' + offer.partner + ' — ' + offer.title + '» сохранён.');

    renderCatFilters();   /* категория могла появиться — обновляем кнопки */
    resetForm();          /* чистит форму и перерисовывает список */
    $('list-title').focus();
  });

  $('offer-add').addEventListener('click', function () {
    resetForm();
    /* Открыли «Добавить» внутри категории — сразу подставляем её,
       чтобы новый оффер по умолчанию попал туда, где человек находится. */
    if (activeCat && activeCat !== 'all') {
      $('f-cat').value = activeCat;
      renderSpecFields(activeCat, null);
    }
    openOfferDialog();
  });

  function closeOfferDialog() { $('offer-dialog').close(); }
  $('offer-dialog-close').addEventListener('click', closeOfferDialog);
  $('offer-cancel').addEventListener('click', closeOfferDialog);
  /* Escape/крестик/Отмена — сбрасываем «редактируемый», чтобы следующее
     открытие «Добавить» не приняли за правку. */
  $('offer-dialog').addEventListener('close', function () { editing = -1; });

  $('texts-form').addEventListener('submit', function (e) {
    e.preventDefault();
    collectTexts();
    persist('Тексты сохранены. Чтобы их увидели посетители, скачайте data.js.');
  });

  $('faq-add').addEventListener('click', function () {
    collectTexts();
    state.content.faq = state.content.faq || {};
    state.content.faq.items = state.content.faq.items || [];
    state.content.faq.items.push({ q: 'Новый вопрос', a: 'Ответ на новый вопрос.' });
    persist('Вопрос добавлен — впишите текст и сохраните.');
    renderTextsForm();
    var last = state.content.faq.items.length - 1;
    var field = $('t-faq-q-' + last);
    if (field) { field.focus(); field.select(); }
  });

  $('export-download').addEventListener('click', download);

  $('export-copy').addEventListener('click', function () {
    var area = $('export-text');
    area.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(area.value).then(function () {
        say('Содержимое data.js скопировано в буфер обмена.');
      }, function () {
        say('Скопировать не вышло — текст выделен, нажмите Ctrl+C (⌘+C).');
      });
    } else {
      say('Текст выделен — нажмите Ctrl+C (⌘+C), чтобы скопировать.');
    }
  });

  $('export-reset').addEventListener('click', function () {
    if (!confirm('Отменить все правки и вернуться к тому, что сейчас опубликовано на сайте?')) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    load();
    renderCatFilters();
    resetForm();
    renderTextsForm();
    renderExport();
    say('Правки отменены — показано то, что лежит в data.js на сайте.');
  });
})();
