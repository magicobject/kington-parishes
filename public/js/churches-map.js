// Homepage "Find Us" map: one marker per church. Coordinates mirror the
// `geo` values in src/pages.config.mjs's our-churches structuredData —
// see CLAUDE.md "Data kept in sync by hand" if you're updating a church's
// location.
(function () {
  var mapEl = document.getElementById('churches-map');
  if (!mapEl || typeof L === 'undefined') return;

  var churches = [
    { name: "St Mary the Virgin, Kington", lat: 52.206108727628994, lng: -3.0260032744928784, url: '/church-kington.html' },
    { name: "St Peter's, Titley", lat: 52.23585239448353, lng: -2.9802284142333035, url: '/church-titley.html' },
    { name: "St Stephen's, Old Radnor", lat: 52.22531215688683, lng: -3.097180075965132, url: '/church-old-radnor.html' },
    { name: "St Mary's, Kinnerton", lat: 52.26131715327042, lng: -3.1083431994438713, url: '/church-kinnerton.html' },
    { name: 'St Thomas à Becket, Huntington', lat: 52.176790889307306, lng: -3.0891223911277272, url: '/church-huntington.html' },
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

  map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [28, 28] });
})();
