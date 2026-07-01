// Tests del traductor de dialecto SQLite -> PostgreSQL (db.js `toPg`).
// Correr: node --test  (o npm test). Sin dependencias externas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPg } from '../src/db.js';

test('placeholders ? -> $1,$2,...', () => {
  assert.equal(
    toPg('INSERT INTO votos(id, ok, ts) VALUES(?, ?, ?)'),
    'INSERT INTO votos(id, ok, ts) VALUES($1, $2, $3)',
  );
});

test('rowid -> seq en la poda', () => {
  assert.equal(
    toPg('DELETE FROM votos WHERE rowid NOT IN (SELECT rowid FROM votos ORDER BY ts DESC LIMIT 5000)'),
    'DELETE FROM votos WHERE seq NOT IN (SELECT seq FROM votos ORDER BY ts DESC LIMIT 5000)',
  );
});

test('INSERT OR IGNORE -> ON CONFLICT DO NOTHING', () => {
  const out = toPg('INSERT OR IGNORE INTO lugares(id, ciudad) VALUES(?, ?)');
  assert.equal(out, 'INSERT INTO lugares(id, ciudad) VALUES($1, $2) ON CONFLICT DO NOTHING');
});

test('INSERT OR REPLACE -> ON CONFLICT (pk) DO UPDATE SET no-pk=EXCLUDED', () => {
  const out = toPg('INSERT OR REPLACE INTO destacados(id, etiqueta, premium, tagline, hasta, ts) VALUES(?, ?, ?, ?, ?, ?)');
  assert.match(out, /^INSERT INTO destacados\(/);
  assert.match(out, /ON CONFLICT \(id\) DO UPDATE SET etiqueta=EXCLUDED\.etiqueta/);
  assert.ok(!/EXCLUDED\.id/.test(out), 'la PK no debe ir en el SET');
});

test('INSERT OR REPLACE con PK compuesta (an_dia)', () => {
  const out = toPg('INSERT OR REPLACE INTO an_dia(dia, tipo, n) VALUES(?, ?, ?)');
  assert.match(out, /ON CONFLICT \(dia, tipo\) DO UPDATE SET n=EXCLUDED\.n/);
});

test('DO UPDATE SET n = n + 1 se califica con la tabla (evita ambigüedad en PG)', () => {
  const out = toPg('INSERT INTO an_evento(tipo, n) VALUES(?, 1) ON CONFLICT(tipo) DO UPDATE SET n = n + 1');
  assert.match(out, /DO UPDATE SET n = an_evento\.n \+ 1/);
});

test('el GROUP BY de reportes solo cambia placeholders', () => {
  const out = toPg('SELECT id, motivo, COUNT(*) AS n, MAX(ts) AS ts FROM reportes GROUP BY id, motivo ORDER BY MAX(ts) DESC LIMIT ?');
  assert.equal(out, 'SELECT id, motivo, COUNT(*) AS n, MAX(ts) AS ts FROM reportes GROUP BY id, motivo ORDER BY MAX(ts) DESC LIMIT $1');
});

test('SELECT simple sin ? queda igual', () => {
  const sql = 'SELECT COUNT(*) AS c FROM votos';
  assert.equal(toPg(sql), sql);
});
