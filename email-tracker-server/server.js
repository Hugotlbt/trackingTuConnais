const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./tracker.db');

// Table des envois individuels (un mail = une ligne)
db.run(`CREATE TABLE IF NOT EXISTS emails (
  uuid TEXT PRIMARY KEY,
  campaign_id TEXT,
  email TEXT,
  name TEXT,
  sent_at TEXT
)`);

// Table des ouvertures
db.run(`CREATE TABLE IF NOT EXISTS openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_uuid TEXT,
  opened_at TEXT,
  ip TEXT,
  user_agent TEXT
)`);

// Enregistrement d'un envoi (appelé par l'app desktop AVANT l'envoi du mail)
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

// Tracking pixel
const pixel = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

app.get('/tracker', (req, res) => {
  const { id } = req.query; // id = uuid de l'email envoyé
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

// Dashboard trié par date d'envoi décroissante
app.get('/dashboard', (req, res) => {
  db.all(`
    SELECT e.uuid, e.campaign_id, e.email, e.name, e.sent_at,
      COUNT(o.id) as open_count,
      GROUP_CONCAT(o.opened_at, ', ') as open_dates
    FROM emails e
    LEFT JOIN openings o ON e.uuid = o.email_uuid
    GROUP BY e.uuid
    ORDER BY e.sent_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).send('Erreur DB');
    let html = `<h1>Tracking des emails</h1>
    <table border="1" cellpadding="5">
      <tr>
        <th>Destinataire</th>
        <th>Nom</th>
        <th>Campagne</th>
        <th>Date d'envoi</th>
        <th>Ouvertures</th>
        <th>Dates d'ouverture</th>
      </tr>`;
    for (const row of rows) {
      html += `<tr>
        <td>${row.email}</td>
        <td>${row.name}</td>
        <td>${row.campaign_id}</td>
        <td>${row.sent_at}</td>
        <td>${row.open_count}</td>
        <td>${row.open_dates || ''}</td>
      </tr>`;
    }
    html += '</table>';
    res.send(html);
  });
});

app.get('/', (req, res) => res.send('Email tracker is running!'));

app.listen(PORT, () => {
  console.log(`Tracker server running on port ${PORT}`);
});
