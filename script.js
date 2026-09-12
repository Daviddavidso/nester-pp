/* =========================================================================
   ФинВыбор (maeb-fin.ru) — движок витрины.

   Что делает: рисует каталог из data.js, переключает фильтры, раскрывает
   вопросы, крутит строку партнёров. Ничего никуда не отправляет — сервер
   этому сайту не нужен.

   Разметка собирается через createElement, а не через innerHTML: тексты
   приходят из data.js и из админки, то есть их пишет человек. Через
   innerHTML случайная угловая скобка в описании оффера сломала бы вёрстку.
   ========================================================================= */

(function () {
  'use strict';

  /* Ключ, под которым админка держит черновик правок в этом браузере. */
  var DRAFT_KEY = 'maeb:draft';

  /* ------------------------------------------------------------ ДАННЫЕ */

  var content = CONTENT;
  var offers = OFFERS;
  /* Библиотека картинок из админки. Старый data.js собран до неё — тогда пусто. */
  var library = (typeof LIBRARY !== 'undefined' && Array.isArray(LIBRARY)) ? LIBRARY : [];
  var draftActive = false;

  try {
    var raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      var draft = JSON.parse(raw);
      if (draft && Array.isArray(draft.offers) && draft.content) {
        content = draft.content;
        offers = draft.offers;
        if (Array.isArray(draft.library)) library = draft.library;
        draftActive = true;
      }
    }
  } catch (e) {
    /* Приватный режим или битый черновик — молча работаем на data.js */
  }

  /* --------------------------------------------------------- ХЕЛПЕРЫ */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function $(id) { return document.getElementById(id); }

  function setText(id, text) {
    var node = $(id);
    if (node && text) node.textContent = text;
  }

  /* Токен маркировки рекламы вытаскиваем из самой ссылки: партнёрка отдаёт
     его прямо в url, дублировать руками в data.js незачем. */
  function eridOf(url) {
    var m = /[?&]erid=([^&#]+)/i.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  function categoryById(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[0];
  }

  /* Склонение: 1 оффер, 2 оффера, 5 офферов */
  function plural(n, one, few, many) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  /* ------------------------------------------------- ЧЕРНОВИК ИЗ АДМИНКИ */

  function renderDraftNotice() {
    if (!draftActive) return;

    var bar = el('div', 'draft-bar');
    bar.setAttribute('role', 'status');

    var text = el('span', null,
      'Показаны правки из админки. Их видите только вы в этом браузере — ' +
      'чтобы их увидели посетители, нажмите в админке «Сохранить на сайт».');

    var btn = el('button', 'link-btn', 'Вернуть опубликованную версию');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      location.reload();
    });

    bar.appendChild(text);
    bar.appendChild(btn);
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-draft-bar');
  }

  /* ----------------------------------------------------------- ТЕКСТЫ */

  function renderContent() {
    var badge = $('hero-badge');
    if (badge && content.badge) {
      badge.textContent = '';
      badge.appendChild(el('span', 'badge__dot')).setAttribute('aria-hidden', 'true');
      badge.appendChild(document.createTextNode(content.badge));
    }

    setText('hero-title', content.title);
    setText('hero-lead-title', content.leadTitle);
    setText('hero-lead', content.lead);
    setText('how-lead', content.how && content.how.lead);
    setText('why-lead', content.why && content.why.lead);
    setText('faq-lead', content.faq && content.faq.lead);
    setText('how-title', content.how && content.how.title);
    setText('why-title', content.why && content.why.title);
    setText('faq-title', content.faq && content.faq.title);

    if (typeof BRAND === 'object' && BRAND.name) {
      setText('brand-name', BRAND.name);
      document.querySelectorAll('.brand__mark').forEach(function (m) { m.textContent = BRAND.mark || BRAND.name.charAt(0); });
    }

    var f = content.footer || {};
    setText('footer-disclaimer', f.disclaimer);
    setText('footer-legal', f.legal);
    setText('footer-age', f.age);

    var years = (new Date()).getFullYear();
    setText('footer-copy', (BRAND.name || 'Витрина') + ' · ' + (WORK_SINCE === years ? years : WORK_SINCE + '—' + years));
  }

  function renderStats() {
    var box = $('stats');
    if (!box || !content.stats) return;
    content.stats.forEach(function (s) {
      var li = el('li');
      if (s.value) li.appendChild(el('span', 'stats__value', s.value));
      li.appendChild(el('span', 'stats__label', s.label));
      box.appendChild(li);
    });
  }

  /* -------------------------------------------------- СТРОКА ПАРТНЁРОВ */

  function renderTicker() {
    var track = $('ticker'), toggle = $('ticker-toggle');
    if (!track) return;

    var names = [];
    offers.forEach(function (o) {
      if (names.indexOf(o.partner) === -1) names.push(o.partner);
    });
    if (!names.length) return;

    /* Список печатается дважды: анимация уезжает ровно на половину ширины,
       поэтому шов не виден. Копия — чистая декорация. */
    function fill(hidden) {
      names.forEach(function (n) {
        var item = el('span', 'ticker__item', n);
        if (hidden) item.setAttribute('aria-hidden', 'true');
        track.appendChild(item);
      });
    }
    fill(false);
    fill(true);

    if (!toggle) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var paused = reduced;

    /* Состояние несёт сам текст кнопки. aria-pressed здесь стоять не должен:
       вместе они читаются как «Запустить движение строки, нажата». */
    function apply() {
      track.setAttribute('data-paused', paused ? 'true' : 'false');
      toggle.textContent = paused ? 'Запустить движение строки' : 'Остановить движение строки';
    }
    apply();

    toggle.addEventListener('click', function () {
      paused = !paused;
      apply();
    });
  }

  /* ---------------------------------------------------------- КАРТОЧКИ */

  function buildCard(offer) {
    var cat = categoryById(offer.cat);
    var li = el('li', 'card');

    /* Шапка карточки: логотип + партнёр + продукт */
    var head = el('div', 'card__head');

    /* Логотип — файл из logos/, data:-картинка или «lib:имя» из библиотеки
       админки. Записи нет — плашка с инициалами, как при битом файле. */
    var src = '';
    if (offer.logo) {
      if (offer.logo.indexOf('data:') === 0) {
        src = offer.logo;
      } else if (offer.logo.indexOf('lib:') === 0) {
        for (var li2 = 0; li2 < library.length; li2++) {
          if (library[li2].name === offer.logo.slice(4)) { src = library[li2].data; break; }
        }
      } else if (/^https?:\/\//i.test(offer.logo)) {
        /* Картинка по ссылке из админки — адрес берём как есть. */
        src = offer.logo;
      } else {
        src = 'logos/' + offer.logo + (offer.logoExt || '.png');
      }
    }

    if (src) {
      var tile = el('div', 'card__logo');
      var img = el('img');
      img.src = src;
      /* alt пустой намеренно: название партнёра стоит рядом текстом,
         иначе скринридер прочитает его дважды подряд */
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      /* Нет файла — вместо битой картинки встаёт плашка с инициалами */
      img.addEventListener('error', function () {
        tile.replaceWith(buildMono(offer));
      });
      tile.appendChild(img);
      head.appendChild(tile);
    } else {
      head.appendChild(buildMono(offer));
    }

    var headText = el('div');
    headText.appendChild(el('p', 'card__partner', offer.partner));
    /* Партнёр уходит в сам заголовок невидимым хвостом. Иначе в списке
       заголовков у скринридера подряд идут девять «Деньги на карту» —
       выбрать из них нужный нельзя. Внешне карточка не меняется. */
    var title = el('h3', 'card__title', offer.title);
    if (offer.partner) {
      title.appendChild(el('span', 'visually-hidden', ' — ' + offer.partner));
    }
    headText.appendChild(title);
    head.appendChild(headText);
    li.appendChild(head);

    /* Плашки */
    if (offer.hot || offer.tag) {
      var tags = el('div', 'card__tags');
      if (offer.hot) tags.appendChild(el('span', 'tag tag--hot', 'Выбор дня'));
      if (offer.tag) tags.appendChild(el('span', 'tag', offer.tag));
      tags.appendChild(el('span', 'tag', cat.label));
      li.appendChild(tags);
    }

    /* Характеристики */
    var order = SPEC_ORDER[offer.cat] || [];
    var specs = el('dl', 'specs');
    var printed = 0;
    order.forEach(function (key) {
      var value = offer[key];
      if (!value) return;
      var row = el('div');
      row.appendChild(el('dt', null, SPEC_LABELS[key] || key));
      var dots = el('span', 'specs__dots');
      dots.setAttribute('aria-hidden', 'true');
      row.appendChild(dots);
      row.appendChild(el('dd', null, value));
      specs.appendChild(row);
      printed++;
    });
    if (printed) li.appendChild(specs);

    /* Кнопка и маркировка */
    var foot = el('div', 'card__foot');
    var cta = el('a', 'glass glass--accent glass--sm card__cta');
    cta.href = offer.url || '#offers';
    if (offer.url) {
      cta.target = '_blank';
      cta.rel = 'noopener noreferrer';
    }
    cta.appendChild(el('span', 'glass__label', cat.cta));
    /* Видимое слово идёт в начале доступного имени — иначе ломается
       голосовое управление («нажми Оформить»). */
    cta.setAttribute('aria-label',
      cat.cta + ' — ' + offer.partner + ', ' + offer.title +
      (offer.url ? ' (откроется в новой вкладке)' : ''));
    foot.appendChild(cta);

    var erid = eridOf(offer.url);
    if (erid) foot.appendChild(el('p', 'card__erid', 'Реклама. erid: ' + erid));

    li.appendChild(foot);

    /* Мышью кликается вся плитка — так привычнее и так больше переходов.
       Для клавиатуры и скринридера ничего не меняется: точка входа одна,
       это ссылка внизу карточки. */
    li.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var sel = window.getSelection();
      if (sel && String(sel).length) return;   /* человек выделял текст */
      cta.click();
    });

    return li;
  }

  function buildMono(offer) {
    var mono = el('div', 'card__mono', (offer.partner || '?').trim().charAt(0).toUpperCase());
    var tone = offer.tone || '#2A2A32';
    mono.style.background = tone;
    /* Белая буква на жёлтом Т-Банке давала 1.3:1 — не читалась вовсе.
       Цвет буквы выбираем от яркости подложки, какой бы её ни задали
       в админке. */
    mono.style.color = monoInk(tone);
    mono.setAttribute('aria-hidden', 'true');
    return mono;
  }

  /* Тёмная буква на светлой подложке, белая — на тёмной. */
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

  /* ----------------------------------------------------------- ФИЛЬТРЫ */

  function initCatalog() {
    var row = $('filters'), grid = $('cards'),
        count = $('offers-count'), empty = $('empty');
    if (!row || !grid) return;

    /* Кнопки «Все офферы» на витрине нет — по просьбе клиента остаются
       только четыре категории продуктов. Категория без единого оффера
       кнопки тоже не получает: пустой фильтр выглядит как поломка. */
    var available = CATEGORIES.filter(function (c) {
      return c.id !== 'all' && offers.some(function (o) { return o.cat === c.id; });
    });

    /* Раз «всех» больше нет, одна категория выбрана всегда. Первая в
       data.js — сейчас дебетовые карты. Если дебетовые опустеют,
       выбранной станет следующая непустая, а не пустой экран. */
    var current = available.length ? available[0].id : null;

    available.forEach(function (cat) {
      var btn = el('button', 'filter');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', cat.id === current ? 'true' : 'false');
      btn.dataset.cat = cat.id;
      var dot = el('span', 'filter__dot');
      dot.setAttribute('aria-hidden', 'true');
      btn.appendChild(dot);
      btn.appendChild(el('span', null, cat.label));
      btn.addEventListener('click', function () { select(cat.id); });
      row.appendChild(btn);
    });

    function select(id) {
      if (id === current) return;   /* повторное нажатие ничего не меняет */
      current = id;
      row.querySelectorAll('.filter').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.cat === id ? 'true' : 'false');
      });
      draw();
      /* Фокус остаётся на кнопке фильтра — перебрасывать его в список
         нельзя, человек теряет место, откуда нажал. */
    }

    var firstDraw = true;
    var statusTimer = null;

    function draw() {
      var list = current
        ? offers.filter(function (o) { return o.cat === current; })
        : [];

      /* «Выбор дня» — наверх, остальное в порядке из data.js */
      list.sort(function (a, b) { return (b.hot ? 1 : 0) - (a.hot ? 1 : 0); });

      grid.textContent = '';
      list.forEach(function (o) { grid.appendChild(buildCard(o)); });

      var n = list.length;
      var label = current ? categoryById(current).label : 'Каталог';
      var human = n
        ? label + ': ' + n + ' ' + plural(n, 'оффер', 'оффера', 'офферов')
        : label + ': ничего не найдено';

      if (empty) empty.hidden = n !== 0;
      if (!count) return;

      if (firstDraw) {
        /* При загрузке страницы счётчик не объявляем: он налез бы на
           заголовок страницы. Название категории человек просто прочитает
           глазами или курсором скринридера — текст видимый. */
        firstDraw = false;
        count.setAttribute('aria-live', 'off');
        count.textContent = human;
        setTimeout(function () { count.setAttribute('aria-live', 'polite'); }, 0);
        return;
      }

      /* Одинаковый текст подряд не объявляется — поэтому сначала чистим.
         Задержка 150 мс, а не 0: очистка и запись в одном кадре браузером
         схлопываются, и объявления не случается вовсе. clearTimeout —
         чтобы быстрое переключение категорий не копило старые объявления. */
      count.textContent = '';
      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(function () { count.textContent = human; }, 150);
    }

    draw();
  }

  /* ------------------------------------------------------- ШАГИ, ПРИЧИНЫ */

  function renderSteps() {
    var box = $('steps');
    if (!box || !content.how || !content.how.steps) return;
    content.how.steps.forEach(function (s, i) {
      var li = el('li', 'step');
      li.appendChild(el('span', 'step__num', '0' + (i + 1))).setAttribute('aria-hidden', 'true');
      li.appendChild(el('h3', 'step__title', s.title));
      li.appendChild(el('p', 'step__text', s.text));
      box.appendChild(li);
    });
  }

  function renderReasons() {
    var box = $('reasons');
    if (!box || !content.why || !content.why.items) return;
    content.why.items.forEach(function (r) {
      var li = el('li', 'reason');
      li.appendChild(el('span', 'reason__mark')).setAttribute('aria-hidden', 'true');
      var text = el('div');
      text.appendChild(el('h3', 'reason__title', r.title));
      text.appendChild(el('p', 'reason__text', r.text));
      li.appendChild(text);
      box.appendChild(li);
    });
  }

  /* ---------------------------------------------------------- ВОПРОСЫ */

  function renderFaq() {
    var box = $('faq-list');
    if (!box || !content.faq || !content.faq.items) return;

    content.faq.items.forEach(function (item, i) {
      var wrap = el('div', 'faq__item');
      var btnId = 'faq-btn-' + i;
      var panelId = 'faq-panel-' + i;

      /* Кнопка внутри заголовка, а не заголовок внутри кнопки: иначе
         вопрос выпадает из списка заголовков в скринридере. */
      var h3 = el('h3', 'faq__q');
      var btn = el('button', 'faq__btn');
      btn.type = 'button';
      btn.id = btnId;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', panelId);
      btn.appendChild(el('span', null, item.q));

      var icon = el('span', 'faq__icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 12 12" focusable="false"><path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      btn.appendChild(icon);

      h3.appendChild(btn);
      wrap.appendChild(h3);

      var panel = el('div', 'faq__panel');
      panel.id = panelId;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', btnId);
      panel.hidden = true;
      panel.appendChild(el('p', null, item.a));
      wrap.appendChild(panel);

      /* Закрываем через hidden, а не height: 0 — иначе содержимое
         закрытого ответа остаётся в порядке обхода табом. */
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.hidden = open;
      });

      box.appendChild(wrap);
    });
  }

  /* -------------------------------------------------------------- СТАРТ */

  renderDraftNotice();
  renderContent();
  renderStats();
  renderTicker();
  renderSteps();
  renderReasons();
  renderFaq();
  initCatalog();
})();
