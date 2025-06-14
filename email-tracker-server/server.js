const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./tracker.db');

db.run(`CREATE TABLE IF NOT EXISTS emails (
  uuid TEXT PRIMARY KEY,
  campaign_id TEXT,
  email TEXT,
  name TEXT,
  sent_at TEXT
)`);
db.run(`CREATE TABLE IF NOT EXISTS openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_uuid TEXT,
  opened_at TEXT,
  ip TEXT,
  user_agent TEXT
)`);

app.post('/register', (req, res) => {
  const { uuid, campaign_id, email, name, sent_at } = req.body;
  db.run(
    `INSERT INTO emails (uuid, campaign_id, email, name, sent_at) VALUES (?, ?, ?, ?, ?)`,
    [uuid, campaign_id, email, name, sent_at],
    err => {
      if (err) return res.status(500).send('Erreur DB');
      res.send({ ok: true });
    }
  );
});

const pixel = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

app.get('/tracker', (req, res) => {
  const { id } = req.query;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ua = req.headers['user-agent'];
  const time = new Date().toISOString();

  db.run(
    `INSERT INTO openings (email_uuid, opened_at, ip, user_agent) VALUES (?, ?, ?, ?)`,
    [id, time, ip, ua]
  );

  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(pixel);
});

app.get('/dashboard', (req, res) => {
  db.all(`
    SELECT e.uuid, e.campaign_id, e.email, e.name, e.sent_at,
      COUNT(o.id) as open_count,
      GROUP_CONCAT(o.opened_at, '||') as open_dates
    FROM emails e
    LEFT JOIN openings o ON e.uuid = o.email_uuid
    GROUP BY e.uuid
    ORDER BY e.sent_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).send('Erreur DB');
    let html = `<!DOCTYPE html><html lang='fr'>
    <head>
      <meta charset='UTF-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1.0'>
      <title>Tracking des emails</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
    <div class="max-w-6xl mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Tracking des emails</h1>
    <div class="overflow-x-auto">
    <table class="min-w-full border rounded-xl bg-white shadow">
      <thead class="bg-blue-100">
      <tr>
        <th class="px-3 py-2">Destinataire</th>
        <th class="px-3 py-2">Nom</th>
        <th class="px-3 py-2">Campagne</th>
        <th class="px-3 py-2">Date d'envoi</th>
        <th class="px-3 py-2">Ouvertures</th>
        <th class="px-3 py-2">Dates d'ouverture</th>
      </tr>
      </thead>
      <tbody>`;
    for (const row of rows) {
      let openDates = '';
      if (row.open_dates) {
        openDates = row.open_dates
          .split('||')
          .map(date => {
            if (!date) return '';
            const d = new Date(date);
            return `<span class='block'>${d.toLocaleString('fr-FR', { hour12: false })}</span>`;
          })
          .join('');
      }
      html += `<tr class="border-t">
        <td class="px-3 py-2">${row.email}</td>
        <td class="px-3 py-2">${row.name}</td>
        <td class="px-3 py-2">${row.campaign_id}</td>
        <td class="px-3 py-2">${new Date(row.sent_at).toLocaleString('fr-FR', { hour12: false })}</td>
        <td class="px-3 py-2 text-center">${row.open_count}</td>
        <td class="px-3 py-2">${openDates}</td>
      </tr>`;
    }
    html += '</tbody></table></div></div></body></html>';
    res.send(html);
  });
});

app.get('/', (req, res) => res.send('Email tracker is running!'));

app.listen(PORT, () => {
  console.log(`Tracker server running on port ${PORT}`);
});
