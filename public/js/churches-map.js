// Homepage "Find Us" map: one marker per church. The pins come from the
// #churches-map div's data-churches attribute, generated at build time from
// src/churches.config.mjs — edit a church's location there, not here.
(function () {
  var mapEl = document.getElementById('churches-map');
  if (!mapEl || typeof L === 'undefined') return;

  var churches = JSON.parse(mapEl.dataset.churches || '[]');
  if (!churches.length) return;

  var map = L.map(mapEl, { scrollWheelZoom: false });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);

  var markers = churches.map(function (church) {
    return L.marker([church.lat, church.lng])
      .addTo(map)
      .bindPopup('<a href="' + church.url + '">' + church.name + '</a>');
  });

  map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [55, 55] });
})();
