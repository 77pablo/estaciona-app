// Tests CRUD de los stores contra una base SQLite TEMPORAL y aislada.
// node --test corre cada archivo en su propio proceso, así que fijar SQLITE_PATH
// aquí arriba (antes del import dinámico de db.js) da una DB limpia solo para esto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const DB = join(tmpdir(), `estaciona-test-${process.pid}.sqlite`);
process.env.SQLITE_PATH = DB;
// Sin variables de migración: las tablas arrancan vacías.
delete process.env.VOTOS_PATH; delete process.env.APORTES_PATH; delete process.env.LUGARES_PATH;
delete process.env.DESTACADOS_PATH; delete process.env.ANALYTICS_PATH;

const { ready } = await import('../src/db.js');
const { registrarVoto, contarVotos, tallyReciente } = await import('../src/votos.js');
const { registrarAporte, resumenAportes, eliminarAporte } = await import('../src/aportes.js');
const { registrarReporte, contarReportes, reportesRecientes, eliminarReporte } = await import('../src/reportes.js');
const { agregarDestacado, listarDestacados, quitarDestacado } = await import('../src/destacados.js');
const { registrarLugar, lugaresDe, contarLugares, eliminarLugar } = await import('../src/lugares.js');
const { registrarEvento, resumenAnalytics } = await import('../src/analytics.js');

after(() => { for (const s of ['', '-shm', '-wal']) { try { rmSync(DB + s); } catch { /* noop */ } } });

test('SQLite cargó (si no, todo lo demás no tiene sentido)', () => {
  assert.equal(ready, true);
});

test('votos: registrar, contar y tally up/down', async () => {
  await registrarVoto('t-uno', true);
  await registrarVoto('t-uno', true);
  await registrarVoto('t-uno', false);
  await registrarVoto('id_invalido!', true);   // id inválido: se descarta
  assert.equal(await contarVotos(), 3);
  const t = (await tallyReciente(3))['t-uno'];
  assert.deepEqual({ up: t.up, down: t.down }, { up: 2, down: 1 });
});

test('aportes: precio (mediana) + comentarios; eliminar', async () => {
  await registrarAporte('t-dos', 1000, null);
  await registrarAporte('t-dos', 2000, null);
  await registrarAporte('t-dos', null, 'buen lugar');
  const r = (await resumenAportes())['t-dos'];
  assert.equal(r.precioReportado, 1500);   // mediana de 1000 y 2000
  assert.equal(r.nPrecios, 2);
  assert.equal(r.nComentarios, 1);
  const borrados = await eliminarAporte('t-dos', 999);   // ts que no existe
  assert.equal(borrados, 0);
});

test('reportes: se AGRUPAN por ficha y "eliminar" borra todos los de esa ficha', async () => {
  await registrarReporte('t-tres', 'cerrado');
  await registrarReporte('t-tres', 'cerrado');
  await registrarReporte('t-tres', 'precio');
  await registrarReporte('t-cuatro', 'no-existe');
  await registrarReporte('t-tres', 'motivo-invalido');   // se descarta
  assert.equal(await contarReportes(), 4);
  const grupos = await reportesRecientes();
  const g = grupos.find((x) => x.id === 't-tres');
  assert.equal(g.n, 3);
  assert.deepEqual(g.motivos, { cerrado: 2, precio: 1 });
  assert.equal(await eliminarReporte('t-tres'), 3);   // borra los 3 de la ficha
  assert.equal(await contarReportes(), 1);
});

test('destacados: agregar, listar activo y quitar', async () => {
  const r = await agregarDestacado('t-cinco', 'Destacado', 30, false, null);
  assert.equal(r.ok, true);
  const lista = await listarDestacados();
  assert.ok(lista.some((d) => d.id === 't-cinco' && d.activo));
  assert.equal(await quitarDestacado('t-cinco'), true);
});

test('lugares: registrar válido, dedupe, ciudad inválida, listar y borrar', async () => {
  const ok = await registrarLugar({ nombre: 'Sitio Prueba', lat: -38.735, lng: -72.591, ciudad: 'Temuco', tipo: 'privado', precioHora: 1000 });
  assert.equal(ok.ok, true);
  const dupe = await registrarLugar({ nombre: 'Sitio Prueba', lat: -38.7351, lng: -72.5911, ciudad: 'Temuco' });
  assert.equal(dupe.error, 'duplicado');   // mismo nombre a <60 m
  const ciudadMala = await registrarLugar({ nombre: 'Otro', lat: -38.73, lng: -72.59, ciudad: 'CiudadInexistente' });
  assert.equal(ciudadMala.error, 'ciudad');
  const fueraDeChile = await registrarLugar({ nombre: 'Lejos', lat: 40, lng: 2, ciudad: 'Temuco' });
  assert.equal(fueraDeChile.error, 'ubicacion');
  assert.equal(await contarLugares(), 1);
  const enTemuco = await lugaresDe('Temuco');
  assert.ok(enTemuco.some((l) => l.id === ok.id));
  assert.equal(await eliminarLugar(ok.id), true);
  assert.equal(await contarLugares(), 0);
});

test('analytics: cuenta eventos válidos y descarta inválidos', async () => {
  await registrarEvento('pageview', 'Temuco');
  await registrarEvento('detalle', 'Temuco', 't-seis');
  await registrarEvento('evento_que_no_existe', 'Temuco');   // fuera de la lista blanca
  const sn = await resumenAnalytics();
  assert.equal(sn.porEvento.pageview, 1);
  assert.equal(sn.porEvento.detalle, 1);
  assert.equal(sn.porEvento.evento_que_no_existe, undefined);
});
