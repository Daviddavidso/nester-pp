(function () {
  'use strict';

  var filterInputs = document.querySelectorAll('input[name="offer-category"]');
  var cards = document.querySelectorAll('.offer-card');
  var statusEl = document.getElementById('filter-status');
  var grid = document.querySelector('.offers-grid');

  var categoryLabels = {
    'credit-cards': 'Кредитные карты',
    'debit-cards': 'Дебетовые карты',
    'loans': 'Займы',
    'credits': 'Кредиты'
  };

  function pluralize(n, one, few, many) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function applyFilter(category, triggerEl) {
    // If focus currently sits on a card CTA that is about to be hidden by
    // this filter change, move focus to the control that triggered the
    // change first, so focus never silently falls back to <body>.
    if (grid && grid.contains(document.activeElement)) {
      var activeCard = document.activeElement.closest('.offer-card');
      if (activeCard && category !== 'all' && activeCard.dataset.category !== category) {
        triggerEl.focus();
      }
    }

    var visibleCount = 0;
    cards.forEach(function (card) {
      var match = category === 'all' || card.dataset.category === category;
      var li = card.closest('li');
      if (li) li.hidden = !match;
      if (match) visibleCount++;
    });

    var word = pluralize(visibleCount, 'предложение', 'предложения', 'предложений');
    if (category === 'all') {
      statusEl.textContent = 'Показано ' + visibleCount + ' ' + word;
    } else if (visibleCount === 0) {
      statusEl.textContent = 'По категории «' + categoryLabels[category] + '» предложений не найдено';
    } else {
      statusEl.textContent = 'Показано ' + visibleCount + ' ' + word + ' в категории «' + categoryLabels[category] + '»';
    }
  }

  filterInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      applyFilter(input.value, input);
    });
  });

  // Placeholder CTAs: href="#" is intentional — real affiliate links are
  // pending partner-program approval (see TODO comments in index.html).
  // Prevent the default top-of-page jump so the placeholder behaves
  // identically (does nothing) for mouse, keyboard, and screen-reader users
  // instead of jumping unexpectedly for sighted/mouse users only.
  document.querySelectorAll('.offer-cta').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
    });
  });

  // Smooth-scroll + focus management for in-page section links (skip link,
  // hero CTA, nav links). Respects prefers-reduced-motion.
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.classList.contains('offer-cta')) return; // handled above

    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('href').slice(1);
      var target = document.getElementById(targetId);
      if (!target) return; // let default behavior happen if target is missing

      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      window.setTimeout(function () {
        target.focus({ preventScroll: true });
      }, prefersReducedMotion ? 0 : 400);
    });
  });
})();
