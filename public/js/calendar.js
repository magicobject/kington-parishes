// Month-by-month events calendar. Vanilla JS, no dependencies. Reads
// window.CALENDAR_EVENTS (set by calendar-events.js, loaded first) and
// renders into #cal-root. Does nothing on pages that don't have #cal-root.
(function () {
  var root = document.getElementById('cal-root');
  if (!root) return;

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  var eventsByDate = {};
  (window.CALENDAR_EVENTS || []).forEach(function (ev) {
    (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev);
  });
  Object.keys(eventsByDate).forEach(function (d) {
    eventsByDate[d].sort(function (a, b) { return a.time.localeCompare(b.time); });
  });

  // calendar-events.js is hand-edited, not user input — but escape titles/
  // locations anyway before they go into innerHTML, on general principle
  // and in case that ever changes (e.g. a copy-pasted title with a stray
  // "<" or "&" shouldn't be able to break the markup).
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function formatTime(t) {
    var parts = t.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var suffix = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + (m === '00' ? '' : ':' + m) + suffix;
  }

  var today = new Date();
  var todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth();
  var selected = null;

  root.innerHTML =
    '<div class="cal-toolbar">' +
      '<button type="button" class="cal-nav" id="cal-prev" aria-label="Previous month">‹</button>' +
      '<h2 class="cal-month-label" id="cal-month-label"></h2>' +
      '<button type="button" class="cal-nav" id="cal-next" aria-label="Next month">›</button>' +
      '<button type="button" class="cal-today-btn" id="cal-today">Today</button>' +
    '</div>' +
    '<div class="cal-weekdays" aria-hidden="true">' +
      WEEKDAY_SHORT.map(function (w) { return '<div class="cal-weekday">' + w + '</div>'; }).join('') +
    '</div>' +
    '<div class="cal-grid" id="cal-grid"></div>' +
    '<div class="cal-agenda" id="cal-agenda" aria-live="polite"></div>';

  var monthLabel = document.getElementById('cal-month-label');
  var grid = document.getElementById('cal-grid');
  var agenda = document.getElementById('cal-agenda');

  function renderAgenda() {
    if (!selected) {
      agenda.innerHTML = '<p class="cal-agenda-empty">Select a day to see what’s on.</p>';
      return;
    }
    var parts = selected.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var weekday = WEEKDAY_LONG[(d.getDay() + 6) % 7];
    var heading = weekday + ' ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
    var evs = eventsByDate[selected] || [];
    var html = '<h3 class="cal-agenda-heading">' + heading + '</h3>';
    if (!evs.length) {
      html += '<p class="cal-agenda-empty">Nothing on our calendar for this day.</p>';
    } else {
      html += '<ul class="cal-agenda-list">' + evs.map(function (ev) {
        return '<li><span class="cal-agenda-time">' + formatTime(ev.time) + '</span>' +
          '<span class="cal-agenda-title">' + escapeHtml(ev.title) + '</span>' +
          (ev.location ? '<span class="cal-agenda-location">' + escapeHtml(ev.location) + '</span>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }
    agenda.innerHTML = html;
  }

  function renderGrid() {
    monthLabel.textContent = MONTH_NAMES[viewMonth] + ' ' + viewYear;

    var firstOfMonth = new Date(viewYear, viewMonth, 1);
    var startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    var gridStart = new Date(viewYear, viewMonth, 1 - startOffset);

    var cellsHtml = '';
    for (var i = 0; i < 42; i++) {
      var cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      var cds = dateStr(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
      var outside = cellDate.getMonth() !== viewMonth;
      var isToday = cds === todayStr;
      var isSelected = cds === selected;
      var evs = eventsByDate[cds] || [];

      var classes = ['cal-day'];
      if (outside) classes.push('cal-day--outside');
      if (isToday) classes.push('cal-day--today');
      if (isSelected) classes.push('cal-day--selected');
      if (evs.length) classes.push('cal-day--has-events');

      var chipsHtml = evs.slice(0, 2).map(function (ev) {
        return '<span class="cal-chip">' + formatTime(ev.time) + ' ' + escapeHtml(ev.title) + '</span>';
      }).join('');
      if (evs.length > 2) {
        chipsHtml += '<span class="cal-chip cal-chip--more">+' + (evs.length - 2) + ' more</span>';
      }
      var dot = evs.length ? '<span class="cal-day-dot" aria-hidden="true"></span>' : '';

      var label = WEEKDAY_LONG[(cellDate.getDay() + 6) % 7] + ' ' + cellDate.getDate() + ' ' + MONTH_NAMES[cellDate.getMonth()] +
        (isToday ? ' (today)' : '') +
        (evs.length ? ', ' + evs.length + ' event' + (evs.length > 1 ? 's' : '') : '');

      cellsHtml +=
        '<button type="button" class="' + classes.join(' ') + '" data-date="' + cds + '" aria-label="' + label + '">' +
          '<span class="cal-day-num">' + cellDate.getDate() + dot + '</span>' +
          '<span class="cal-day-chips">' + chipsHtml + '</span>' +
        '</button>';
    }
    grid.innerHTML = cellsHtml;
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('.cal-day');
    if (!btn) return;
    selected = btn.getAttribute('data-date');
    renderGrid();
    renderAgenda();
  });

  document.getElementById('cal-prev').addEventListener('click', function () {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    selected = null;
    renderGrid(); renderAgenda();
  });
  document.getElementById('cal-next').addEventListener('click', function () {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    selected = null;
    renderGrid(); renderAgenda();
  });
  document.getElementById('cal-today').addEventListener('click', function () {
    viewYear = today.getFullYear(); viewMonth = today.getMonth(); selected = todayStr;
    renderGrid(); renderAgenda();
  });

  selected = todayStr;
  renderGrid();
  renderAgenda();
})();
