(function () {
  'use strict';

  // API base — same origin, since Express serves the frontend too.
  const API_BASE = '';

  document.getElementById('year').textContent = new Date().getFullYear();

  // ---------- Mobile nav ----------
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', function () {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  mainNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () { mainNav.classList.remove('open'); });
  });

  // ---------- Loan calculator ----------
  const weightInput = document.getElementById('goldWeight');
  const purityInput = document.getElementById('goldPurity');
  const rateInput = document.getElementById('goldRate');
  const ltvInput = document.getElementById('ltv');
  const ltvValueEl = document.getElementById('ltvValue');
  const resultAmountEl = document.getElementById('resultAmount');
  const resultSubEl = document.getElementById('resultSub');
  const estimatedLoanField = document.getElementById('estimatedLoan');
  const weightFormField = document.getElementById('weight');

  function formatINR(amount) {
    return '₹ ' + Math.round(amount).toLocaleString('en-IN');
  }

  function calculate() {
    const weight = parseFloat(weightInput.value) || 0;
    const purity = parseFloat(purityInput.value) || 0;
    const rate24k = parseFloat(rateInput.value) || 0;
    const ltv = parseFloat(ltvInput.value) || 0;

    ltvValueEl.textContent = ltv + '%';

    const pureGoldValue = weight * purity * rate24k;
    const loanAmount = pureGoldValue * (ltv / 100);

    resultAmountEl.textContent = formatINR(loanAmount);
    const purityLabel = purityInput.options[purityInput.selectedIndex].text.split(' ')[0];
    resultSubEl.textContent = weight + 'g · ' + purityLabel + ' · ' + ltv + '% LTV';

    // Keep the inquiry form roughly in sync so a submitted lead carries context.
    estimatedLoanField.value = Math.round(loanAmount);
    if (!weightFormField.value) {
      weightFormField.placeholder = weight ? String(weight) : '';
    }
  }

  [weightInput, purityInput, rateInput, ltvInput].forEach(function (el) {
    el.addEventListener('input', calculate);
  });
  calculate();

  // Try to load today's branch-configured gold rate, if the backend has one set.
  fetch(API_BASE + '/api/config')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (config) {
      if (config && config.goldRatePerGram) {
        rateInput.value = config.goldRatePerGram;
        calculate();
      }
      if (config && config.phone) {
        document.getElementById('contactPhone').textContent = '📞 ' + config.phone;
      }
      if (config && config.address) {
        document.getElementById('contactAddress').textContent = '📍 ' + config.address;
      }
    })
    .catch(function () { /* backend not reachable yet — page still works with defaults */ });

  // ---------- Inquiry form ----------
  const form = document.getElementById('inquiryForm');
  const submitBtn = document.getElementById('submitBtn');
  const formStatus = document.getElementById('formStatus');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formStatus.textContent = '';
    formStatus.className = 'form-status';

    const payload = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      city: document.getElementById('city').value.trim(),
      goldWeight: weightFormField.value.trim() || weightInput.value,
      estimatedLoan: estimatedLoanField.value,
      message: document.getElementById('message').value.trim()
    };

    if (!payload.name || !payload.phone) {
      formStatus.textContent = 'Please share at least your name and phone number.';
      formStatus.className = 'form-status error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch(API_BASE + '/api/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then(function () {
        formStatus.textContent = 'Thanks — we\'ve got your details. A branch officer will call you back shortly.';
        formStatus.className = 'form-status success';
        form.reset();
        calculate();
      })
      .catch(function () {
        formStatus.textContent = 'Something went wrong sending this. Please call us directly instead.';
        formStatus.className = 'form-status error';
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request a call back';
      });
  });
})();
