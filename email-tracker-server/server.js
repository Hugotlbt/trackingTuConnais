const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tracker.db');

// Création de la table si elle n'existe pas
db.run(`CREATE TABLE IF NOT EXISTS openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT,
  email TEXT,
  name TEXT,
  opened_at TEXT,
  ip TEXT,
  user_agent TEXT
)`);

const app = express();
const PORT = process.env.PORT || 10000; // Render utilisera la variable d'env PORT

// Fichier de log (simple, pour démo)
const LOG_FILE = process.env.LOG_FILE || './tracker.log';

// 1x1 transparent GIF
const pixel = Buffer.from(
    'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
    'base64'
);

app.get('/tracker', (req, res) => {
    const { id } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ua = req.headers['user-agent'];
    const time = new Date().toISOString();

    // Log format: time, id, ip, user-agent
    const logLine = `${time}\t${id}\t${ip}\t${ua}\n`;
    fs.appendFile(LOG_FILE, logLine, err => {
        if (err) console.error('Log error:', err);
    });

    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(pixel);
});

// Simple healthcheck
app.get('/', (req, res) => res.send('Email tracker is running!'));

app.listen(PORT, () => {
    console.log(`Tracker server running on port ${PORT}`);
});
