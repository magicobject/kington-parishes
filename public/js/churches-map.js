// Homepage "Find Us" map: one marker per church. Coordinates mirror the
// `geo` values in src/pages.config.mjs's our-churches structuredData —
// see CLAUDE.md "Data kept in sync by hand" if you're updating a church's
// location.
(function () {
  var mapEl = document.getElementById('churches-map');
  if (!mapEl || typeof L === 'undefined') return;

  var churches = [
    { name: "St Mary the Virgin, Kington", lat: 52.2045407, lng: -3.0384017, url: '/church-kington.html' },
    { name: "St Peter's, Titley", lat: 52.2357368, lng: -2.9806390, url: '/church-titley.html' },
    { name: "St Stephen's, Old Radnor", lat: 52.2249297, lng: -3.0996140, url: '/church-old-radnor.html' },
    { name: "St Mary's, Kinnerton", lat: 52.2612662, lng: -3.1088144, url: '/church-kinnerton.html' },
    { name: 'St Thomas à Becket, Huntington', lat: 52.1735393, lng: -3.0989438, url: '/church-huntington.html' },
  ];

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
