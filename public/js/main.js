document.addEventListener('DOMContentLoaded', function () {
  var year = document.getElementById('year');
  if (year) { year.textContent = new Date().getFullYear(); }

  // Noticeboard entries carry data-expires="YYYY-MM-DD". Once that date has
  // passed, the entry disappears from the noticeboard and its twin in the
  // #archive section (kept in the markup with style="display:none") is
  // revealed instead — no CMS, no rebuild, nothing to tidy up by hand.
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  document.querySelectorAll('#noticeboard [data-expires]').forEach(function (card) {
    var expires = new Date(card.dataset.expires + 'T00:00:00');
    if (today >= expires) { card.style.display = 'none'; }
  });

  var archiveSection = document.getElementById('archive');
  if (archiveSection) {
    var anyRevealed = false;
    archiveSection.querySelectorAll('[data-expires]').forEach(function (card) {
      var expires = new Date(card.dataset.expires + 'T00:00:00');
      if (today >= expires) {
        card.style.display = '';
        anyRevealed = true;
      }
    });
    var placeholder = archiveSection.querySelector('.archive-empty');
    if (placeholder) { placeholder.style.display = anyRevealed ? 'none' : ''; }
  }

  // Mobile nav: the primary links collapse behind the ellipsis toggle below
  // 860px (see the matching @media block in style.css). Only relevant when
  // the toggle is actually visible — but the listeners are harmless to
  // attach unconditionally, since nav.links just never gets .nav-open added
  // above that width (nothing calls navToggle.click()).
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('primary-nav');
  if (navToggle && navLinks) {
    var closeNav = function () {
      navLinks.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { closeNav(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('nav-open')) {
        closeNav();
        navToggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('nav-open') && !navLinks.contains(e.target) && !navToggle.contains(e.target)) {
        closeNav();
      }
    });
  }

  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }
});
