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
