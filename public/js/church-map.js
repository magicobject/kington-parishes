// Single-marker map used on each church-*.html page. Reads its location
// from the #church-map div's data-lat/data-lng/data-name attributes rather
// than an inline <script> (blocked by this site's script-src CSP).
(function () {
  var mapEl = document.getElementById('church-map');
  if (!mapEl || typeof L === 'undefined') return;

  var lat = parseFloat(mapEl.dataset.lat);
  var lng = parseFloat(mapEl.dataset.lng);
  if (isNaN(lat) || isNaN(lng)) return;

  var map = L.map(mapEl, { scrollWheelZoom: false }).setView([lat, lng], 15);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);

  L.marker([lat, lng]).addTo(map).bindPopup(mapEl.dataset.name || '').openPopup();
})();
