// Special services, concerts and one-off events, plus a handful of
// recurring weekly community activities — for the regular weekly pattern
// of worship at each church (Sunday services), see Services & Events
// instead. Curated from the parish's own shared calendar. Not generated
// from a CMS: edit the arrays below directly and commit.
(function () {
  var ONE_OFF_EVENTS = [
    { date: '2026-06-07', time: '18:00', title: 'Junior Praise', location: 'Old Radnor' },
    { date: '2026-06-12', time: '19:00', title: 'Organ Concert: Roger Judd (Diocesan Organ Advisor)', location: "St Mary's, Kington" },
    { date: '2026-06-14', time: '15:00', title: 'Wild Church', location: 'Kington' },
    { date: '2026-06-21', time: '14:00', title: 'Pilgrimage and tea', location: "St Stephen's, Old Radnor" },
    { date: '2026-07-03', time: '19:00', title: "Concert: Hilary Norris (organ) and Joris Boon ('cello)", location: "St Mary's, Kington" },
    { date: '2026-07-04', time: '10:30', title: "Phillippa's Ordination", location: 'Hereford Cathedral' },
    { date: '2026-07-19', time: '11:00', title: 'Picnic Praise', location: "St Mary's, Kington" },
    { date: '2026-07-19', time: '14:00', title: 'Pilgrimage and tea', location: "St Peter's, Titley" },
    { date: '2026-07-28', time: '10:30', title: "Summer Family Fun at St Mary's", location: "St Mary's, Kington" },
    { date: '2026-08-01', time: '16:20', title: 'Visiting Ringers (Holmer Tower outing)', location: "St Mary's, Kington" },
    { date: '2026-08-09', time: '16:00', title: 'Choral Evensong: Derby Singers, with a short recital', location: "St Mary's, Kington" },
    { date: '2026-08-11', time: '10:30', title: "Summer Family Fun at St Mary's", location: "St Mary's, Kington" },
    { date: '2026-08-16', time: '14:00', title: 'Pilgrimage and tea', location: "St Thomas à Becket, Huntington" },
    { date: '2026-08-25', time: '10:30', title: "Summer Family Fun at St Mary's", location: "St Mary's, Kington" },
    { date: '2026-08-30', time: '16:00', title: 'Choral Evensong sung by the Church House Singers', location: "St Mary's, Kington" },
    // Sunday services, September-November 2026: Holy Communion every Sunday
    // except the third Sunday of the month, which is Morning Praise. Only
    // covers Sep-Nov for now — see CLAUDE.md.
    { date: '2026-09-06', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-09-12', time: '19:00', title: 'Organ Recital: Ewan Murray', location: "St Mary's, Kington" },
    { date: '2026-09-13', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-09-20', time: '10:00', title: 'Morning Praise', location: "St Mary's, Kington" },
    { date: '2026-09-20', time: '13:45', title: "Kington Pilgrim Path Walk from St Mary's", location: "St Mary's, Kington" },
    { date: '2026-09-20', time: '14:00', title: 'Pilgrimage and tea', location: "St Mary's, Kinnerton" },
    { date: '2026-09-27', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-10-04', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-10-11', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-10-18', time: '10:00', title: 'Morning Praise', location: "St Mary's, Kington" },
    { date: '2026-10-25', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-10-28', time: '10:20', title: 'Visiting Ringers', location: "St Mary's, Kington" },
    { date: '2026-11-01', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-11-08', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-11-15', time: '10:00', title: 'Morning Praise', location: "St Mary's, Kington" },
    { date: '2026-11-15', time: '15:30', title: 'Recital by the Titley Philharmonic Orchestra (Bach Double Violin Concerto and Handel Organ Concerto)', location: "St Mary's, Kington" },
    { date: '2026-11-22', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-11-29', time: '10:00', title: 'Holy Communion', location: "St Mary's, Kington" },
    { date: '2026-12-11', time: '18:30', title: 'Carols at the Oxford', location: '' },
  ];

  // Recurring weekly activities. Each series expands into one entry per
  // occurrence between `from` and `until` (inclusive), on the given
  // weekday (1 = Monday ... 7 = Sunday, ISO-style), skipping any dates
  // listed in `except` (bank holidays, term breaks, etc.).
  //
  // To carry a series into next year, just extend `until`. To skip a
  // holiday, add its date to `except` — no more hand-typing one row per
  // week. Verified against the previous hand-written list when this was
  // introduced: expands to the exact same 67 dates.
  var RECURRING_SERIES = [
    // St Mary's Parish Hall — Mondays 12:15-13:00 & Fridays 10:00-11:00
    // (see the homepage noticeboard).
    { title: 'Kington Zero Waste', location: "St Mary's Parish Hall", weekday: 1, time: '12:15', from: '2026-08-31', until: '2026-12-31' },
    { title: 'Kington Zero Waste', location: "St Mary's Parish Hall", weekday: 5, time: '10:00', from: '2026-09-04', until: '2026-12-31', except: ['2026-12-25'] },
    // Term-time only (per the homepage noticeboard) — skip Herefordshire
    // school holidays. Update `except` once next term's dates are known.
    { title: 'Stay and Play', location: "St Mary's Parish Hall", weekday: 2, time: '09:15', from: '2026-09-01', until: '2026-12-31', except: ['2026-10-27', '2026-12-22', '2026-12-29'] },
    // Not term-time restricted — runs straight through, including the
    // school holidays Stay and Play skips.
    { title: 'Marches Voices Choir', location: 'Kington Parish Hall', weekday: 2, time: '14:00', from: '2026-09-01', until: '2026-12-31' },
  ];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function expandSeries(series) {
    var out = [];
    var fromParts = series.from.split('-').map(Number);
    var untilParts = series.until.split('-').map(Number);
    var d = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    var until = new Date(untilParts[0], untilParts[1] - 1, untilParts[2]);
    // JS Date#getDay(): 0 = Sunday ... 6 = Saturday. Convert our ISO
    // weekday (1 = Monday ... 7 = Sunday) to that scale.
    var jsWeekday = series.weekday % 7;
    while (d.getDay() !== jsWeekday) d.setDate(d.getDate() + 1);
    var except = series.except || [];
    while (d <= until) {
      var ds = dateStr(d);
      if (except.indexOf(ds) === -1) {
        out.push({ date: ds, time: series.time, title: series.title, location: series.location });
      }
      d.setDate(d.getDate() + 7);
    }
    return out;
  }

  var recurring = [];
  RECURRING_SERIES.forEach(function (series) {
    recurring = recurring.concat(expandSeries(series));
  });

  window.CALENDAR_EVENTS = ONE_OFF_EVENTS.concat(recurring);
})();
