import { SPOTS, WINDOWS, SPECIES, PHASES, LEVELS, levelOf, buildDays, calibrate, windName, shelteredEdge, fmt } from './engine.js';

const WX_POINT = { lat: 36.97, lon: 27.33 };   // Bağla–Karaincir arası kara noktası (rüzgâr, basınç, yağış)
const SEA_POINT = { lat: 36.93, lon: 27.33 };  // koyların hemen açığı (dalga, deniz suyu, akıntı)
const CACHE_KEY = 'bb-forecast-v2', LOG_KEY = 'bb-log-v1', SPOT_KEY = 'bb-spot', POS_KEY = 'bb-pos-v1';
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_DAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MON_SHORT = ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'];
const PHASE_NAMES = { tan: 'Tan', sabah: 'Sabah', ogle: 'Öğle', ikindi: 'İkindi', batim: 'Gün batımı', gece: 'Gece' };
const LVL_HEX = ['#ff6b5e', '#f59a4a', '#f2cc4b', '#4fd68e', '#2fe3c2'];

const state = { all: [], base: [], days: [], sel: 0, tab: 'gun', spot: 'ilginlar', log: [], off: null, raw: null, fetchedAt: null, live: true, map: null, mapLayer: null, editPos: false };
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = s => LVL_HEX[levelOf(s)];
const lvl = s => LEVELS[levelOf(s)];
function isoToday() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dParts(iso) { const d = new Date(iso + 'T12:00:00'); return { d, short: TR_DAYS[d.getDay()], long: TR_DAYS_LONG[d.getDay()], label: `${d.getDate()} ${TR_MONTHS[d.getMonth()]}` }; }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function read(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } }

// ---------- veri ----------
function urls() {
  const c = 'timezone=Europe%2FIstanbul&forecast_days=7&past_days=31';
  return {
    wx: `https://api.open-meteo.com/v1/forecast?latitude=${WX_POINT.lat}&longitude=${WX_POINT.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation,cloud_cover,temperature_2m&daily=sunrise,sunset&wind_speed_unit=kn&${c}`,
    marine: `https://marine-api.open-meteo.com/v1/marine?latitude=${SEA_POINT.lat}&longitude=${SEA_POINT.lon}&hourly=wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,sea_level_height_msl&${c}`
  };
}
async function getJSON(url, ms = 20000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function load() {
  $('#refresh').classList.add('spin'); $('#status').textContent = 'Tahmin yükleniyor…';
  const u = urls(); let wx, marine;
  try {
    [wx, marine] = await Promise.all([getJSON(u.wx), getJSON(u.marine).catch(() => null)]);
    store(CACHE_KEY, { wx, marine, at: Date.now() }); state.fetchedAt = new Date(); state.live = true;
  } catch (e) {
    const c = read(CACHE_KEY, null);
    if (!c) { $('#status').textContent = 'Tahmin alınamadı'; $('#refresh').classList.remove('spin'); $('#day').innerHTML = `<div class="card"><h2>Tahmin alınamadı</h2><p class="muted mt">İnternete bağlanınca sağ üstteki yenile düğmesine bas.</p></div>`; return; }
    ({ wx, marine } = c); state.fetchedAt = new Date(c.at); state.live = false;
  }
  state.raw = { wx, marine };
  rebuild();
  const t = state.fetchedAt;
  $('#status').textContent = `${state.live ? 'Güncel' : 'Çevrimdışı · son kayıt'} · ${t.getDate()} ${TR_MONTHS[t.getMonth()]} ${pad(t.getHours())}:${pad(t.getMinutes())}${marine ? '' : ' · deniz verisi yok'}`;
  $('#refresh').classList.remove('spin');
}
function rebuild() {
  if (!state.raw) return;
  state.base = buildDays(state.raw.wx, state.raw.marine, null);
  // defterdeki kayıtlara modelin (düzeltmesiz) o günkü puanını yaz
  for (const tr of state.log) { const p = basePred(tr); if (p != null) tr.pred = p; }
  store(LOG_KEY, state.log);
  state.off = calibrate(state.log);
  state.all = buildDays(state.raw.wx, state.raw.marine, state.off);
  const today = isoToday();
  state.days = state.all.filter(d => d.date >= today);
  if (state.sel >= state.days.length) state.sel = 0;
  renderAll();
}
function basePred(tr) {
  const d = state.base.find(x => x.date === tr.date); if (!d) return tr.pred ?? null;
  const w = d.windows.find(x => x.id === tr.win); if (!w || w.score == null) return tr.pred ?? null;
  return w.bySpot.find(b => b.spot.id === tr.spot)?.score ?? null;
}

// ---------- seçili noktaya göre görünüm ----------
function winView(w) {
  if (w.score == null) return null;
  const b = state.spot === 'best' ? w.ranked[0] : w.bySpot.find(x => x.spot.id === state.spot);
  return { id: w.id, name: w.name, from: w.from, to: w.to, hours: w.hours, ranked: w.ranked, ...b };
}
function dayView(d) {
  const wins = d.windows.map(winView).filter(Boolean);
  // bugün için saati geçmiş dilimleri önerme
  if (d.date === isoToday()) { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); for (const w of wins) w.past = w.to !== '00:00' && toMin(w.to) <= m; }
  const open = wins.filter(w => !w.past), pool = open.length ? open : wins;
  const best = pool.reduce((a, b) => (b.score > a.score ? b : a));
  return { wins, best };
}
const hourSel = h => state.spot === 'best' ? h.best : h.per.find(p => p.spot.id === state.spot);
const spotLabel = () => state.spot === 'best' ? 'en iyi nokta' : SPOTS.find(s => s.id === state.spot).short;
function confidence(i) { return i <= 1 ? 'yüksek' : i <= 3 ? 'orta' : 'düşük'; }

// ---------- SVG parçaları ----------
function gauge(score, label, size = 150, id = 'g') {
  const r = size * 0.41, c = 2 * Math.PI * r, arc = c * 0.75, val = arc * score / 10, m = size / 2;
  return `<svg class="gauge" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label} ${fmt(score)} / 10">
    <g transform="rotate(135 ${m} ${m})"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="#17404f" stroke-width="${size * 0.08}" stroke-linecap="round" stroke-dasharray="${arc} ${c}"/>
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${hex(score)}" stroke-width="${size * 0.08}" stroke-linecap="round" stroke-dasharray="${val} ${c}"><animate attributeName="stroke-dasharray" from="0 ${c}" to="${val} ${c}" dur=".8s" fill="freeze"/></circle></g>
    <text x="${m}" y="${m + size * 0.07}" text-anchor="middle" font-size="${size * 0.3}" font-weight="800" fill="#eaf6f8" font-family="Bricolage Grotesque, sans-serif">${fmt(score)}</text>
    <text x="${m}" y="${m + size * 0.23}" text-anchor="middle" font-size="${size * 0.085}" font-weight="700" letter-spacing="1" fill="#8fb1bb" font-family="Source Sans 3, sans-serif">${label.toUpperCase()}</text></svg>`;
}
function ring(score, size = 44) {
  const r = size * 0.4, c = 2 * Math.PI * r, m = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="#17404f" stroke-width="${size * 0.11}"/>
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${hex(score)}" stroke-width="${size * 0.11}" stroke-linecap="round" stroke-dasharray="${c * score / 10} ${c}" transform="rotate(-90 ${m} ${m})"/>
    <text x="${m}" y="${m + size * 0.1}" text-anchor="middle" font-size="${size * 0.29}" font-weight="800" fill="#eaf6f8" font-family="Bricolage Grotesque, sans-serif">${fmt(score)}</text></svg>`;
}
function arrowSvg(deg, size = 16, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${(deg + 180) % 360}deg)"><path d="M12 3v15M12 21l-5.5-6.5M12 21l5.5-6.5" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function winIcon(id, size = 26) {
  const s = 'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"', a = `width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"`;
  if (id === 'sabah') return `<svg ${a} style="color:#f2b84b"><path d="M4 23h24M9 23a7 7 0 0 1 14 0" ${s}/><path d="M16 9v3M7 13l2.5 2.5M25 13l-2.5 2.5M16 4l-2.5 2.5M16 4l2.5 2.5" ${s}/></svg>`;
  if (id === 'oglen') return `<svg ${a} style="color:#ffd76a"><circle cx="16" cy="16" r="6" ${s}/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l2.8 2.8M22.2 22.2 25 25M7 25l2.8-2.8M22.2 9.8 25 7" ${s}/></svg>`;
  if (id === 'aksam') return `<svg ${a} style="color:#ff9a6b"><path d="M4 23h24M9 23a7 7 0 0 1 14 0" ${s}/><path d="M16 4v3M7 13l2.5 2.5M25 13l-2.5 2.5M16 12l-2.5-2.5M16 12l2.5-2.5" ${s}/></svg>`;
  return `<svg ${a} style="color:#b9c8ff"><path d="M21 5a11 11 0 1 0 6 18A9 9 0 0 1 21 5z" ${s}/></svg>`;
}
function fishIcon(color) { return `<svg width="38" height="22" viewBox="0 0 40 24" aria-hidden="true"><path d="M3 12c6-8 18-9 26 0-8 9-20 8-26 0z" fill="${color}"/><path d="M29 12l8-6v12z" fill="${color}"/><circle cx="10" cy="10.5" r="1.6" fill="#04141b"/></svg>`; }
function moonSvg(illum, waxing, size = 44) {
  const r = size * 0.42, m = size / 2, k = 1 - 2 * illum;
  const path = `M${m} ${m - r} A${r} ${r} 0 0 ${waxing ? 1 : 0} ${m} ${m + r} A${Math.abs(k * r)} ${r} 0 0 ${(k > 0) === waxing ? 0 : 1} ${m} ${m - r}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${m}" cy="${m}" r="${r}" fill="#1a3340"/><path d="${path}" fill="#f3ead2"/></svg>`;
}
// Kıyı şeması: kara üstte, deniz altta; rüzgâr ve dalga okları noktanın yönüne göre
function coastSvg(spot, windDir, waveDir) {
  const rel = d => ((d - spot.facing + 180) % 360 + 360) % 360; // 0 = denizden karaya (aşağıdan yukarı)
  const arrow = (d, col, x) => `<g transform="translate(${x} 62) rotate(${rel(d) + 180})"><path d="M0 -20v34M0 18l-7-9M0 18l7-9" fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round"/></g>`;
  return `<svg class="coast" viewBox="0 0 150 100" role="img" aria-label="Rüzgâr ve dalganın kıyıya göre yönü">
    <rect width="150" height="100" rx="12" fill="#0a2a37"/><path d="M0 0h150v24c-22 9-40-4-62 5S40 22 0 30z" fill="#3a3a26"/>
    <path d="M0 78q18-7 37 0t38 0 38 0 37 0" fill="none" stroke="#1f5d73" stroke-width="2"/>
    <text x="8" y="14" font-size="8.5" fill="#cdbf95" font-family="Source Sans 3, sans-serif" font-weight="700">KARA</text>
    <text x="8" y="94" font-size="8.5" fill="#6fb6cc" font-family="Source Sans 3, sans-serif" font-weight="700">DENİZ</text>
    ${windDir != null ? arrow(windDir, '#9fe3f2', 52) : ''}${waveDir != null ? arrow(waveDir, '#f3ead2', 100) : ''}</svg>`;
}

// Gün şeridi: gök renkleri üstünde dört dilim ve puanları
function dayRibbon(d, v) {
  const W = 440, H = 84, t0 = d.sun.riseMin - 60, t1 = 24 * 60, x = m => 10 + (m - t0) / (t1 - t0) * (W - 20);
  const stops = [[t0, '#0b1d3a'], [d.sun.riseMin, '#f29b5a'], [d.sun.riseMin + 90, '#6fc3e8'], [d.sun.setMin - 90, '#6fc3e8'], [d.sun.setMin, '#f2854b'], [d.sun.setMin + 60, '#1a2a5a'], [t1, '#081428']];
  const grad = stops.map(([m, c]) => `<stop offset="${((m - t0) / (t1 - t0) * 100).toFixed(1)}%" stop-color="${c}"/>`).join('');
  const segs = v.wins.map(w => {
    const a = toMin(w.from), b = w.to === '00:00' ? t1 : toMin(w.to), xa = x(a), xb = x(b);
    return `<rect x="${xa + 1.5}" y="40" width="${xb - xa - 3}" height="38" rx="9" fill="${hex(w.score)}" opacity="${w.past ? 0.25 : w.id === v.best.id ? 1 : 0.6}"/>
      <text x="${(xa + xb) / 2}" y="57" text-anchor="middle" font-size="11" font-weight="700" fill="#04141b" font-family="Source Sans 3, sans-serif">${w.name}</text>
      <text x="${(xa + xb) / 2}" y="73" text-anchor="middle" font-size="15" font-weight="800" fill="#04141b" font-family="Bricolage Grotesque, sans-serif">${fmt(w.score)}</text>`;
  }).join('');
  let now = '';
  if (d.date === isoToday()) { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); if (m > t0 && m < t1) now = `<line x1="${x(m)}" x2="${x(m)}" y1="6" y2="80" stroke="#fff" stroke-width="2"/><circle cx="${x(m)}" cy="6" r="4" fill="#fff"/>`; }
  const tick = (m, l) => `<text x="${x(m)}"  y="28" text-anchor="middle" font-size="11" font-weight="700" fill="#04141b" font-family="JetBrains Mono, monospace">${l}</text>`;
  return `<svg class="ribbon" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gün içi dilimler ve puanları">
    <defs><linearGradient id="sky${d.date}" x1="0" x2="1">${grad}</linearGradient></defs>
    <rect x="10" y="12" width="${W - 20}" height="24" rx="8" fill="url(#sky${d.date})"/>
    ${tick(d.sun.riseMin + 75, d.sun.rise)}${tick(d.sun.setMin - 75, d.sun.set)}${segs}${now}</svg>`;
}
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);

// Tür saatleri: satır tür, sütun saat, koyuluk aktiflik
function speciesGrid(d) {
  const hs = d.hours; if (!hs.length) return '';
  const rows = SPECIES.map(sp => ({ sp, vals: hs.map(h => hourSel(h).species.find(x => x.sp.id === sp.id).a) }))
    .map(r => ({ ...r, max: Math.max(...r.vals) })).filter(r => r.max >= 0.08).sort((a, b) => b.max - a.max).slice(0, 8);
  const L = 118, cw = 30, rh = 26, W = L + hs.length * cw + 6, H = 22 + rows.length * rh + 4;
  const head = hs.map((h, i) => h.min % 120 === 0 ? `<text x="${L + i * cw + cw / 2}" y="14" text-anchor="middle" font-size="10" fill="#8fb1bb" font-family="JetBrains Mono, monospace">${h.t.slice(11, 13)}</text>` : '').join('');
  const body = rows.map((r, j) => `<text x="${L - 8}" y="${22 + j * rh + 17}" text-anchor="end" font-size="12" fill="#eaf6f8" font-family="Source Sans 3, sans-serif" font-weight="600">${esc(r.sp.name.split(',')[0].split(' (')[0])}</text>` +
    r.vals.map((a, i) => `<rect x="${L + i * cw + 1.5}" y="${22 + j * rh + 2}" width="${cw - 3}" height="${rh - 4}" rx="5" fill="${a >= 0.3 ? '#2fe3c2' : a >= 0.18 ? '#4fd68e' : a >= 0.1 ? '#f2cc4b' : '#17404f'}" opacity="${a < 0.1 ? 0.6 : Math.min(1, 0.45 + a * 1.4)}"/>`).join('')).join('');
  const sun = [['riseMin', '#f2b84b'], ['setMin', '#ff9a6b']].map(([k, c]) => { const fi = (d.sun[k] - hs[0].min) / 60; return fi >= 0 && fi <= hs.length ? `<line x1="${L + fi * cw}" x2="${L + fi * cw}" y1="18" y2="${H}" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3"/>` : ''; }).join('');
  return `<div class="chart-wrap"><svg class="chart" style="min-width:${W}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="Türlerin saatlere göre aktifliği">${head}${body}${sun}</svg></div>
    <div class="legend"><span><i class="sq" style="background:#2fe3c2"></i>en aktif</span><span><i class="sq" style="background:#4fd68e"></i>aktif</span><span><i class="sq" style="background:#f2cc4b"></i>az</span><span><i class="sq" style="background:#17404f"></i>beklenmez</span><span>Kesik çizgiler gün doğumu ve batımı</span></div>`;
}

// Saat saat: şans (dolgu), koşul (kesik çizgi), rüzgâr sütunları ve dalga
function hourlyChart(d) {
  const hs = d.hours; if (hs.length < 2) return '';
  const W = 760, X0 = 34, X1 = W - 34, top = 14, sh = 120, wb = 168, wh = 66, n = hs.length, x = i => X0 + (i / (n - 1)) * (X1 - X0);
  const yS = v => top + sh - (v / 10) * sh, maxKn = Math.max(20, ...hs.map(h => h.gust)), yW = v => wb + wh - (v / maxKn) * wh;
  const maxWv = Math.max(1.5, ...hs.map(h => h.wave ?? 0)), yV = v => wb + wh - (v / maxWv) * wh;
  const ch = hs.map((h, i) => `${x(i).toFixed(1)},${yS(hourSel(h).chance).toFixed(1)}`).join(' ');
  const cd = hs.map((h, i) => `${x(i).toFixed(1)},${yS(hourSel(h).cond).toFixed(1)}`).join(' ');
  const grid = [2.5, 5, 7.5, 10].map(v => `<line x1="${X0}" x2="${X1}" y1="${yS(v)}" y2="${yS(v)}" stroke="#17404f" stroke-dasharray="2 4"/><text x="${X0 - 6}" y="${yS(v) + 3}" text-anchor="end" font-size="9" fill="#8fb1bb">${v}</text>`).join('');
  const bw = Math.max(4, (X1 - X0) / n * 0.55);
  const bars = hs.map((h, i) => `<rect x="${x(i) - bw / 2}" y="${yW(h.gust)}" width="${bw}" height="${wb + wh - yW(h.gust)}" fill="#3fb6d9" opacity=".22" rx="2"/><rect x="${x(i) - bw / 2}" y="${yW(h.wind)}" width="${bw}" height="${wb + wh - yW(h.wind)}" fill="#3fb6d9" opacity=".8" rx="2"/>`).join('');
  const arrows = hs.map((h, i) => i % 2 ? '' : `<g transform="translate(${x(i)} ${wb - 10}) rotate(${(h.dir + 180) % 360})"><path d="M0 -6v12M0 7l-3.5-4M0 7l3.5-4" stroke="#9fe3f2" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`).join('');
  const wave = hs.some(h => h.wave != null) ? `<polyline points="${hs.map((h, i) => h.wave == null ? '' : `${x(i).toFixed(1)},${yV(h.wave).toFixed(1)}`).filter(Boolean).join(' ')}" fill="none" stroke="#f3ead2" stroke-width="2" stroke-dasharray="5 3"/>` : '';
  const labels = hs.map((h, i) => h.min % 120 === 0 ? `<text x="${x(i)}" y="${wb + wh + 15}" text-anchor="middle" font-size="10" fill="#8fb1bb" font-family="JetBrains Mono, monospace">${h.t.slice(11, 13)}</text>` : '').join('');
  let now = '';
  if (d.date === isoToday()) { const t = new Date(), fi = (t.getHours() * 60 + t.getMinutes() - hs[0].min) / 60; if (fi >= 0 && fi <= n - 1) { const xn = X0 + fi / (n - 1) * (X1 - X0); now = `<line x1="${xn}" x2="${xn}" y1="${top}" y2="${wb + wh}" stroke="#fff" stroke-width="1.3" opacity=".8"/>`; } }
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${wb + wh + 22}" role="img" aria-label="Saatlik şans, koşul, rüzgâr ve dalga">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fe3c2" stop-opacity=".5"/><stop offset="1" stop-color="#2fe3c2" stop-opacity="0"/></linearGradient></defs>
    ${grid}<polygon points="${X0},${top + sh} ${ch} ${X1},${top + sh}" fill="url(#ag)"/><polyline points="${ch}" fill="none" stroke="#2fe3c2" stroke-width="2.6" stroke-linejoin="round"/>
    <polyline points="${cd}" fill="none" stroke="#b9c8ff" stroke-width="1.6" stroke-dasharray="4 4"/>
    <line x1="${X0}" x2="${X1}" y1="${wb + wh}" y2="${wb + wh}" stroke="#17404f"/>${bars}${arrows}${wave}
    <text x="${X1 + 4}" y="${yW(maxKn) + 3}" font-size="9" fill="#3fb6d9">${Math.round(maxKn)}kn</text><text x="${X1 + 4}" y="${yW(maxKn) + 14}" font-size="9" fill="#f3ead2">${fmt(maxWv)}m</text>${labels}${now}</svg></div>
    <div class="legend"><span><i style="background:#2fe3c2"></i>Av şansı</span><span><i style="background:#b9c8ff"></i>Koşul</span><span><i style="background:#3fb6d9"></i>Rüzgâr (soluk: hamle)</span><span><i style="background:#f3ead2"></i>Dalga</span></div>`;
}

// ---------- render ----------
function renderAll() { renderSpotbar(); renderStrip(); renderDay(); if (state.tab === 'hafta') renderWeek(); if (state.tab === 'turler') renderSpecies(); if (state.tab === 'harita') renderMap(); if (state.tab === 'defter') renderDefter(); }

function renderSpotbar() {
  const opts = [...SPOTS.map(s => [s.id, s.short]), ['best', 'En iyisi']];
  $('#spotbar').innerHTML = opts.map(([id, n]) => `<button type="button" class="pillbtn" aria-pressed="${state.spot === id}" data-s="${id}">${esc(n)}</button>`).join('');
  $('#spotbar').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.spot = b.dataset.s; store(SPOT_KEY, state.spot); renderAll(); }));
}

function renderStrip() {
  const vs = state.days.map(dayView), best = vs.reduce((a, v, i) => v.best.score > vs[a].best.score ? i : a, 0);
  $('#strip').innerHTML = state.days.map((d, i) => {
    const p = dParts(d.date), v = vs[i];
    const bars = v.wins.map(w => `<i style="height:${6 + w.score * 2.2}px;background:${hex(w.score)}"></i>`).join('');
    return `<button class="dchip" role="tab" type="button" aria-selected="${i === state.sel}" data-i="${i}">${i === best ? '<span class="crown">EN İYİ</span>' : ''}
      <span class="d1">${i === 0 ? 'Bugün' : p.short}</span><span class="d2">${p.label}</span>${ring(v.best.score)}
      <span class="minibars" aria-hidden="true">${bars}</span><span class="d2">${esc(v.best.name)}</span></button>`;
  }).join('');
  $('#strip').querySelectorAll('.dchip').forEach(b => b.addEventListener('click', () => { state.sel = +b.dataset.i; renderStrip(); renderDay(); if (state.map) renderMap(); }));
}

function renderDay() {
  const d = state.days[state.sel]; if (!d) return;
  const p = dParts(d.date), s = d.summary, v = dayView(d), bw = v.best, alt = bw.ranked[0];
  const dirTxt = s.dirMorning == null ? '' : (windName(s.dirMorning) === windName(s.dirEvening ?? s.dirMorning) ? windName(s.dirMorning) : `${windName(s.dirMorning)} → ${windName(s.dirEvening)}`);
  const top = bw.species.filter(x => x.a >= 0.08).slice(0, 4);
  const better = state.spot !== 'best' && alt.spot.id !== bw.spot.id && alt.score - bw.score >= 1;
  const verdictTxt = levelOf(bw.score) >= 3 ? 'Gitmeye değer' : levelOf(bw.score) === 2 ? 'Şansın orta' : levelOf(bw.score) === 1 ? 'Şans düşük' : 'Bugün gitme';
  const offNote = state.off && state.off.n ? `Defterindeki ${state.off.n} av ile ${state.off.global > 0 ? '+' : ''}${fmt(state.off.global)} puan düzeltildi.` : 'Henüz av kaydın yok; puanlar genel kurallara dayanıyor.';

  $('#day').innerHTML = `
  <section class="card hero">
    <div class="hero-top">
      ${gauge(bw.score, 'av şansı', 150)}
      <div class="hero-txt">
        <span class="eyebrow">${state.sel === 0 ? 'Bugün · ' : ''}${p.label} ${p.long} · ${esc(bw.spot.name)}</span>
        <p class="verdict" style="color:${hex(bw.score)}">${verdictTxt}</p>
        <p class="lead">En iyi dilim <b>${bw.name.toLowerCase()}</b> (${bw.from}–${bw.to}), en iyi saat <b class="num">${bw.topHour}</b>. Av şansı <b>${lvl(bw.score).toLowerCase()}</b>, atış koşulu <b class="num">${fmt(bw.cond)}</b>/10.</p>
        ${top.length ? `<p class="muted sm">En olası: ${top.map(x => esc(x.sp.name.split(',')[0])).join(', ')}.</p>` : ''}
      </div>
    </div>
    ${dayRibbon(d, v)}
    <div class="chips">
      <span class="chip">${arrowSvg(s.dirMorning ?? 0, 14)} <b>${Math.round(s.windMin)}–${Math.round(s.windMax)} kn</b> ${esc(dirTxt)}</span>
      <span class="chip">Dalga <b>${s.waveMax == null ? '–' : fmt(s.waveMax) + ' m'}</b></span>
      <span class="chip">Su <b>${s.sst == null ? '–' : fmt(s.sst) + '°'}</b></span>
      <span class="chip">Tahmin güveni <b>${confidence(state.sel)}</b></span>
    </div>
    ${better ? `<p class="note"><b>${esc(alt.spot.name)}</b> aynı dilimde <b>${fmt(alt.score)}</b> (${lvl(alt.score).toLowerCase()}). ${esc(alt.spot.tip)}</p>` : ''}
  </section>
  ${d.safety.length ? `<div class="alert"><strong>Güvenlik</strong>${d.safety.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}

  <section class="card">
    <div class="section-h"><h2>Hangi dilim?</h2><span class="eyebrow">${esc(spotLabel())}</span></div>
    <div class="wins">${v.wins.map(w => {
      const sp = w.species[0];
      return `<div class="win ${w.id === bw.id ? 'best' : ''} ${w.past ? 'past' : ''}">${w.id === bw.id ? '<span class="tag">EN İYİ</span>' : w.past ? '<span class="tag gone">GEÇTİ</span>' : ''}
        <div class="win-h">${winIcon(w.id)}<span class="eyebrow">${w.name}</span></div>
        <span class="sc" style="color:${hex(w.score)}">${fmt(w.score)}</span><span class="lv" style="color:${hex(w.score)}">${lvl(w.score)}</span>
        <span class="rng">${w.from}–${w.to}</span>
        <div class="meter" title="Atış koşulu"><i style="width:${w.cond * 10}%"></i></div><span class="why">Koşul ${fmt(w.cond)}${w.condWhy[0] ? ' · ' + esc(w.condWhy[0]) : ''}</span>
        <span class="why">${sp && sp.a >= 0.08 ? '→ ' + esc(sp.sp.name.split(',')[0]) : 'Belirgin hedef yok'}</span></div>`;
    }).join('')}</div>
  </section>

  <section class="card">
    <div class="section-h"><h2>Ne tutulur, nasıl?</h2><span class="eyebrow">${bw.name} · ${esc(bw.spot.short)}</span></div>
    <div class="targets">${top.length ? top.map(x => `
      <div class="target">${fishIcon(x.a >= 0.3 ? LVL_HEX[4] : x.a >= 0.18 ? LVL_HEX[3] : LVL_HEX[2])}
        <div><b>${esc(x.sp.name)}</b><div class="lure">${esc(x.sp.lure)}</div><div class="how">${esc(x.sp.how)}</div>
        ${x.why.length ? `<div class="tags">${[...new Set(x.why)].map(y => `<span>${esc(y)}</span>`).join('')}</div>` : ''}</div>
        <span class="badge" style="background:${x.a >= 0.3 ? LVL_HEX[4] : x.a >= 0.18 ? LVL_HEX[3] : LVL_HEX[2]}">${x.a >= 0.3 ? 'EN OLASI' : x.a >= 0.18 ? 'OLASI' : 'AZ'}</span></div>`).join('') : '<p class="muted">Bu dilimde sahteye gelmesi beklenen belirgin bir tür yok.</p>'}</div>
  </section>

  <section class="card">
    <div class="section-h"><h2>Tür saatleri</h2><span class="eyebrow">${esc(spotLabel())}</span></div>
    ${speciesGrid(d)}
  </section>

  <section class="card">
    <div class="section-h"><h2>Saat saat</h2><span class="eyebrow">${esc(spotLabel())}</span></div>
    ${hourlyChart(d)}
  </section>

  <section class="card">
    <div class="section-h"><h2>Noktalar</h2><span class="eyebrow">dilimlere göre av şansı</span></div>
    <div class="tbl"><table class="matrix"><thead><tr><th>Nokta</th>${v.wins.map(w => `<th>${w.name}</th>`).join('')}</tr></thead><tbody>
      ${SPOTS.map(sp => `<tr><td><b>${esc(sp.short)}</b></td>${v.wins.map(w => { const b = d.windows.find(x => x.id === w.id).bySpot.find(x => x.spot.id === sp.id); return `<td><span class="cellsc" style="background:${hex(b.score)}">${fmt(b.score)}</span></td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="spotinfo">${coastSvg(bw.spot, bw.id === 'sabah' ? s.dirMorning : s.dirEvening, s.waveDir)}
      <div><b>${esc(bw.spot.name)}</b><p class="sm muted">${bw.on < -0.35 ? 'Rüzgâr karadan: atış uzun, deniz düz.' : bw.on > 0.35 ? 'Rüzgâr denizden: karşıdan atış, kıyıda hareket var.' : 'Rüzgâr yandan.'} Kıyıda dalga ~${fmt(bw.wave ?? 0)} m.${shelteredEdge(bw.spot, s.dirMorning) ? ' Kuytu kenar: ' + esc(shelteredEdge(bw.spot, s.dirMorning)) + '.' : ''}</p>
      <p class="sm">${esc(bw.spot.tip)}</p><div class="legend"><span><i style="background:#9fe3f2"></i>Rüzgâr</span><span><i style="background:#f3ead2"></i>Dalga</span></div></div></div>
  </section>

  <section class="card">
    <div class="section-h"><h2>Deniz ve hava</h2></div>
    <div class="conds">
      <div class="cond"><span class="eyebrow">Rüzgâr</span><span class="v">${Math.round(s.windMin)}–${Math.round(s.windMax)} kn</span><small>${esc(dirTxt)} · hamle ${Math.round(s.gustMax)}</small></div>
      <div class="cond"><span class="eyebrow">Dalga (açık)</span><span class="v">${s.waveMax == null ? 'veri yok' : fmt(s.waveMax) + ' m'}</span><small>${s.period ? 'periyot ' + fmt(s.period) + ' sn' : ''}${s.waveDir != null ? ' · ' + windName(s.waveDir).toLowerCase() + 'dan' : ''}</small></div>
      <div class="cond"><span class="eyebrow">Deniz suyu</span><span class="v">${s.sst == null ? '–' : fmt(s.sst) + ' °C'}</span><small>${s.sst != null && s.sstWeek != null ? (Math.abs(s.sst - s.sstWeek) < 0.2 ? 'bir haftadır sabit' : `bir haftada ${s.sst > s.sstWeek ? '+' : '−'}${fmt(Math.abs(s.sst - s.sstWeek))}°`) : ''}</small></div>
      <div class="cond"><span class="eyebrow">Su berraklığı</span><span class="v">${s.turbid ? 'Bulanık' : 'Berrak'}</span><small>son 48 saat yağış ${fmt(s.rain48)} mm</small></div>
      <div class="cond"><span class="eyebrow">Yağış / bulut</span><span class="v">${fmt(s.rain)} mm</span><small>bulut %${Math.round(s.cloud)} · hava ${Math.round(s.tMin)}–${Math.round(s.tMax)}°</small></div>
      <div class="cond"><span class="eyebrow">Akıntı</span><span class="v">${s.cur == null ? '–' : fmt(s.cur) + ' km/sa'}</span><small>açık deniz modeli; kıyıda farklı olabilir</small></div>
      <div class="cond"><span class="eyebrow">Basınç <em>kanıt zayıf</em></span><span class="v">${s.pStart ? Math.round(s.pStart) + ' → ' + Math.round(s.pEnd) : '–'} ${s.dp < -1.5 ? '↓' : s.dp > 1.5 ? '↑' : '→'}</span><small>hPa · puanı neredeyse etkilemez</small></div>
      <div class="cond"><span class="eyebrow">Ay <em>kanıt karışık</em></span><div class="row">${moonSvg(d.moon.illum, d.moon.waxing)}<div><span class="v">%${Math.round(d.moon.illum * 100)}</span><br><small>${d.moon.waxing ? 'büyüyen' : 'küçülen'}</small></div></div></div>
    </div>
    <p class="muted sm mt">${esc(offNote)}</p>
  </section>`;
}

function renderWeek() {
  const sess = [];
  state.days.forEach((d, i) => dayView(d).wins.forEach(w => sess.push({ i, d, w })));
  sess.sort((a, b) => b.w.score - a.w.score || a.i - b.i);
  const flat = sess.length && sess[0].w.score - sess[Math.min(9, sess.length - 1)].w.score <= 1;
  const sst = state.days[0]?.summary.sst;
  $('#tab-hafta').innerHTML = `
  <section class="card">
    <div class="section-h"><h2>Ne zaman gideyim?</h2><span class="eyebrow">${esc(spotLabel())}</span></div>
    <div class="rank">${sess.slice(0, 5).map((x, k) => { const p = dParts(x.d.date), sp = x.w.species[0];
      return `<button class="rank-row" type="button" data-i="${x.i}"><span class="pos">${k + 1}</span>
        <span><b>${x.i === 0 ? 'Bugün' : p.long} ${x.w.name.toLowerCase()}</b><br><span class="muted sm">${p.label} · ${x.w.from}–${x.w.to} · ${esc(x.w.spot.short)}${sp && sp.a >= 0.08 ? ' · ' + esc(sp.sp.name.split(',')[0]) : ''} · güven ${confidence(x.i)}</span></span>
        <span class="sc" style="color:${hex(x.w.score)}">${fmt(x.w.score)}</span></button>`; }).join('')}</div>
    ${flat ? `<p class="note">Bu hafta dilimler arasındaki fark küçük. Hava, balığın gelip gelmeyeceğini bu kadar ayırt edemiyor; asıl fark <b>saat</b> ve <b>nokta</b> seçiminden geliyor.</p>` : ''}
  </section>
  <section class="card">
    <div class="section-h"><h2>Gün ve dilim haritası</h2><span class="eyebrow">dokun: güne git</span></div>
    <div class="heat"><span></span>${WINDOWS.map(w => `<span class="h">${w.name}</span>`).join('')}
      ${state.days.map((d, i) => `<span class="dl">${i === 0 ? 'Bugün' : dParts(d.date).short} <span class="muted">${dParts(d.date).d.getDate()}</span></span>` +
        WINDOWS.map(w => { const x = dayView(d).wins.find(v => v.id === w.id); return !x ? '<span class="muted c">–</span>' : `<button type="button" data-i="${i}" style="background:${hex(x.score)}">${fmt(x.score)}</button>`; }).join('')).join('')}</div>
    <div class="legend mt">${LEVELS.map((l, i) => `<span><i class="sq" style="background:${LVL_HEX[i]}"></i>${l}</span>`).join('')}</div>
  </section>
  <section class="card">
    <div class="section-h"><h2>Rüzgâr ve dalga gidişatı</h2></div>${weekChart()}
    <p class="muted sm mt">İlk iki gün güvenilir, 3–4. gün orta, sonrası yalnızca eğilim. Uygulamayı her açtığında yeniden hesaplanır.</p>
  </section>
  <section class="card">
    <div class="section-h"><h2>Mevsim durumu</h2></div>
    <p>${seasonNote(sst)}</p>
  </section>`;
  $('#tab-hafta').querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { state.sel = +b.dataset.i; switchTab('gun'); renderStrip(); renderDay(); }));
}
function seasonNote(sst) {
  if (sst == null) return 'Deniz suyu sıcaklığı alınamadı.';
  const mo = new Date().getMonth() + 1, t = `Deniz suyu şu an <b>${fmt(sst)} °C</b>. `;
  if (sst > 21 && [10, 11, 12].includes(mo)) return t + 'Takvim sonbahar dese de su hâlâ yaz sonu sıcaklığında. Kalamar ve levrek gibi soğuk su türleri kıyıya henüz tam yanaşmadı; su 21 °C\'nin altına inince belirgin artmaları beklenir. Şimdilik sıcak su türleri (iskarmoz, hani, zargana, Kızıldeniz barbunu) daha gerçekçi hedefler.';
  if (sst <= 21 && sst > 17) return t + 'Kalamar ve levrek için uygun aralığa girildi. Gün batımı çevresi ve gecenin ilk saatleri öne çıkar.';
  if (sst <= 17) return t + 'Kış suyu. Levrek ve kalamar sezonu; sıcak su türleri çekildi. Balık yavaş yer, sahteyi yavaşlat.';
  return t + 'Yaz suyu. Gündüz sıcağında balık derine iner; tan vakti, gün batımı ve gece öne çıkar.';
}
function weekChart() {
  const hs = state.days.flatMap(d => d.hours); if (!hs.length) return '';
  const W = 760, H = 170, X0 = 30, X1 = W - 34, n = hs.length, x = i => X0 + i / (n - 1) * (X1 - X0);
  const maxKn = Math.max(20, ...hs.map(h => h.gust)), yK = v => 140 - v / maxKn * 120, maxWv = Math.max(1.5, ...hs.map(h => h.wave ?? 0)), yV = v => 140 - v / maxWv * 120;
  const line = f => hs.map((h, i) => `${x(i).toFixed(1)},${f(h).toFixed(1)}`).join(' ');
  let sep = '', last = null; hs.forEach((h, i) => { if (h.date !== last) { last = h.date; sep += `<line x1="${x(i)}" x2="${x(i)}" y1="16" y2="140" stroke="#17404f"/><text x="${x(i) + 4}" y="158" font-size="10" fill="#8fb1bb">${dParts(h.date).short}</text>`; } });
  const ref = [[10, '#4fd68e'], [18, '#ff6b5e']].map(([v, c]) => `<line x1="${X0}" x2="${X1}" y1="${yK(v)}" y2="${yK(v)}" stroke="${c}" stroke-dasharray="3 5" opacity=".7"/><text x="${X1 + 3}" y="${yK(v) + 3}" font-size="9" fill="${c}">${v}kn</text>`).join('');
  const wave = hs.some(h => h.wave != null) ? `<polyline points="${hs.map((h, i) => h.wave == null ? '' : `${x(i).toFixed(1)},${yV(h.wave).toFixed(1)}`).filter(Boolean).join(' ')}" fill="none" stroke="#f3ead2" stroke-width="2" stroke-dasharray="5 3"/>` : '';
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="7 günlük rüzgâr ve dalga">${sep}${ref}<polyline points="${line(h => yK(h.gust))}" fill="none" stroke="#3fb6d9" stroke-width="1.2" opacity=".45"/><polyline points="${line(h => yK(h.wind))}" fill="none" stroke="#3fb6d9" stroke-width="2.2"/>${wave}</svg></div>
    <div class="legend"><span><i style="background:#3fb6d9"></i>Rüzgâr (ince: hamle)</span><span><i style="background:#f3ead2"></i>Dalga</span><span><i style="background:#4fd68e"></i>10 kn: karşıdan hafif sahte sınırı</span><span><i style="background:#ff6b5e"></i>18 kn: zor</span></div>`;
}

function renderSpecies() {
  const d = state.days[0], mo = new Date().getMonth(), sst = d?.summary.sst;
  const spot = state.spot === 'best' ? SPOTS[0] : SPOTS.find(s => s.id === state.spot);
  const cards = SPECIES.map(sp => {
    const season = sp.ay[mo], hab = sp.hab(spot);
    const maxA = d ? Math.max(...d.hours.map(h => h.per.find(p => p.spot.id === spot.id).species.find(x => x.sp.id === sp.id).a)) : 0;
    const best = sp.isik.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => PHASE_NAMES[PHASES[x[1]]].toLowerCase());
    let status = season >= 0.75 ? 'Mevsiminde' : season >= 0.45 ? 'Mevsim başı / sonu' : 'Mevsim dışı';
    if (sst != null) { if (sp.cool && sst > sp.cool[0]) status = `Su ${fmt(sst)}° — henüz sıcak`; if (sp.coldBelow && sst < sp.coldBelow) status = `Su ${fmt(sst)}° — soğudu`; }
    return { sp, maxA, html: `<article class="card sp">
      <div class="sp-h">${fishIcon(maxA >= 0.3 ? LVL_HEX[4] : maxA >= 0.18 ? LVL_HEX[3] : maxA >= 0.1 ? LVL_HEX[2] : '#3b6474')}<div><h3>${esc(sp.name)}</h3><span class="muted sm">${esc(status)} · en iyi: ${best.join(', ')}</span></div>
        <span class="badge" style="background:${maxA >= 0.3 ? LVL_HEX[4] : maxA >= 0.18 ? LVL_HEX[3] : maxA >= 0.1 ? LVL_HEX[2] : '#3b6474'}">${maxA >= 0.3 ? 'BUGÜN OLASI' : maxA >= 0.18 ? 'BUGÜN MÜMKÜN' : maxA >= 0.1 ? 'ZAYIF' : 'BEKLENMEZ'}</span></div>
      <div class="cal" aria-label="Aylara göre mevsim">${sp.ay.map((v, i) => `<span class="${i === mo ? 'now' : ''}"><i style="height:${4 + v * 22}px;opacity:${0.3 + v * 0.7}"></i>${MON_SHORT[i]}</span>`).join('')}</div>
      <div class="ph" aria-label="Günün saatlerine göre aktiflik">${sp.isik.map((v, i) => `<span><i style="opacity:${0.12 + v * 0.88}"></i>${PHASE_NAMES[PHASES[i]]}</span>`).join('')}</div>
      <p class="sm">${esc(sp.bilgi)}</p>
      <p class="sm"><b>Sahte:</b> ${esc(sp.lure)}</p><p class="sm"><b>Çekiş:</b> ${esc(sp.how)}</p>
      <p class="muted xs">${esc(spot.short)} için uygunluk ${Math.round(hab * 100)}% · sahteyle tutulabilirlik ${Math.round(sp.lrf * 100)}% · dayanak: ${sp.kanit === 'biyoloji' ? 'türün bilinen davranışı' : 'balıkçı ortak görüşü'}</p></article>` };
  }).sort((a, b) => b.maxA - a.maxA);
  $('#tab-turler').innerHTML = `<p class="muted sm">Bugüne ve <b>${esc(spot.name)}</b> noktasına göre sıralı. Çubuklar: üstte aylar (bulunduğun ay çerçeveli), altta günün saatleri.</p><div class="spgrid">${cards.map(c => c.html).join('')}</div>`;
}

function renderMap() {
  const d = state.days[state.sel]; if (!d) return;
  if (typeof L === 'undefined') { $('#map').innerHTML = '<p class="muted" style="padding:16px">Harita için internet bağlantısı gerekiyor.</p>'; return; }
  if (!state.map) {
    state.map = L.map('map').setView([36.963, 27.325], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Uydu: Esri, Maxar, Earthstar Geographics' }).addTo(state.map);
    state.mapLayer = L.layerGroup().addTo(state.map);
  }
  state.mapLayer.clearLayers();
  SPOTS.forEach(sp => {
    const ws = d.windows.filter(w => w.score != null).map(w => ({ w, b: w.bySpot.find(x => x.spot.id === sp.id) })), top = ws.reduce((a, b) => (b.b.score > a.b.score ? b : a));
    const icon = L.divIcon({ className: '', html: `<div class="pin" style="background:${hex(top.b.score)}">${fmt(top.b.score)}</div>`, iconSize: [42, 42], iconAnchor: [21, 21] });
    const mk = L.marker([sp.lat, sp.lon], { icon, title: sp.name, draggable: state.editPos }).addTo(state.mapLayer);
    mk.on('dragend', () => { const ll = mk.getLatLng(); sp.lat = +ll.lat.toFixed(5); sp.lon = +ll.lng.toFixed(5); savePos(); renderMap(); });
    if (!state.editPos) mk.bindPopup(`<b>${esc(sp.name)}</b><br>En iyi: ${top.w.name.toLowerCase()} ${fmt(top.b.score)} · koşul ${fmt(top.b.cond)}<br>${esc(sp.tip)}`);
  });
  setTimeout(() => state.map.invalidateSize(), 50);
  const s = d.summary;
  $('#map-legend').innerHTML = `<div class="card row">${arrowSvg(s.dirMorning ?? 0, 24, '#9fe3f2')}<span class="sm"><b>${dParts(d.date).label}</b> · ${windName(s.dirMorning ?? 0)} ${Math.round(s.windMin)}–${Math.round(s.windMax)} kn. İşaretlerdeki sayı o noktanın günün en iyi dilimindeki av şansı. Konumlar yaklaşıktır.</span></div>` +
    `<div class="card"><div class="section-h"><h2>Konumları düzelt</h2>${state.editPos ? '<button class="linkbtn" id="pos-done" type="button">Bitti</button>' : '<button class="linkbtn" id="pos-edit" type="button">Düzenle</button>'}</div>
      <p class="sm muted">${state.editPos ? 'Yuvarlak işarete basılı tutup atış yaptığın yere sürükle. Yakınlaştırırsan daha kolay olur. Bıraktığın an kaydedilir.' : 'İşaretler yanlış yerdeyse Düzenle\'ye bas, her birini kıyıda durduğun yere sürükle. Konumlar bu telefonda saklanır.'}</p>
      ${hasPos() ? `<p class="xs num mt">${SPOTS.map(sp => `${esc(sp.short)}: ${sp.lat.toFixed(5)}, ${sp.lon.toFixed(5)}`).join('<br>')}</p><div class="row mt"><button class="linkbtn" id="pos-copy" type="button">Koordinatları kopyala</button><button class="linkbtn" id="pos-reset" type="button">Sıfırla</button></div>` : ''}</div>`;
  const on = (id, f) => { const b = $(id); if (b) b.addEventListener('click', f); };
  on('#pos-edit', () => { state.editPos = true; renderMap(); });
  on('#pos-done', () => { state.editPos = false; renderMap(); });
  on('#pos-reset', () => { try { localStorage.removeItem(POS_KEY); } catch (e) {} SPOTS.forEach(sp => { sp.lat = DEFAULT_POS[sp.id][0]; sp.lon = DEFAULT_POS[sp.id][1]; }); renderMap(); });
  on('#pos-copy', async () => { const txt = SPOTS.map(sp => `${sp.id}: ${sp.lat.toFixed(5)}, ${sp.lon.toFixed(5)}`).join('\n'); try { await navigator.clipboard.writeText(txt); $('#pos-copy').textContent = 'Kopyalandı'; } catch (e) {} });
}

// Kullanıcının düzelttiği nokta konumları (yalnızca haritadaki yer; puanı etkilemez)
const DEFAULT_POS = Object.fromEntries(SPOTS.map(sp => [sp.id, [sp.lat, sp.lon]]));
function savePos() { store(POS_KEY, Object.fromEntries(SPOTS.map(sp => [sp.id, [sp.lat, sp.lon]]))); }
function hasPos() { return SPOTS.some(sp => sp.lat !== DEFAULT_POS[sp.id][0] || sp.lon !== DEFAULT_POS[sp.id][1]); }
function loadPos() { const p = read(POS_KEY, null); if (!p) return; SPOTS.forEach(sp => { const v = p[sp.id]; if (Array.isArray(v) && isFinite(v[0]) && isFinite(v[1])) { sp.lat = v[0]; sp.lon = v[1]; } }); }

// ---------- defter ----------
function renderDefter() {
  const log = [...state.log].sort((a, b) => b.date.localeCompare(a.date));
  const n = log.length, hit = log.filter(t => t.fish > 0).length;
  const bands = LEVELS.map((l, i) => { const a = log.filter(t => t.pred != null && levelOf(t.pred) === i); return { l, i, n: a.length, hit: a.filter(t => t.fish > 0).length }; });
  const off = state.off || { global: 0, n: 0, win: {}, spot: {} };
  const today = isoToday(), minDate = state.all[0]?.date || today;
  $('#tab-defter').innerHTML = `
  <section class="card">
    <div class="section-h"><h2>Av ekle</h2><span class="eyebrow">boş dönüşler dahil</span></div>
    <p class="muted sm">Her kaydı gir, özellikle boş döndüklerini. Uygulama o günün havasını geri bakıp kendi puanıyla sonucu karşılaştırır ve puanlarını buna göre düzeltir. Son 31 günün avlarını şimdi girebilirsin.</p>
    <form id="trip" class="form">
      <label>Tarih<input type="date" id="f-date" value="${today}" min="${minDate}" max="${today}" required></label>
      <label>Dilim<select id="f-win">${WINDOWS.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}</select></label>
      <label>Nokta<select id="f-spot">${SPOTS.map(s => `<option value="${s.id}" ${s.id === state.spot ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label>Sonuç<select id="f-fish"><option value="0">Boş döndüm</option><option value="1">1–2 balık</option><option value="2">3 ve üstü</option></select></label>
      <label class="wide">Ne tuttun, hangi sahte?<input type="text" id="f-note" maxlength="120" placeholder="örn. 2 hani, 3 g + 2&quot; kahve silikon"></label>
      <button class="btn" type="submit">Kaydet</button>
    </form>
  </section>

  <section class="card">
    <div class="section-h"><h2>Karne</h2><span class="eyebrow">${n} av · ${hit} balıklı</span></div>
    ${n ? `<div class="tbl"><table><thead><tr><th>Uygulamanın dediği</th><th>Av</th><th>Balıklı</th><th>İsabet</th></tr></thead><tbody>
      ${bands.filter(b => b.n).map(b => `<tr><td><span class="cellsc" style="background:${LVL_HEX[b.i]}">${b.l}</span></td><td class="num">${b.n}</td><td class="num">${b.hit}</td><td class="num">%${Math.round(b.hit / b.n * 100)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Kayıtların tarihi tahmin aralığının dışında.</td></tr>'}</tbody></table></div>
      <p class="sm mt">Defter düzeltmesi: <b class="num">${off.global > 0 ? '+' : ''}${fmt(off.global)}</b> puan${Object.keys(off.win).length || Object.keys(off.spot).length ? ' (dilim ve nokta bazında ek düzeltme var)' : ''}. İyi çalışan bir tahminde üst satırların isabeti alt satırlardan yüksek olur.</p>` : '<p class="muted">Henüz kayıt yok. İlk üç kayıttan sonra düzeltme belirginleşir.</p>'}
  </section>

  <section class="card">
    <div class="section-h"><h2>Kayıtlar</h2>${n ? '<button class="linkbtn" id="export" type="button">Defteri kopyala</button>' : ''}</div>
    <div class="loglist">${log.map(t => { const p = dParts(t.date); return `<div class="logrow"><span class="dot" style="background:${t.fish > 1 ? LVL_HEX[4] : t.fish ? LVL_HEX[3] : LVL_HEX[0]}"></span>
      <div><b>${p.label} ${p.short} · ${WINDOWS.find(w => w.id === t.win).name.toLowerCase()} · ${esc(SPOTS.find(s => s.id === t.spot)?.short)}</b><br><span class="muted sm">${t.fish > 1 ? '3 ve üstü' : t.fish ? '1–2 balık' : 'Boş'}${t.note ? ' · ' + esc(t.note) : ''}${t.pred != null ? ` · uygulama: ${fmt(t.pred)} (${lvl(t.pred).toLowerCase()})` : ''}</span></div>
      <button class="linkbtn" type="button" data-del="${t.id}" aria-label="Kaydı sil">Sil</button></div>`; }).join('') || '<p class="muted">—</p>'}</div>
    <textarea id="export-out" class="export" readonly hidden></textarea>
  </section>

  <section class="card">
    <div class="section-h"><h2>Bu puanlar neye dayanıyor?</h2></div>
    <details open><summary>Dürüst sınırlar</summary><ul>
      <li>Hava durumundan balığın yiyip yemeyeceğini güvenilir biçimde söyleyen kanıtlanmış bir yöntem yok. Ay ve "solunar" tabloları test edildiği çalışmada av verimini öngöremedi; basıncın etkisi de gösterilemedi.</li>
      <li>Bu yüzden uygulama iki şeyi ayırır: <b>koşul</b> (rahat ve güvenli atış; iyi tahmin edilir) ve <b>av şansı</b> (hangi tür, hangi saatte, hangi noktada; kaba tahmin).</li>
      <li>Kıyıdan hafif sahteyle boş dönmek olağandır. Puan dilimleri ve noktaları sıralar, balığı garanti etmez.</li></ul></details>
    <details><summary>Av şansı nasıl hesaplanıyor</summary><ul>
      <li>Her tür için: mevsim (ay) × günün saati (tan, sabah, öğle, ikindi, gün batımı, gece) × nokta uygunluğu (kaya, kum, ışık, burun) × sahteyle tutulabilirlik.</li>
      <li>Deniz suyu sıcaklığı: kalamar ve levrek su soğuyunca, iskarmoz ve Kızıldeniz barbunu su sıcakken.</li>
      <li>Deniz durumu: levrek ve sargoz köpüklü suyu sever, dümdüz denizde düşer; kalamar ve zargana çırpıntıda ve bulanık suda düşer.</li>
      <li>Türlerin ihtimalleri birleştirilir, sonra atış koşulu kötüyse kırpılır. Defterin varsa sonuç ona göre kaydırılır.</li></ul></details>
    <details><summary>Koşul nasıl hesaplanıyor</summary><ul>
      <li>Rüzgâr karşıdan 6 knot üstü hafif sahteyi zorlar, 10 üstü ciddi düşürür, 18 üstü avı bitirir. Arkadan rüzgâr zarar vermez.</li>
      <li>Kıyıdaki dalga, açık deniz dalgasının o kıyıya bakış açısına göre hesaplanır: 0,6 m üstü çırpıntı, 0,9 m üstü zor, 1,2 m üstü tehlikeli.</li>
      <li>Yağmur ve 25 knot üstü hamle puanı düşürür.</li></ul></details>
    <p class="muted xs mt">Veri: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (ECMWF, DWD, Météo-France). Fırtına uyarıları için <a href="https://pirireis.mgm.gov.tr" target="_blank" rel="noopener">MGM Piri Reis</a>. Asgari av boyları: 6/2 Amatör Avcılık Tebliği.</p>
  </section>
  <section class="card" id="install-card" ${deferredPrompt ? '' : 'hidden'}><h2>Telefona yükle</h2><p class="muted sm mt">Ana ekrana ikon olarak eklenir, tam ekran açılır.</p><button class="btn mt" id="install-btn" type="button">Uygulamayı yükle</button></section>`;

  $('#trip').addEventListener('submit', e => {
    e.preventDefault();
    state.log.push({ id: Date.now().toString(36), date: $('#f-date').value, win: $('#f-win').value, spot: $('#f-spot').value, fish: +$('#f-fish').value, note: $('#f-note').value.trim() });
    rebuild();
  });
  $('#tab-defter').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { state.log = state.log.filter(t => t.id !== b.dataset.del); rebuild(); }));
  const ex = $('#export'); if (ex) ex.addEventListener('click', async () => {
    const txt = JSON.stringify(state.log.map(({ id, ...r }) => r));
    try { await navigator.clipboard.writeText(txt); ex.textContent = 'Kopyalandı'; } catch (e) { const o = $('#export-out'); o.hidden = false; o.value = txt; o.select(); }
  });
  const ib = $('#install-btn'); if (ib) ib.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#install-card').hidden = true; });
}

function switchTab(t) {
  state.tab = t;
  document.querySelectorAll('.tab').forEach(s => s.hidden = s.id !== 'tab-' + t);
  document.querySelectorAll('.tabbar button').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#spotbar').hidden = t === 'harita' || t === 'defter';
  if (t === 'hafta') renderWeek(); if (t === 'turler') renderSpecies(); if (t === 'harita') renderMap(); if (t === 'defter') renderDefter();
  window.scrollTo({ top: 0 });
}

// ---------- başlangıç ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; const c = $('#install-card'); if (c) c.hidden = false; });
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$('#refresh').addEventListener('click', load);
state.log = read(LOG_KEY, []);
loadPos();
const savedSpot = read(SPOT_KEY, 'ilginlar'); state.spot = (savedSpot === 'best' || SPOTS.some(s => s.id === savedSpot)) ? savedSpot : 'ilginlar';
$('#day').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
renderSpotbar();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
load();
