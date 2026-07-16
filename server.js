require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';

const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// ---------- Make sure data files exist ----------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    goldRatePerGram: Number(process.env.GOLD_RATE_PER_GRAM) || 6800,
    phone: process.env.BRANCH_PHONE || '+91 90000 00000',
    address: process.env.BRANCH_ADDRESS || 'Shop No. 12, Main Bazaar Road, Your City'
  }, null, 2));
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

function requireAdmin(req, res, next) {
  const provided = req.header('x-admin-password') || req.query.password;
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  next();
}

// ---------- Public API ----------

// Today's gold rate + branch contact info, shown on the public site.
app.get('/api/config', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  res.json(config);
});

// A visitor submits the "request a call back" form.
app.post('/api/inquiry', (req, res) => {
  const { name, phone, city, goldWeight, estimatedLoan, message } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: String(name).slice(0, 100),
    phone: String(phone).slice(0, 30),
    city: city ? String(city).slice(0, 100) : '',
    goldWeight: goldWeight ? String(goldWeight).slice(0, 20) : '',
    estimatedLoan: estimatedLoan ? String(estimatedLoan).slice(0, 20) : '',
    message: message ? String(message).slice(0, 1000) : '',
    submittedAt: new Date().toISOString(),
    status: 'new'
  };

  const leads = readJSON(LEADS_FILE);
  leads.unshift(lead);
  writeJSON(LEADS_FILE, leads);

  res.status(201).json({ ok: true, id: lead.id });
});

// ---------- Admin API (password protected) ----------

app.get('/api/leads', requireAdmin, (req, res) => {
  res.json(readJSON(LEADS_FILE));
});

app.patch('/api/leads/:id', requireAdmin, (req, res) => {
  const leads = readJSON(LEADS_FILE);
  const lead = leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  if (req.body.status) lead.status = String(req.body.status).slice(0, 30);
  writeJSON(LEADS_FILE, leads);
  res.json(lead);
});

app.delete('/api/leads/:id', requireAdmin, (req, res) => {
  let leads = readJSON(LEADS_FILE);
  const before = leads.length;
  leads = leads.filter((l) => l.id !== req.params.id);
  writeJSON(LEADS_FILE, leads);
  res.json({ ok: true, deleted: before - leads.length });
});

app.get('/api/leads/export.csv', requireAdmin, (req, res) => {
  const leads = readJSON(LEADS_FILE);
  const header = ['id', 'name', 'phone', 'city', 'goldWeight', 'estimatedLoan', 'message', 'submittedAt', 'status'];
  const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = leads.map((l) => header.map((h) => escape(l[h])).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.send(csv);
});

app.put('/api/config', requireAdmin, (req, res) => {
  const current = readJSON(CONFIG_FILE);
  const { goldRatePerGram, phone, address } = req.body || {};
  const updated = {
    goldRatePerGram: goldRatePerGram ? Number(goldRatePerGram) : current.goldRatePerGram,
    phone: phone || current.phone,
    address: address || current.address
  };
  writeJSON(CONFIG_FILE, updated);
  res.json(updated);
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Suvarna Gold Loans site running at http://localhost:${PORT}`);
  console.log(`Admin dashboard at http://localhost:${PORT}/admin`);
});
