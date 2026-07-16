(function () {
  'use strict';

  let adminPassword = sessionStorage.getItem('gl_admin_pw') || '';

  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const whoami = document.getElementById('whoami');

  function authHeaders() {
    return { 'x-admin-password': adminPassword, 'Content-Type': 'application/json' };
  }

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    whoami.textContent = 'Signed in';
    loadConfig();
    loadLeads();
  }

  function tryLogin(pw) {
    adminPassword = pw;
    fetch('/api/leads', { headers: authHeaders() })
      .then(function (res) {
        if (res.status === 401) throw new Error('bad password');
        return res.json();
      })
      .then(function () {
        sessionStorage.setItem('gl_admin_pw', adminPassword);
        showDashboard();
      })
      .catch(function () {
        loginError.textContent = 'Incorrect password.';
      });
  }

  loginBtn.addEventListener('click', function () { tryLogin(passwordInput.value); });
  passwordInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryLogin(passwordInput.value);
  });

  if (adminPassword) tryLogin(adminPassword);

  // ---------- Config ----------
  const rateInput = document.getElementById('rateInput');
  const phoneInput = document.getElementById('phoneInput');
  const addressInput = document.getElementById('addressInput');
  const configStatus = document.getElementById('configStatus');

  function loadConfig() {
    fetch('/api/config')
      .then(function (r) { return r.json(); })
      .then(function (c) {
        rateInput.value = c.goldRatePerGram || '';
        phoneInput.value = c.phone || '';
        addressInput.value = c.address || '';
      });
  }

  document.getElementById('saveConfigBtn').addEventListener('click', function () {
    configStatus.textContent = 'Saving…';
    fetch('/api/config', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        goldRatePerGram: rateInput.value,
        phone: phoneInput.value,
        address: addressInput.value
      })
    })
      .then(function (r) { return r.json(); })
      .then(function () { configStatus.textContent = 'Saved.'; setTimeout(function () { configStatus.textContent = ''; }, 2000); })
      .catch(function () { configStatus.textContent = 'Failed to save.'; });
  });

  // ---------- Leads ----------
  const leadsBody = document.getElementById('leadsBody');
  const leadsEmpty = document.getElementById('leadsEmpty');

  function loadLeads() {
    fetch('/api/leads', { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(renderLeads);
  }

  function renderLeads(leads) {
    leadsBody.innerHTML = '';
    leadsEmpty.style.display = leads.length ? 'none' : 'block';

    leads.forEach(function (lead) {
      const tr = document.createElement('tr');

      const when = new Date(lead.submittedAt);
      const whenStr = isNaN(when) ? '' : when.toLocaleString('en-IN');

      tr.innerHTML =
        '<td>' + whenStr + '</td>' +
        '<td>' + escapeHtml(lead.name) + '</td>' +
        '<td>' + escapeHtml(lead.phone) + '</td>' +
        '<td>' + escapeHtml(lead.city) + '</td>' +
        '<td>' + escapeHtml(lead.goldWeight) + '</td>' +
        '<td>' + (lead.estimatedLoan ? '₹' + Number(lead.estimatedLoan).toLocaleString('en-IN') : '') + '</td>' +
        '<td>' + escapeHtml(lead.message) + '</td>' +
        '<td></td><td></td>';

      const statusTd = tr.children[7];
      const select = document.createElement('select');
      ['new', 'contacted', 'closed'].forEach(function (s) {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        if (s === lead.status) opt.selected = true;
        select.appendChild(opt);
      });
      select.className = 'status-' + lead.status;
      select.addEventListener('change', function () {
        fetch('/api/leads/' + lead.id, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: select.value })
        }).then(function () { select.className = 'status-' + select.value; });
      });
      statusTd.appendChild(select);

      const actionsTd = tr.children[8];
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'secondary';
      delBtn.addEventListener('click', function () {
        if (!confirm('Delete this lead?')) return;
        fetch('/api/leads/' + lead.id, { method: 'DELETE', headers: authHeaders() })
          .then(loadLeads);
      });
      actionsTd.appendChild(delBtn);

      leadsBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  document.getElementById('refreshBtn').addEventListener('click', loadLeads);
  document.getElementById('exportBtn').addEventListener('click', function () {
    window.location = '/api/leads/export.csv?password=' + encodeURIComponent(adminPassword);
  });
})();
