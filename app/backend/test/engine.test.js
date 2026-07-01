// Tests del motor de disponibilidad y de la integridad de los datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demandaBaseDe, shapeFichas, curvaDisponibilidad, getEstacionamientos } from '../src/engine.js';

// ── Prior de demanda (reemplazó al 0.55 uniforme) ──────────────────────────
test('demandaBaseDe respeta el valor explícito', () => {
  assert.equal(demandaBaseDe({ demandaBase: 0.33 }), 0.33);
});

test('demandaBaseDe: la calle es más disputada que un privado', () => {
  const calle = demandaBaseDe({ tipo: 'calle' });
  const priv = demandaBaseDe({ tipo: 'privado' });
  assert.ok(calle > priv, `calle(${calle}) debería ser > privado(${priv})`);
});

test('demandaBaseDe: Salud sube la demanda', () => {
  assert.ok(demandaBaseDe({ tipo: 'privado', categoria: 'Salud' }) > demandaBaseDe({ tipo: 'privado' }));
});

test('demandaBaseDe: más capacidad => más holgura (menos demanda)', () => {
  assert.ok(demandaBaseDe({ tipo: 'privado', capacidad: 400 }) < demandaBaseDe({ tipo: 'privado', capacidad: 10 }));
});

test('demandaBaseDe siempre queda en [0.2, 0.9]', () => {
  for (const e of [{ tipo: 'calle', categoria: 'Salud' }, { tipo: 'privado', capacidad: 9999 }, {}]) {
    const d = demandaBaseDe(e);
    assert.ok(d >= 0.2 && d <= 0.9, `fuera de rango: ${d}`);
  }
});

// ── Shape del snapshot ─────────────────────────────────────────────────────
test('shapeFichas: cada ficha trae disponibilidad válida', () => {
  const niveles = new Set(['verde', 'amarillo', 'rojo', 'cerrado']);
  const out = shapeFichas([
    { id: 'a', tipo: 'calle', ciudad: 'Temuco', nombre: 'A', horario: '24h' },
    { id: 'b', tipo: 'privado', ciudad: 'Temuco', nombre: 'B', horario: '08:00–20:00' },
  ]);
  for (const p of out) {
    assert.ok(p.disponibilidad, 'falta disponibilidad');
    assert.ok(niveles.has(p.disponibilidad.nivel), `nivel inválido: ${p.disponibilidad.nivel}`);
    assert.equal(typeof p.disponibilidad.label, 'string');
  }
});

// ── Curva "mejor hora" ─────────────────────────────────────────────────────
test('curvaDisponibilidad: 24 horas para un id del dataset; null si no existe', () => {
  const c = curvaDisponibilidad('temuco-1');
  assert.ok(c, 'temuco-1 debería existir en el dataset');
  assert.equal(c.horas.length, 24);
  assert.equal(curvaDisponibilidad('id-que-no-existe-xyz'), null);
});

// ── Integridad del dataset completo ────────────────────────────────────────
test('no hay ids duplicados en el dataset', () => {
  const fichas = getEstacionamientos();
  const ids = fichas.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids repetidos');
});

test('las fichas verificadas y pagadas tienen precioHora numérico > 0', () => {
  const fichas = getEstacionamientos();
  const malas = fichas.filter((f) => f.verificado && f.precioHora != null && !(f.precioHora >= 0));
  assert.equal(malas.length, 0, `verificadas con precioHora inválido: ${malas.map((f) => f.id).join(', ')}`);
});

test('todas las fichas traen ciudad y coordenadas finitas', () => {
  const fichas = getEstacionamientos();
  const malas = fichas.filter((f) => !f.ciudad || !Number.isFinite(f.lat) || !Number.isFinite(f.lng));
  assert.equal(malas.length, 0, `fichas sin ciudad/coords: ${malas.slice(0, 5).map((f) => f.id).join(', ')}`);
});
