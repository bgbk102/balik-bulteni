import { SPOTS, WINDOWS, buildDays, windName, fmt } from './engine.js';

const WX_POINT = { lat: 36.97, lon: 27.33 };      // Bağla–Karaincir arası kara noktası (rüzgâr, basınç)
const SEA_POINT = { lat: 36.93, lon: 27.33 };     // Koyların hemen açığı (dalga, deniz suyu)
const CACHE_KEY = 'bb-forecast-v1';
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_DAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const state = { days: [], sel: 0, tab: 'gun', insights: null, fetchedAt: null, map: null, mapLayer: null };
const $ = s => document.querySelector(s);

// ---------- veri ----------
function urls() {
  const common = `timezone=Europe%2FIstanbul&forecast_days=7&past_days=3`;
  return {
    wx: `https://api.open-meteo.com/v1/forecast?latitude=${WX_POINT.lat}&longitude=${WX_POINT.lon}` +
      `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation,cloud_cover,temperature_2m` +
      `&daily=sunrise,sunset&wind_speed_unit=kn&${common}`,
    marine: `https://marine-api.open-meteo.com/v1/marine?latitude=${SEA_POINT.lat}&longitude=${SEA_POINT.lon}` +
      `&hourly=wave_height,wave_period,sea_surface_temperature&${common}`
  };
}

async function getJSON(url, ms = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

async function load(force) {
  $('#refresh').classList.add('spin');
  setStatus('Tahmin yükleniyor…');
  const u = urls();
  let wx, marine, from = 'canlı';
  try {
    [wx, marine] = await Promise.all([getJSON(u.wx), getJSON(u.marine).catch(() => null)]);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ wx, marine, at: Date.now() })); } catch (e) {}
    state.fetchedAt = new Date();
  } catch (e) {
    let c = null; try { c = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) {}
    if (!c) { setStatus('Tahmin alınamadı. İnternet bağlantını kontrol edip yenile.'); $('#refresh').classList.remove('spin'); renderError(); return; }
    ({ wx, marine } = c); state.fetchedAt = new Date(c.at); from = 'kayıtlı';
  }
  const today = isoToday();
  state.days = buildDays(wx, marine).filter(d => d.date >= today);
  if (!force) state.sel = 0;
  state.insights = await getJSON('data/insights.json?ts=' + Date.now(), 8000).catch(() => state.insights);
  const t = state.fetchedAt;
  setStatus(`${from === 'canlı' ? 'Güncel' : 'Çevrimdışı, son kayıt'} · ${pad(t.getHours())}:${pad(t.getMinutes())} · Open-Meteo`);
  $('#refresh').classList.remove('spin');
  renderAll();
}

// ---------- yardımcılar ----------
const pad = n => String(n).padStart(2, '0');
function isoToday() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dParts(iso) { const d = new Date(iso + 'T12:00:00'); return { d, short: TR_DAYS[d.getDay()], long: TR_DAYS_LONG[d.getDay()], label: `${d.getDate()} ${TR_MONTHS[d.getMonth()]}` }; }
const col = s => s >= 6.5 ? 'var(--good)' : s >= 5 ? 'var(--mid)' : 'var(--bad)';
const colHex = s => s >= 6.5 ? '#3fd08a' : s >= 5 ? '#f2b84b' : '#ff7a66';
const badge = s => s >= 6.5 ? 'b-good' : s >= 5 ? 'b-mid' : 'b-bad';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function verdict(s) { return s >= 7.5 ? 'Çok iyi gün' : s >= 6.5 ? 'İyi gün' : s >= 5 ? 'Orta gün' : s >= 3.5 ? 'Zayıf gün' : 'Kötü gün'; }
function setStatus(t) { $('#status').textContent = t; }

// ---------- SVG parçaları ----------
function gauge(score) {
  const r = 62, c = 2 * Math.PI * r, arc = c * 0.75, val = arc * score / 10;
  return `<svg class="gauge" viewBox="0 0 150 150" role="img" aria-label="Puan ${fmt(score)} / 10">
    <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#ff7a66"/><stop offset=".5" stop-color="#f2b84b"/><stop offset="1" stop-color="#3fd08a"/></linearGradient></defs>
    <g transform="rotate(135 75 75)">
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="#1d4a5d" stroke-width="12" stroke-linecap="round" stroke-dasharray="${arc} ${c}"/>
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${val} ${c}">
        <animate attributeName="stroke-dasharray" from="0 ${c}" to="${val} ${c}" dur=".9s" fill="freeze"/></circle>
    </g>
    <text x="75" y="84" text-anchor="middle" class="val" fill="#e6f2f4">${fmt(score)}</text>
    <text x="75" y="106" text-anchor="middle" font-size="12" fill="#8fb1bb" font-family="Source Sans 3, sans-serif">/ 10</text>
  </svg>`;
}
function ring(score) {
  const r = 19, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="${r}" fill="none" stroke="#1d4a5d" stroke-width="5"/>
    <circle cx="23" cy="23" r="${r}" fill="none" stroke="${colHex(score)}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c * score / 10} ${c}" transform="rotate(-90 23 23)"/>
    <text x="23" y="28" text-anchor="middle" font-size="13" font-weight="800" fill="#e6f2f4" font-family="Bricolage Grotesque, sans-serif">${fmt(score)}</text></svg>`;
}
function spark(hours) {
  const hs = hours; if (hs.length < 2) return '';
  const pts = hs.map((h, i) => `${(i / (hs.length - 1) * 76).toFixed(1)},${(21 - h.best.score / 10 * 20).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 76 22" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="#3fb6d9" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function arrowSvg(deg, size = 16, color = 'currentColor') {
  const r = (deg + 180) % 360; // gittiği yön
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${r}deg)"><path d="M12 3v15M12 21l-5.5-6.5M12 21l5.5-6.5" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function compass(deg, kn) {
  const r = (deg + 180) % 360;
  const marks = ['K', 'D', 'G', 'B'].map((l, i) => { const a = i * 90 * Math.PI / 180; return `<text x="${27 + Math.sin(a) * 21}" y="${30 + -Math.cos(a) * 21}" text-anchor="middle" font-size="7" fill="#8fb1bb">${l}</text>`; }).join('');
  return `<svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="25" fill="#061820" stroke="#1d4a5d"/>${marks}
    <g transform="rotate(${r} 27 27)"><path d="M27 10v30M27 44l-6-8M27 44l6-8" stroke="#9fe3f2" stroke-width="3" stroke-linecap="round" fill="none"/></g></svg>`;
}
function moonSvg(illum, waxing) {
  // aydınlık kısım: terminatör elips
  const r = 22, k = 1 - 2 * illum;
  const path = `M27 ${27 - r} A${r} ${r} 0 0 ${waxing ? 1 : 0} 27 ${27 + r} A${Math.abs(k * r)} ${r} 0 0 ${(k > 0) === waxing ? 0 : 1} 27 ${27 - r}`;
  return `<svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="${r}" fill="#1a3340"/><path d="${path}" fill="#f3ead2"/></svg>`;
}
function winIcon(id) {
  const s = 'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"';
  if (id === 'sabah') return `<svg class="ico" viewBox="0 0 32 32" style="color:#f2b84b"><path d="M4 23h24M9 23a7 7 0 0 1 14 0" ${s}/><path d="M16 8v4M7 13l2.5 2.5M25 13l-2.5 2.5M16 4l-2 2M16 4l2 2" ${s}/><path d="M7 28h18" ${s} opacity=".5"/></svg>`;
  if (id === 'oglen') return `<svg class="ico" viewBox="0 0 32 32" style="color:#ffd76a"><circle cx="16" cy="16" r="6" ${s}/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l2.8 2.8M22.2 22.2 25 25M7 25l2.8-2.8M22.2 9.8 25 7" ${s}/></svg>`;
  if (id === 'aksam') return `<svg class="ico" viewBox="0 0 32 32" style="color:#ff9a6b"><path d="M4 23h24M9 23a7 7 0 0 1 14 0" ${s}/><path d="M16 8v4M7 13l2.5 2.5M25 13l-2.5 2.5M16 12l-2-2M16 12l2-2" ${s}/><path d="M7 28h18" ${s} opacity=".5"/></svg>`;
  return `<svg class="ico" viewBox="0 0 32 32" style="color:#b9c8ff"><path d="M21 5a11 11 0 1 0 6 18A9 9 0 0 1 21 5z" ${s}/><path d="M7 7h.01M11 4h.01M5 12h.01" ${s} stroke-width="3"/></svg>`;
}
function fishIcon(lvl) {
  const c = lvl === 'hi' ? '#3fd08a' : lvl === 'md' ? '#f2b84b' : '#ff7a66';
  return `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M3 12c6-8 18-9 26 0-8 9-20 8-26 0z" fill="${c}" opacity=".9"/><path d="M29 12l8-6v12z" fill="${c}"/><circle cx="10" cy="10.5" r="1.6" fill="#061820"/></svg>`;
}

// ---------- saatlik grafik ----------
function hourlyChart(day) {
  const hs = day.hours;
  if (!hs.length) return '';
  const W = 760, X0 = 34, X1 = W - 34, top = 18, sh = 130, wb = 176, wh = 70;
  const n = hs.length, x = i => X0 + (i / (n - 1)) * (X1 - X0);
  const yS = v => top + sh - (v / 10) * sh;
  const maxKn = Math.max(20, ...hs.map(h => h.gust));
  const yW = v => wb + wh - (v / maxKn) * wh;
  const maxWave = Math.max(1.5, ...hs.map(h => h.wave ?? 0));
  const yV = v => wb + wh - (v / maxWave) * wh;

  // dilim bantları
  let bands = '', prev = null, start = 0;
  const bandCol = { sabah: '#f2b84b', oglen: '#ffd76a', aksam: '#ff9a6b', gece: '#7d8dff' };
  const names = { sabah: 'SABAH', oglen: 'ÖĞLEN', aksam: 'AKŞAM', gece: 'GECE' };
  hs.forEach((h, i) => {
    if (h.win !== prev || i === n - 1) {
      if (prev != null) {
        const xa = x(start) - (start ? (x(1) - x(0)) / 2 : 0), xb = (i === n - 1 && h.win === prev) ? X1 : x(i) - (x(1) - x(0)) / 2;
        bands += `<rect x="${xa}" y="${top}" width="${Math.max(0, xb - xa)}" height="${sh}" fill="${bandCol[prev]}" opacity=".07"/>` +
          `<text x="${(xa + xb) / 2}" y="${top + 12}" text-anchor="middle" font-size="9.5" letter-spacing="1" fill="${bandCol[prev]}" font-weight="700" font-family="Source Sans 3, sans-serif">${names[prev]}</text>`;
      }
      prev = h.win; start = i;
    }
  });

  const line = hs.map((h, i) => `${x(i).toFixed(1)},${yS(h.best.score).toFixed(1)}`).join(' ');
  const area = `${X0},${top + sh} ${line} ${X1},${top + sh}`;
  const grid = [2.5, 5, 7.5, 10].map(v => `<line x1="${X0}" x2="${X1}" y1="${yS(v)}" y2="${yS(v)}" stroke="#1d4a5d" stroke-dasharray="2 4"/><text x="${X0 - 6}" y="${yS(v) + 3}" text-anchor="end" font-size="9" fill="#8fb1bb">${v}</text>`).join('');
  const bars = hs.map((h, i) => {
    const bw = Math.max(4, (X1 - X0) / n * 0.55);
    return `<rect x="${x(i) - bw / 2}" y="${yW(h.gust)}" width="${bw}" height="${wb + wh - yW(h.gust)}" fill="#3fb6d9" opacity=".22" rx="2"/>` +
      `<rect x="${x(i) - bw / 2}" y="${yW(h.wind)}" width="${bw}" height="${wb + wh - yW(h.wind)}" fill="#3fb6d9" opacity=".75" rx="2"/>`;
  }).join('');
  const arrows = hs.map((h, i) => i % 2 ? '' : `<g transform="translate(${x(i)} ${wb - 12}) rotate(${(h.dir + 180) % 360})"><path d="M0 -6v12M0 7l-3.5-4M0 7l3.5-4" stroke="#9fe3f2" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`).join('');
  const wave = hs.some(h => h.wave != null) ? `<polyline points="${hs.map((h, i) => h.wave == null ? '' : `${x(i).toFixed(1)},${yV(h.wave).toFixed(1)}`).filter(Boolean).join(' ')}" fill="none" stroke="#f3ead2" stroke-width="2" stroke-dasharray="5 3"/>` : '';
  const labels = hs.map((h, i) => (h.min % 120 === 0) ? `<text x="${x(i)}" y="${wb + wh + 16}" text-anchor="middle" font-size="10" fill="#8fb1bb" font-family="JetBrains Mono, monospace">${h.t.slice(11, 13)}</text>` : '').join('');
  const dots = hs.map((h, i) => (i % 3 === 0) ? `<circle cx="${x(i)}" cy="${yS(h.best.score)}" r="2.6" fill="${colHex(h.best.score)}"/>` : '').join('');

  let now = '';
  if (day.date === isoToday()) {
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    const fi = (m - hs[0].min) / 60;
    if (fi >= 0 && fi <= n - 1) { const xn = X0 + fi / (n - 1) * (X1 - X0); now = `<line x1="${xn}" x2="${xn}" y1="${top}" y2="${wb + wh}" stroke="#e6f2f4" stroke-width="1.2" opacity=".7"/><text x="${xn}" y="${top - 5}" text-anchor="middle" font-size="9.5" fill="#e6f2f4" font-weight="700">ŞİMDİ</text>`; }
  }
  const bh = day.bestHour, bi = hs.indexOf(bh);
  const star = bi >= 0 ? `<circle cx="${x(bi)}" cy="${yS(bh.best.score)}" r="7" fill="none" stroke="#3fd08a" stroke-width="2.4"><animate attributeName="r" values="6;9;6" dur="2.2s" repeatCount="indefinite"/></circle>` : '';

  return `<svg class="chart" viewBox="0 0 ${W} ${wb + wh + 24}" role="img" aria-label="Saatlik balık puanı, rüzgâr ve dalga">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd08a" stop-opacity=".55"/><stop offset=".55" stop-color="#3fb6d9" stop-opacity=".25"/><stop offset="1" stop-color="#3fb6d9" stop-opacity="0"/></linearGradient></defs>
    ${bands}${grid}<polygon points="${area}" fill="url(#ag)"/><polyline points="${line}" fill="none" stroke="#9fe3f2" stroke-width="2.4" stroke-linejoin="round"/>${dots}${star}
    <text x="${X0}" y="${wb - 22}" font-size="9.5" fill="#8fb1bb" font-weight="700" letter-spacing="1">RÜZGÂR (kn) · DALGA (m)</text>
    <line x1="${X0}" x2="${X1}" y1="${wb + wh}" y2="${wb + wh}" stroke="#1d4a5d"/>${bars}${arrows}${wave}
    <text x="${X1 + 4}" y="${yW(maxKn) + 3}" font-size="9" fill="#3fb6d9">${Math.round(maxKn)}</text>
    <text x="${X1 + 4}" y="${yV(maxWave) + 12}" font-size="9" fill="#f3ead2">${fmt(maxWave)}m</text>
    ${labels}${now}</svg>`;
}

// ---------- render ----------
function renderAll() { renderStrip(); renderDay(); if (state.tab === 'hafta') renderWeek(); if (state.tab === 'harita') renderMap(); if (state.tab === 'defter') renderDefter(); }

function renderError() {
  $('#day').innerHTML = `<div class="card"><h2>Tahmin alınamadı</h2><p class="muted" style="margin-top:6px">Uygulama hava ve deniz tahminini Open-Meteo'dan çekiyor. İnternete bağlanınca sağ üstteki yenile düğmesine bas.</p></div>`;
}

function renderStrip() {
  const best = state.days.reduce((a, d, i) => d.score > state.days[a].score ? i : a, 0);
  $('#strip').innerHTML = state.days.map((d, i) => {
    const p = dParts(d.date);
    return `<button class="dchip" role="tab" type="button" aria-selected="${i === state.sel}" data-i="${i}">
      ${i === best ? '<span class="crown">EN İYİ</span>' : ''}
      <span class="d1">${i === 0 ? 'Bugün' : p.short}</span><span class="d2">${p.label}</span>
      ${ring(d.score)}${spark(d.hours)}
      <span class="d2" style="display:flex;gap:4px;align-items:center">${arrowSvg(d.summary.dirMorning ?? 0, 13)}${Math.round(d.summary.windMax)} kn</span>
    </button>`;
  }).join('');
  $('#strip').querySelectorAll('.dchip').forEach(b => b.addEventListener('click', () => { state.sel = +b.dataset.i; renderStrip(); renderDay(); if (state.map) renderMap(); }));
}

function renderDay() {
  const d = state.days[state.sel]; if (!d) return;
  const p = dParts(d.date), s = d.summary, ins = state.insights?.days?.[d.date];
  const wins = d.windows.filter(w => w.score != null);
  const sortedW = [...wins].sort((a, b) => b.score - a.score);
  const bw = d.bestWin, second = sortedW[1];
  const topReasons = [...new Set(bw.top.best.reasons)].slice(0, 3).join(', ');
  const compare = second ? `${bw.name} ${fmt(bw.score)} ile en iyi dilim${second.score < bw.score ? `, ${second.name.toLowerCase()}tan ${fmt(bw.score - second.score)} puan önde` : `, ${second.name.toLowerCase()} ile başa baş`}.` : '';
  const bestSpot = d.spots[0];
  const dirM = s.dirMorning, dirE = s.dirEvening;
  const dirTxt = dirM == null ? '' : (windName(dirM) === windName(dirE ?? dirM) ? windName(dirM) : `${windName(dirM)} → ${windName(dirE)}`);
  const pTrend = s.pStart && s.pEnd ? (s.pEnd - s.pStart) : 0;
  const alerts = [...(ins?.alert ? [ins.alert] : []), ...d.safety];

  $('#day').innerHTML = `
  <section class="card hero">
    ${gauge(d.score)}
    <div>
      <span class="eyebrow">${state.sel === 0 ? 'Bugün · ' : ''}${p.label} ${p.long}</span>
      <p class="verdict">${verdict(d.score)}</p>
      <p class="muted" style="margin-top:4px">${esc(compare)} En iyi saat <b class="num">${d.bestHour.t.slice(11, 16)}</b>, ${esc(bestSpot.spot.short)}${bestSpot.edge && bestSpot.edge !== 'tüm koy' ? ' ' + esc(bestSpot.edge) : ''}.</p>
      <div class="chips">
        <span class="chip good">${winIcon(bw.id).replace('class="ico"', 'width="18" height="18"')} En iyi: <b>${bw.name}</b></span>
        <span class="chip">${arrowSvg(dirM ?? 0, 14)} <b>${Math.round(s.windMin)}–${Math.round(s.windMax)} kn</b> ${esc(dirTxt)}</span>
        <span class="chip">Dalga <b>${s.waveMax == null ? '–' : fmt(s.waveMax) + ' m'}</b></span>
      </div>
      ${ins?.note ? `<p class="note"><b>Claude'un notu:</b> ${esc(ins.note)}</p>` : ''}
    </div>
  </section>
  ${alerts.length ? `<div class="alert"><strong>Güvenlik</strong>${alerts.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}

  <section class="card">
    <div class="section-h"><h2>Sabah mı, öğlen mi, akşam mı, gece mi?</h2></div>
    <div class="wins">${WINDOWS.map(w => {
      const x = d.windows.find(v => v.id === w.id);
      if (!x || x.score == null) return `<div class="win">${winIcon(w.id)}<span class="eyebrow">${w.name}</span><span class="muted">Veri yok</span></div>`;
      const why = [...new Set(x.top.best.reasons)].slice(0, 2).join(', ');
      return `<div class="win ${x.id === bw.id ? 'best' : ''}">${x.id === bw.id ? '<span class="tag">EN İYİ</span>' : ''}
        ${winIcon(w.id)}<span class="eyebrow">${w.name}</span>
        <span class="sc" style="color:${col(x.score)}">${fmt(x.score)}</span>
        <div class="meter"><i style="width:${x.score * 10}%;background:${col(x.score)}"></i></div>
        <span class="rng">${x.from}–${x.to} · en iyi ${x.top.t.slice(11, 16)}</span>
        <span class="why">${esc(why)}</span></div>`;
    }).join('')}</div>
    <p class="muted" style="margin-top:10px;font-size:.88rem">${esc(bw.name)} neden önde: ${esc(topReasons)}.</p>
  </section>

  <section class="card">
    <div class="section-h"><h2>Saat saat</h2><span class="eyebrow">en iyi noktaya göre</span></div>
    <div class="chart-wrap">${hourlyChart(d)}</div>
    <div class="legend"><span><i style="background:#9fe3f2"></i>Balık puanı</span><span><i style="background:#3fb6d9"></i>Rüzgâr (açık renk: hamle)</span><span><i style="background:#f3ead2"></i>Dalga</span><span>Oklar rüzgârın gittiği yönü gösterir</span></div>
  </section>

  <section class="card">
    <div class="section-h"><h2>Noktalar</h2><span class="eyebrow">sabah + akşam ortalaması</span></div>
    <div class="spots">${d.spots.map(x => `
      <div class="spot ${x.spot.main ? 'main' : ''}">${ring(x.score)}
        <div><h3>${esc(x.spot.name)}</h3>
          <span class="badge ${x.sheltered ? 'b-good' : x.exposed ? 'b-bad' : 'b-mid'}">${x.sheltered ? 'KUYTU' : x.exposed ? 'RÜZGÂRA AÇIK' : 'YANDAN RÜZGÂR'}</span>
          <p>${x.edge ? 'Kuytu kenar: ' + esc(x.edge) + '. ' : ''}Kıyıda dalga ~${fmt(x.maxWave)} m.</p></div></div>`).join('')}</div>
  </section>

  <section class="card">
    <div class="section-h"><h2>Deniz ve hava</h2></div>
    <div class="conds">
      <div class="cond"><span class="eyebrow">Rüzgâr</span><div class="compass-row">${compass(dirM ?? 0)}<div><span class="v">${Math.round(s.windMin)}–${Math.round(s.windMax)} kn</span><br><small>${esc(dirTxt)} · hamle ${Math.round(s.gustMax)}</small></div></div></div>
      <div class="cond"><span class="eyebrow">Dalga (açık)</span><span class="v">${s.waveMax == null ? 'veri yok' : fmt(s.waveMax) + ' m'}</span><small>${s.period ? 'periyot ' + fmt(s.period) + ' sn' : ''}</small></div>
      <div class="cond"><span class="eyebrow">Basınç</span><span class="v">${s.pStart ? Math.round(s.pStart) + ' → ' + Math.round(s.pEnd) : '–'} <span style="color:${pTrend < -1 ? 'var(--good)' : pTrend > 2 ? 'var(--bad)' : 'var(--muted)'}">${pTrend < -1 ? '↓' : pTrend > 1 ? '↑' : '→'}</span></span><small>hPa, 09:00 → 21:00</small></div>
      <div class="cond"><span class="eyebrow">Yağış / bulut</span><span class="v">${fmt(s.rain)} mm</span><small>bulut %${Math.round(s.cloud)} · son 48 saat ${fmt(s.rain48)} mm</small></div>
      <div class="cond"><span class="eyebrow">Hava / su</span><span class="v">${Math.round(s.tMin)}–${Math.round(s.tMax)}° / ${s.sst == null ? '–' : fmt(s.sst) + '°'}</span><small>°C</small></div>
      <div class="cond"><span class="eyebrow">Ay</span><div class="compass-row">${moonSvg(d.moon.illum, d.moon.waxing)}<div><span class="v">%${Math.round(d.moon.illum * 100)}</span><br><small>${d.moon.waxing ? 'büyüyen' : 'küçülen'}</small></div></div></div>
      <div class="cond"><span class="eyebrow">Gün doğumu / batımı</span><span class="v">${d.sun.rise} / ${d.sun.set}</span><small>Bodrum</small></div>
    </div>
  </section>

  <section class="card">
    <div class="section-h"><h2>Hedef ve takım</h2></div>
    <div class="targets">${d.targets.map(t => `
      <div class="target">${fishIcon(t.lvl)}<div><b>${esc(t.sp)}</b><div class="lure">${esc(t.lure)}</div><div class="how">${esc(t.how)}</div></div>
      <span class="badge ${t.lvl === 'hi' ? 'b-good' : t.lvl === 'md' ? 'b-mid' : 'b-bad'}">${t.lvl === 'hi' ? 'YÜKSEK' : t.lvl === 'md' ? 'ORTA' : 'DÜŞÜK'}</span></div>`).join('')}</div>
  </section>`;
}

function renderWeek() {
  const all = [];
  state.days.forEach((d, i) => d.windows.forEach(w => { if (w.score != null) all.push({ i, d, w }); }));
  all.sort((a, b) => b.w.score - a.w.score);
  const head = state.insights?.headline;
  $('#tab-hafta').innerHTML = `
  ${head ? `<div class="card"><span class="eyebrow">Claude'un haftalık notu</span><p style="margin-top:6px">${esc(head)}</p></div>` : ''}
  <section class="card">
    <div class="section-h"><h2>Haftanın en iyi 5 penceresi</h2></div>
    <div class="rank">${all.slice(0, 5).map((x, k) => {
      const p = dParts(x.d.date);
      return `<button class="rank-row" type="button" data-i="${x.i}"><span class="pos">${k + 1}</span>
        <span><b style="font-family:var(--display)">${x.i === 0 ? 'Bugün' : p.long} ${x.w.name.toLowerCase()}</b><br><span class="muted" style="font-size:.85rem">${p.label} · ${x.w.from}–${x.w.to} · ${esc(x.w.top.best.spot.short)}</span></span>
        <span class="sc" style="color:${col(x.w.score)}">${fmt(x.w.score)}</span></button>`;
    }).join('')}</div>
  </section>
  <section class="card">
    <div class="section-h"><h2>Gün ve dilim haritası</h2><span class="eyebrow">dokun: güne git</span></div>
    <div class="heat"><span></span>${WINDOWS.map(w => `<span class="h">${w.name}</span>`).join('')}
      ${state.days.map((d, i) => `<span class="dl">${i === 0 ? 'Bugün' : dParts(d.date).short} <span class="muted" style="font-weight:400;font-size:.75rem">${dParts(d.date).d.getDate()}</span></span>` +
        WINDOWS.map(w => { const x = d.windows.find(v => v.id === w.id); return x?.score == null ? '<span class="muted" style="text-align:center">–</span>' : `<button type="button" data-i="${i}" style="background:${colHex(x.score)};opacity:${0.45 + x.score / 18}">${fmt(x.score)}</button>`; }).join('')).join('')}
    </div>
  </section>
  <section class="card">
    <div class="section-h"><h2>Rüzgâr ve dalga gidişatı</h2></div>
    ${weekChart()}
    <p class="muted" style="font-size:.85rem;margin-top:8px">İlk 2–3 gün en güvenilir. Sonraki günler eğilim gösterir; uygulamayı her açtığında tahmin yeniden hesaplanır.</p>
  </section>`;
  $('#tab-hafta').querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { state.sel = +b.dataset.i; switchTab('gun'); renderStrip(); renderDay(); }));
}

function weekChart() {
  const hs = state.days.flatMap(d => d.hours);
  if (!hs.length) return '';
  const W = 760, H = 170, X0 = 30, X1 = W - 30, n = hs.length, x = i => X0 + i / (n - 1) * (X1 - X0);
  const maxKn = Math.max(20, ...hs.map(h => h.gust)), yK = v => 140 - v / maxKn * 120;
  const maxWv = Math.max(1.5, ...hs.map(h => h.wave ?? 0)), yV = v => 140 - v / maxWv * 120;
  const gust = hs.map((h, i) => `${x(i).toFixed(1)},${yK(h.gust).toFixed(1)}`).join(' ');
  const wind = hs.map((h, i) => `${x(i).toFixed(1)},${yK(h.wind).toFixed(1)}`).join(' ');
  const wave = hs.filter(h => h.wave != null).length ? hs.map((h, i) => h.wave == null ? '' : `${x(i).toFixed(1)},${yV(h.wave).toFixed(1)}`).filter(Boolean).join(' ') : '';
  let sep = '', lastD = null;
  hs.forEach((h, i) => { if (h.date !== lastD) { lastD = h.date; sep += `<line x1="${x(i)}" x2="${x(i)}" y1="16" y2="140" stroke="#1d4a5d"/><text x="${x(i) + 4}" y="158" font-size="10" fill="#8fb1bb">${dParts(h.date).short}</text>`; } });
  const ref = [12, 18].map(v => `<line x1="${X0}" x2="${X1}" y1="${yK(v)}" y2="${yK(v)}" stroke="${v === 12 ? '#3fd08a' : '#ff7a66'}" stroke-dasharray="3 5" opacity=".6"/><text x="${X1 + 3}" y="${yK(v) + 3}" font-size="9" fill="${v === 12 ? '#3fd08a' : '#ff7a66'}">${v}kn</text>`).join('');
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="7 günlük rüzgâr ve dalga">${sep}${ref}
    <polyline points="${gust}" fill="none" stroke="#3fb6d9" stroke-width="1.2" opacity=".45"/>
    <polyline points="${wind}" fill="none" stroke="#3fb6d9" stroke-width="2.2"/>
    ${wave ? `<polyline points="${wave}" fill="none" stroke="#f3ead2" stroke-width="2" stroke-dasharray="5 3"/>` : ''}</svg></div>
    <div class="legend"><span><i style="background:#3fb6d9"></i>Rüzgâr (ince: hamle)</span><span><i style="background:#f3ead2"></i>Dalga</span><span><i style="background:#3fd08a"></i>12 kn LRF üst sınırı</span><span><i style="background:#ff7a66"></i>18 kn zor</span></div>`;
}

function renderMap() {
  const d = state.days[state.sel]; if (!d) return;
  if (typeof L === 'undefined') { $('#map').innerHTML = '<p class="muted" style="padding:16px">Harita için internet bağlantısı gerekiyor.</p>'; return; }
  if (!state.map) {
    state.map = L.map('map', { zoomControl: true, attributionControl: true }).setView([36.962, 27.325], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Uydu: Esri, Maxar, Earthstar Geographics'
    }).addTo(state.map);
    state.mapLayer = L.layerGroup().addTo(state.map);
  }
  state.mapLayer.clearLayers();
  d.spots.forEach(x => {
    const icon = L.divIcon({ className: '', html: `<div class="pin" style="background:${colHex(x.score)}">${fmt(x.score)}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
    L.marker([x.spot.lat, x.spot.lon], { icon, title: x.spot.name }).addTo(state.mapLayer)
      .bindPopup(`<b>${esc(x.spot.name)}</b><br>${x.sheltered ? 'Kuytu' : x.exposed ? 'Rüzgâra açık' : 'Yandan rüzgâr'}${x.edge ? ' · ' + esc(x.edge) : ''}`);
  });
  setTimeout(() => state.map.invalidateSize(), 50);
  const s = d.summary;
  $('#map-legend').innerHTML = `<div class="wind-badge">${arrowSvg(s.dirMorning ?? 0, 22, '#9fe3f2')}<span><b>${dParts(d.date).label}</b> · ${windName(s.dirMorning ?? 0)} ${Math.round(s.windMin)}–${Math.round(s.windMax)} kn. İşaretlerdeki sayı noktanın sabah+akşam puanı. Konumlar yaklaşık.</span></div>`;
}

function renderDefter() {
  const def = state.insights?.defter || [];
  $('#tab-defter').innerHTML = `
  <section class="card" id="install-card" ${deferredPrompt ? '' : 'hidden'}>
    <h2>Telefona yükle</h2><p class="muted" style="margin:6px 0 10px">Ana ekrana ikon olarak eklenir, tam ekran açılır.</p>
    <button class="icon-btn" style="width:auto;padding:0 16px" id="install-btn" type="button">Uygulamayı yükle</button>
  </section>
  <section class="card">
    <div class="section-h"><h2>Av defteri</h2></div>
    <p class="muted" style="font-size:.9rem;margin-bottom:10px">Avdan dönünce Claude'a yaz: tarih, nokta ve kenar, saat, sahte ve renk, ne tuttun. Kayıtlar puanlamayı senin noktalarına göre ayarlar.</p>
    <div class="tbl"><table><thead><tr><th>Nokta</th><th>Tür</th><th>Sıklık</th><th>Not</th></tr></thead>
    <tbody>${def.map(r => `<tr><td>${esc(r.spot)}</td><td><b>${esc(r.species)}</b></td><td>${esc(r.freq)}</td><td class="muted">${esc(r.note)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Henüz kayıt yok.</td></tr>'}</tbody></table></div>
  </section>
  <section class="card">
    <div class="section-h"><h2>Puanlama nasıl yapılıyor</h2></div>
    <details open><summary>Rüzgâr ve noktalar</summary><ul>
      <li>Dört nokta da güneye bakar. Kuzeyli rüzgârda (poyraz, yıldız, karayel) rüzgâr arkadan gelir, deniz düz, atış uzun: LRF için en iyisi.</li>
      <li>Lodos, kıble ve keşişlemede dalga ve karşı rüzgâr. Batılı rüzgârda Bağla ve Karaincir'in batı kayalıkları, doğulu rüzgârda doğu tarafı kuytu kalır.</li>
      <li>4–12 knot ideal. 13–18 knot karşıdan zor, 5–7 g'a çık. 18 knot ya da 25 knot hamle üstü güvenlik uyarısı.</li></ul></details>
    <details><summary>Dalga</summary><ul><li>Kıyıda 0,5 m'ye kadar LRF için ideal; 0,5–0,8 m köpüklü kaya önünde levrek; 1 m üstü ıslak kayaya çıkma.</li><li>Kıyıdaki dalga, açık deniz tahmininden rüzgârın kıyıya göre yönüyle hesaplanır.</li></ul></details>
    <details><summary>Basınç</summary><ul><li>12 saatte 2 hPa'dan fazla düşüş (cephe öncesi) +1,5; hafif düşüş +1; cephe sonrası hızlı yükseliş −1,5; 1025 üstü −1.</li><li>Basıncın etkisi bilimsel olarak tartışmalı; orta ağırlık verildi.</li></ul></details>
    <details><summary>Saat, ışık ve ay</summary><ul><li>Sabah (gün doğumundan 1 saat önce → 2 saat sonra) ve akşam (gün batımından 1,5 saat önce → 1 saat 15 dk sonra) +1,5.</li><li>Öğlen güneşli ve durgunsa −0,5; bulutluysa +0,5. Kuvvetli yağış −1.</li><li>Gece: ay %80 üstü −0,5, %20 altı +0,5.</li></ul></details>
    <details><summary>Su</summary><ul><li>Su 13 °C altında ya da 3 günde 2 °C'den fazla soğuduysa −1. Son 48 saatte 10 mm üstü yağış: hafif bulanık su, levrek için artı.</li><li>Çipura Kasım–Aralık'ta derine çekilir, ilkbaharda kıyıya döner.</li></ul></details>
    <p class="muted" style="font-size:.85rem;margin-top:10px">Asgari av boyları için 6/2 Amatör Avcılık Tebliği'ne bak. Veri: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (ECMWF, DWD, Météo-France modelleri). Fırtına uyarıları: <a href="https://pirireis.mgm.gov.tr" target="_blank" rel="noopener">MGM Piri Reis</a>.</p>
  </section>`;
  const ib = $('#install-btn'); if (ib) ib.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#install-card').hidden = true; });
}

function switchTab(t) {
  state.tab = t;
  document.querySelectorAll('.tab').forEach(s => s.hidden = s.id !== 'tab-' + t);
  document.querySelectorAll('.tabbar button').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (t === 'hafta') renderWeek();
  if (t === 'harita') renderMap();
  if (t === 'defter') renderDefter();
  window.scrollTo({ top: 0 });
}

// ---------- başlangıç ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; const c = $('#install-card'); if (c) c.hidden = false; });
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$('#refresh').addEventListener('click', () => load(true));
$('#day').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
load(false);
