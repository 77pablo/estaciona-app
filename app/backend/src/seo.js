// ============================================================================
// Estaciona — Páginas por ciudad para buscadores (SEO).
// ----------------------------------------------------------------------------
// Renderiza en el SERVIDOR una página por ciudad ("Estacionamientos en X") con
// su lista real (nombre, dirección, precio) para que Google la indexe y la
// gente llegue buscando "dónde estacionar en X". Sin JS: contenido plano +
// links internos entre ciudades + CTA a la app. También arma sitemap y robots.
// ============================================================================

import { ZONAS } from './data.js';
import { snapshotCiudad } from './engine.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Nombre de ciudad → slug de URL (sin tildes, minúsculas, guiones).
export function slugCiudad(nombre) {
  return (nombre || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// slug → ciudad (para resolver la URL). Cacheado del dataset.
const _slugMap = new Map();
for (const z of (ZONAS || [])) { const n = z && (z.nombre || z.ciudad); if (n) _slugMap.set(slugCiudad(n), n); }
export function ciudadDeSlug(slug) { return _slugMap.get((slug || '').toLowerCase()) || null; }

function precioTxt(f) {
  if (f.gratisAhora || f.precioHora === 0) return 'Gratis';
  if (f.precioHora == null) return 'Consultar en el lugar';
  return (f.verificado ? '' : '~') + '$' + Number(f.precioHora).toLocaleString('es-CL') + ' / hora';
}

const CSS = `
:root{--bg:#0d0f14;--surface:#161922;--text:#f3f5f7;--muted:#8a909c;--line:rgba(255,255,255,.08);--accent:#2dd4bf;--on-accent:#062925}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
a{color:var(--accent);text-decoration:none}
.wrap{max-width:820px;margin:0 auto;padding:20px 18px 60px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px}
.brand .p{width:34px;height:34px;border-radius:9px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-weight:900}
.cta{background:var(--accent);color:var(--on-accent);font-weight:800;padding:9px 16px;border-radius:10px;display:inline-block}
h1{font-size:26px;letter-spacing:-.02em;margin:22px 0 8px}
.lead{color:var(--muted);margin:0 0 18px;font-size:15px}
.hero-cta{margin:6px 0 26px}
.list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.p{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.p-nm{font-weight:700;font-size:15.5px}
.p-sub{color:var(--muted);font-size:13px;margin-top:2px}
.p-pre{color:var(--accent);font-weight:700;font-size:14px;margin-top:6px;font-variant-numeric:tabular-nums}
.otras{margin-top:34px;border-top:1px solid var(--line);padding-top:20px}
.otras h2{font-size:17px;margin:0 0 12px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips a{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:7px 13px;font-size:13.5px;color:var(--text)}
.chips a:hover{border-color:var(--accent);color:var(--accent)}
.nota{color:var(--muted);font-size:12.5px;margin-top:26px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;padding:18px;text-align:center;margin-top:30px}
footer a{color:var(--muted)}`;

// Página HTML de una ciudad. Devuelve null si la ciudad no tiene fichas.
export function paginaCiudad(ciudad, origin) {
  const fichas = snapshotCiudad(ciudad);
  if (!fichas || !fichas.length) return null;
  const zona = (ZONAS || []).find((z) => (z.nombre || z.ciudad) === ciudad);
  const region = zona ? zona.region : '';
  const n = fichas.length;
  const slug = slugCiudad(ciudad);
  const url = `${origin}/estacionamientos/${slug}`;
  const titulo = `Estacionamientos en ${ciudad} — precios, gratis y disponibilidad`;
  const desc = `${n} estacionamientos en ${ciudad}${region ? ', ' + region : ''}: precio por hora, cuáles son gratis o techados y su disponibilidad estimada. Míralos en el mapa con Estaciona.`;
  const gratis = fichas.filter((f) => f.gratisAhora || f.precioHora === 0).length;
  const techados = fichas.filter((f) => f.atributos && f.atributos.techado).length;
  const vecinas = (ZONAS || []).filter((z) => z.region === region && (z.nombre || z.ciudad) !== ciudad).slice(0, 14);
  const filas = fichas.slice(0, 200).map((f) => `<li class="p"><div class="p-nm">${esc(f.nombre)}</div>`
    + `<div class="p-sub">${esc(f.direccion || ciudad)}${f.tipo === 'calle' ? ' · En la calle' : ' · Privado'}${f.atributos && f.atributos.techado ? ' · Techado' : ''}</div>`
    + `<div class="p-pre">${esc(precioTxt(f))}</div></li>`).join('');
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} | Estaciona</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(origin)}/icons/og-image.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/icons/icon-192.png"><style>${CSS}</style></head><body>
<header><a class="brand" href="/"><span class="p">P</span> Estaciona</a><a class="cta" href="/app?ciudad=${encodeURIComponent(ciudad)}">Abrir el mapa</a></header>
<div class="wrap">
  <h1>Estacionamientos en ${esc(ciudad)}</h1>
  <p class="lead">${esc(desc)}${gratis ? ` <strong>${gratis} gratis</strong> ahora.` : ''}${techados ? ` ${techados} techados.` : ''}</p>
  <div class="hero-cta"><a class="cta" href="/app?ciudad=${encodeURIComponent(ciudad)}">Ver ${n} en el mapa →</a></div>
  <ul class="list">${filas}</ul>
  <p class="nota">Precios estimados salvo los verificados; la disponibilidad es una estimación. Confírmalos en el lugar. Actualizado por la comunidad en la app.</p>
  ${vecinas.length ? `<section class="otras"><h2>Otras ciudades${region ? ' en ' + esc(region) : ''}</h2><div class="chips">${vecinas.map((z) => { const nm = z.nombre || z.ciudad; return `<a href="/estacionamientos/${slugCiudad(nm)}">${esc(nm)}</a>`; }).join('')}</div></section>` : ''}
</div>
<footer>Estaciona — dónde estacionar en Chile · <a href="/app?ciudad=${encodeURIComponent(ciudad)}">Abrir la app</a> · <a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a></footer>
</body></html>`;
}

// Sitemap con las páginas principales + una por ciudad con datos.
export function sitemapXML(origin) {
  const urls = ['/', '/app', '/pro', '/operadores'].map((p) => origin + p);
  for (const z of (ZONAS || [])) { const nm = z && (z.nombre || z.ciudad); if (nm) urls.push(`${origin}/estacionamientos/${slugCiudad(nm)}`); }
  const body = urls.map((u) => `<url><loc>${esc(u)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function robotsTxt(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
}
