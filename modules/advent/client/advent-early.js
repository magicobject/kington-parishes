// Home-page Advent banner, step one (a small classic script, run while the page is still being read): RESERVE the banner's
// room before the browser paints what comes below it, so that showing the banner later (advent-teaser.js, a module that runs
// after the page is read) does not push the page down. Without this every phone visitor in season saw the page jump by the
// banner's height (a layout shift of 0.14 to 0.17, over Google's 0.1 "good" line).
//
// It decides only whether the banner is LIKELY to show, and only reserves space for it: it never shows, builds or fetches
// anything. The rule is the real one in short: the setting that lets the real date drive the banner is on and today (in the
// calendar's time zone) is from the season start to the end of the archive, or the address carries ?advent-preview= (and
// preview is allowed). Anywhere else (before launch, out of season) it does nothing at all, so the page, including its height,
// is exactly as it was. test-unit/advent-early.test.mjs checks it against the real date rules for every day of the year.
//
// The reservation is made with style properties set from script (which a content security policy allows), is released by
// advent-teaser.js as soon as the banner is built (or at once if that script decides there is no banner or fails), and by a
// timer here (1.5 seconds, smoothly) if that script never even starts.
(function () {
  var script = document.currentScript;
  var root = script && script.previousElementSibling;
  if (!root || !root.hasAttribute('data-advent-teaser')) return;
  try {
    var data = root.dataset;
    if (data.enabled !== 'true') return;
    var preview = data.preview === 'true' && /(?:^|[?&])advent-preview=/.test(location.search);
    if (!preview && !(data.goLive === 'true' && inSeason(data))) return;

    // The banner sits just after the hero (the container is inside it in the source, so that nothing changes when there is no banner).
    var host = root.closest('section');
    if (host && host.parentNode) host.after(root);
    // The height of the shown banner (and, when previewing, the "Preview mode" notice above it), in rem so that it follows the text size.
    var wide = window.matchMedia && window.matchMedia('(min-width: 40rem)').matches;
    root.style.minHeight = (wide ? (preview ? 15.5 : 12) : (preview ? 25 : 17.5)) + 'rem';
    root.hidden = false;
    root.setAttribute('data-advent-reserved', '');
    // If the banner script has not even STARTED after 1.5 seconds (blocked, or it failed to load), the room is given back rather than
    // leaving a blank band: it shrinks smoothly (at once for someone who asked for reduced motion). A script that has started but is
    // slow keeps its room, and releases it itself.
    window.setTimeout(function () {
      if (!root.hasAttribute('data-advent-reserved') || root.hasAttribute('data-advent-started')) return;
      root.removeAttribute('data-advent-reserved');
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        root.hidden = true;
        root.style.minHeight = '';
        return;
      }
      root.style.transition = 'min-height 0.3s ease';
      root.style.minHeight = '0px';
      window.setTimeout(function () { root.hidden = true; root.style.minHeight = ''; root.style.transition = ''; }, 350);
    }, 1500);
  } catch (ignored) {
    // Anything unexpected leaves the page exactly as it was.
  }

  // Whether today, in the calendar's time zone, is from the season start to the end of the archive (which may run over New Year).
  function inSeason(data) {
    var found = {};
    new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', { timeZone: data.timeZone, month: 'numeric', day: 'numeric' })
      .formatToParts(new Date())
      .forEach(function (part) { found[part.type] = Number(part.value); });
    var today = found.month * 100 + found.day;
    var start = Number(data.startMonth) * 100 + Number(data.startDay);
    var last = data.archiveMonth ? Number(data.archiveMonth) * 100 + Number(data.archiveDay) : Number(data.endMonth) * 100 + Number(data.endDay);
    if (!(today > 0) || !(start > 0) || !(last > 0)) return false;
    return last < start ? today >= start || today <= last : today >= start && today <= last;
  }
})();
