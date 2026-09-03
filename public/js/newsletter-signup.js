// Wires up the InSpire Newsletter signup form: posts to /api/subscribe as
// JSON, shows an inline success/error message, and disables the submit
// button while a request is in flight. Does nothing on pages without the
// form. Vanilla JS, no dependencies.
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('newsletter-signup-form');
  if (!form) return;

  var message = document.getElementById('newsletter-signup-message');
  var submitBtn = form.querySelector('button[type="submit"]');

  function showMessage(text, isError) {
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle('is-error', !!isError);
    message.classList.toggle('is-success', !isError);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var email = form.elements.email.value.trim();
    var name = form.elements.name.value.trim();
    var website = form.elements.website.value; // honeypot — left blank by real visitors
    var consent = form.elements.consent.checked;

    if (!consent) {
      showMessage('Please tick the box to confirm you’d like to receive the newsletter.', true);
      return;
    }

    submitBtn.disabled = true;
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, name: name, website: website }),
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        showMessage(result.data.message, !result.data.ok);
        if (result.data.ok) form.reset();
      })
      .catch(function () {
        showMessage('Something went wrong on our end — please try again shortly.', true);
      })
      .then(function () {
        submitBtn.disabled = false;
      });
  });
});
