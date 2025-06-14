const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 10000;

// --- BASE SQLITE ---
const db = new sqlite3.Database('./tracker.db');
db.run(`CREATE TABLE IF NOT EXISTS openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT,
  email TEXT,
  name TEXT,
  opened_at TEXT,
  ip TEXT,
  user_agent TEXT
)`);

// --- 1x1 transparent GIF ---
const pixel = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

// --- ROUTE TRACKER ---
app.get('/tracker', (req, res) => {
  const { id } = req.query;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ua = req.headers['user-agent'];
  const time = new Date().toISOString();

  // id attendu : "campaignId_email_name"
  let email = '', name = '';
  if (id) {
    const parts = id.split('_');
    email = parts[1] || '';
    name = parts[2] ? decodeURIComponent(parts[2]) : '';
  }

  db.run(
    `INSERT INTO openings (tracking_id, email, name, opened_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, email, name, time, ip, ua]
  );

  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(pixel);
});

// --- ROUTE DASHBOARD ---
app.get('/dashboard', (req, res) => {
  db.all(`
    SELECT email, name,
      COUNT(*) as open_count,
      GROUP_CONCAT(opened_at, ', ') as dates,
      GROUP_CONCAT(strftime('%H', opened_at), ',') as hours
    FROM openings
    GROUP BY email, name
    ORDER BY open_count DESC
  `, (err, rows) => {
    if (err) return res.status(500).send('Erreur DB');
    let html = `<h1>Tracking des emails</h1>
    <table border="1" cellpadding="5">
      <tr>
        <th>Email</th>
        <th>Nom</th>
        <th>Ouvertures</th>
        <th>Dates/Heures</th>
        <th>Heure préférée d'ouverture</th>
      </tr>`;
    for (const row of rows) {
      // Statistique heure préférée
      const hoursArr = row.hours ? row.hours.split(',').filter(Boolean) : [];
      const hourCounts = {};
      for (const h of hoursArr) hourCounts[h] = (hourCounts[h] || 0) + 1;
      const favoriteHour = Object.entries(hourCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '-';
      html += `<tr>
        <td>${row.email}</td>
        <td>${row.name}</td>
        <td>${row.open_count}</td>
        <td>${row.dates}</td>
        <td>${favoriteHour}h</td>
      </tr>`;
    }
    html += '</table>';
    res.send(html);
  });
});

// --- ROUTE SANTÉ ---
app.get('/', (req, res) => res.send('Email tracker is running!'));

app.listen(PORT, () => {
  console.log(`Tracker server running on port ${PORT}`);
});
