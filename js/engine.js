// Puanlama motoru: Open-Meteo saatlik verisinden her saat, nokta, dilim ve gün için 1–10 balık puanı.
// Kurallar README.md'deki "Puanlama" bölümüyle aynıdır; değiştirirsen ikisini birlikte güncelle.

export const SPOTS = [
  // facing: kıyının denize baktığı yön (derece). Koordinatlar yaklaşıktır.
  { id: 'ilginlar', name: 'Bağla – Ilgınlar', short: 'Ilgınlar', facing: 180, lat: 36.9645, lon: 27.3290, main: true,
    edges: { w: 'batı kayalıkları', e: 'doğu kayalıkları' } },
  { id: 'karaincir', name: 'Karaincir', short: 'Karaincir', facing: 185, lat: 36.9605, lon: 27.3150,
    edges: { w: 'batı ucu', e: 'doğu ucu' } },
  { id: 'akyarlar', name: 'Akyarlar', short: 'Akyarlar', facing: 215, lat: 36.9600, lon: 27.2930,
    edges: { w: 'fener ve burun', e: 'liman tarafı' } },
  { id: 'aspat', name: 'Aspat', short: 'Aspat', facing: 200, lat: 36.9700, lon: 27.3560,
    edges: { w: 'batı kayalıkları', e: 'ada tarafı' } }
];

export const WINDOWS = [
  { id: 'sabah', name: 'Sabah' },
  { id: 'oglen', name: 'Öğlen' },
  { id: 'aksam', name: 'Akşam' },
  { id: 'gece', name: 'Gece' }
];

const WIND_NAMES = [
  [22.5, 'Yıldız'], [67.5, 'Poyraz'], [112.5, 'Gündoğusu'], [157.5, 'Keşişleme'],
  [202.5, 'Kıble'], [247.5, 'Lodos'], [292.5, 'Batı (günbatısı)'], [337.5, 'Karayel'], [360, 'Yıldız']
];
export function windName(deg) {
  const d = ((deg % 360) + 360) % 360;
  for (const [lim, n] of WIND_NAMES) if (d < lim) return n;
  return 'Yıldız';
}

// Ay aydınlanması (0–1) ve büyüyen/küçülen
export function moon(date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const syn = 29.530588853;
  const age = (((date.getTime() - ref) / 86400000) % syn + syn) % syn;
  return { illum: (1 - Math.cos(2 * Math.PI * age / syn)) / 2, waxing: age < syn / 2, age };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 2) / 2;

// Rüzgârın kıyıya göre bileşeni: +1 tam denizden (karşıdan), −1 tam karadan (arkadan)
export function onshore(windFromDeg, facing) {
  return Math.cos((windFromDeg - facing) * Math.PI / 180);
}

function minutesOf(isoLocal) { const t = isoLocal.slice(11, 16).split(':'); return +t[0] * 60 + +t[1]; }

// Saat → dilim
function windowOf(min, rise, set) {
  if (min < rise - 60) return 'gece';
  if (min >= rise - 60 && min < rise + 120) return 'sabah';
  if (min >= rise + 120 && min < set - 90) return 'oglen';
  if (min >= set - 90 && min < set + 75) return 'aksam';
  return 'gece';
}

// Tek saat, tek nokta puanı
export function scoreHour(h, spot, ctx) {
  const reasons = [];
  let s = 3.5;
  const kn = h.wind, gust = h.gust, on = onshore(h.dir, spot.facing);
  const fromSea = on > 0.35, fromLand = on < -0.35;

  // Rüzgâr
  if (gust > 25 || kn > 18) { s -= 2.5; reasons.push('sert rüzgâr'); }
  else if (kn >= 13) { s += fromSea ? -1 : 0; reasons.push(fromSea ? 'karşıdan güçlü rüzgâr' : 'güçlü ama yandan/arkadan rüzgâr'); }
  else if (kn >= 4) { s += 1; if (fromLand) { s += 0.5; reasons.push('rüzgâr arkadan, atış uzun'); } else reasons.push('ideal rüzgâr'); }
  else { if (h.win === 'oglen' && h.cloud < 40) { s -= 0.5; reasons.push('ayna deniz, parlak'); } }

  // Dalga (noktaya göre)
  const w = h.wave == null ? null : h.wave * (fromLand ? 0.45 : fromSea ? 1.1 : 0.8);
  if (w != null) {
    if (w > 1) { s -= 2.5; reasons.push('büyük dalga'); }
    else if (w > 0.8) { s -= 1; reasons.push('dalga yüksek'); }
    else if (w > 0.5) { reasons.push('köpüklü kaya önü (levrek)'); }
    else { s += 1; reasons.push('LRF için ideal deniz'); }
  }

  // Basınç eğilimi (12 saat)
  if (h.dp12 != null) {
    if (h.dp12 <= -2) { s += 1.5; reasons.push('basınç düşüyor (cephe öncesi)'); }
    else if (h.dp12 <= -0.7) { s += 1; reasons.push('basınç hafif düşüyor'); }
    else if (h.dp12 >= 3) { s -= 1.5; reasons.push('cephe sonrası hızlı yükseliş'); }
    else if (h.p >= 1010 && h.p <= 1020) s += 0.5;
    if (h.p > 1025) { s -= 1; reasons.push('yüksek, durgun basınç'); }
  }

  // Işık ve zaman
  if (h.win === 'sabah' || h.win === 'aksam') { s += 1.5; reasons.push(h.win === 'sabah' ? 'şafak' : 'alacakaranlık'); }
  if (h.win === 'oglen') {
    if (h.cloud >= 60 || (h.rain > 0.1 && h.rain <= 1)) { s += 0.5; reasons.push('bulutlu, balık cesur'); }
    else if (h.cloud < 30) { s -= 0.5; reasons.push('güneşli öğle'); }
  }
  if (h.rain > 3) { s -= 1; reasons.push('kuvvetli yağış'); }
  if (h.win === 'gece') {
    if (h.moon > 0.8) { s -= 0.5; reasons.push('aydınlık gece'); }
    else if (h.moon < 0.2) { s += 0.5; reasons.push('karanlık gece'); }
  }

  // Su
  if (ctx.sst != null && ctx.sst < 13) { s -= 1; reasons.push('su çok soğuk'); }
  if (ctx.sstDrop != null && ctx.sstDrop >= 2) { s -= 1; reasons.push('su ani soğudu'); }
  if (ctx.rain48 > 10 && h.win !== 'gece') { s += 0.3; reasons.push('yağmur sonrası hafif bulanık su'); }

  return { score: clamp(s, 1, 10), reasons, spotWave: w, fromSea, fromLand, on };
}

// API yanıtlarından günler
export function buildDays(wx, marine) {
  const H = wx.hourly, M = marine && marine.hourly;
  const mIdx = new Map(); if (M) M.time.forEach((t, i) => mIdx.set(t, i));
  const sunByDate = new Map(); wx.daily.time.forEach((d, i) => sunByDate.set(d, { rise: wx.daily.sunrise[i], set: wx.daily.sunset[i] }));

  const hours = H.time.map((t, i) => {
    const date = t.slice(0, 10), sun = sunByDate.get(date);
    const min = minutesOf(t), rise = minutesOf(sun.rise), set = minutesOf(sun.set);
    const mi = mIdx.get(t);
    return {
      t, date, min, i,
      wind: H.wind_speed_10m[i], dir: H.wind_direction_10m[i], gust: H.wind_gusts_10m[i],
      p: H.pressure_msl[i], dp12: i >= 12 ? H.pressure_msl[i] - H.pressure_msl[i - 12] : null,
      rain: H.precipitation[i] || 0, cloud: H.cloud_cover[i], temp: H.temperature_2m[i],
      wave: mi != null ? M.wave_height[mi] : null, period: mi != null ? M.wave_period[mi] : null,
      sst: mi != null ? M.sea_surface_temperature[mi] : null,
      win: windowOf(min, rise, set),
      moon: moon(new Date(t + ':00+03:00')).illum
    };
  });

  const byDate = new Map();
  for (const h of hours) { if (!byDate.has(h.date)) byDate.set(h.date, []); byDate.get(h.date).push(h); }

  const days = [];
  for (const [date, hs] of byDate) {
    if (hs.length < 20) continue;
    const firstI = hs[0].i;
    const prev48 = hours.slice(Math.max(0, firstI - 48), firstI);
    const rain48 = prev48.reduce((a, h) => a + h.rain, 0);
    const sstNow = avg(hs.map(h => h.sst).filter(v => v != null));
    const sstPrev = avg(hours.slice(Math.max(0, firstI - 72), Math.max(0, firstI - 48)).map(h => h.sst).filter(v => v != null));
    const ctx = { sst: sstNow, sstDrop: sstNow != null && sstPrev != null ? sstPrev - sstNow : null, rain48 };

    const riseMin = minutesOf(sunByDate.get(date).rise);
    const fishHours = hs.filter(h => h.min >= riseMin - 60 && h.min <= 1380); // şafaktan 23:00'e
    const scored = fishHours.map(h => {
      const per = SPOTS.map(sp => ({ spot: sp, ...scoreHour(h, sp, ctx) }));
      per.sort((a, b) => b.score - a.score);
      const main = per.find(p => p.spot.main);
      return { ...h, per, best: per[0], main };
    });

    const windows = WINDOWS.map(w => {
      const wh = scored.filter(h => h.win === w.id);
      if (!wh.length) return { ...w, score: null };
      const sc = avg(wh.map(h => h.best.score));
      const top = wh.reduce((a, b) => (b.best.score > a.best.score ? b : a));
      return { ...w, score: round1(sc), from: wh[0].t.slice(11, 16), to: endTime(wh[wh.length - 1].t), top, hours: wh };
    });
    const valid = windows.filter(w => w.score != null);
    const bestWin = valid.reduce((a, b) => (b.score > a.score ? b : a));
    const sorted = valid.map(w => w.score).sort((a, b) => b - a);
    const dayScore = round1(0.65 * sorted[0] + 0.35 * (sorted[1] ?? sorted[0]));
    const bestHour = scored.reduce((a, b) => (b.best.score > a.best.score ? b : a));

    const spotDay = SPOTS.map(sp => {
      const vals = scored.filter(h => h.win === 'sabah' || h.win === 'aksam').map(h => h.per.find(p => p.spot.id === sp.id));
      const sc = round1(avg(vals.map(v => v.score)));
      const onAvg = avg(vals.map(v => v.on));
      const maxWave = Math.max(...vals.map(v => v.spotWave ?? 0));
      const windAvgDir = circMean(scored.filter(h => h.win !== 'gece').map(h => h.dir));
      return { spot: sp, score: sc, sheltered: onAvg < -0.35, exposed: onAvg > 0.35, maxWave, edge: shelteredEdge(sp, windAvgDir) };
    }).sort((a, b) => (b.spot.main ? 0.25 : 0) + b.score - ((a.spot.main ? 0.25 : 0) + a.score));

    const sun = sunByDate.get(date);
    const dayHours = hs.filter(h => h.min >= 360 && h.min <= 1260);
    const summary = {
      windMin: Math.min(...dayHours.map(h => h.wind)), windMax: Math.max(...dayHours.map(h => h.wind)),
      gustMax: Math.max(...dayHours.map(h => h.gust)),
      dirMorning: circMean(dayHours.filter(h => h.min < 720).map(h => h.dir)),
      dirEvening: circMean(dayHours.filter(h => h.min >= 900).map(h => h.dir)),
      waveMax: maxOrNull(dayHours.map(h => h.wave)), period: avg(dayHours.map(h => h.period).filter(v => v != null)),
      pStart: hs[6]?.p, pEnd: hs[21]?.p, rain: hs.reduce((a, h) => a + h.rain, 0),
      cloud: avg(dayHours.map(h => h.cloud)), tMin: Math.min(...hs.map(h => h.temp)), tMax: Math.max(...hs.map(h => h.temp)),
      sst: sstNow, rain48
    };
    const m = moon(new Date(date + 'T22:00:00+03:00'));
    const safety = [];
    if (summary.gustMax > 25) safety.push(`Hamle ${Math.round(summary.gustMax)} knot'a çıkıyor; kayalık uçlara çıkma.`);
    if (summary.waveMax != null && summary.waveMax > 1) safety.push(`Açıkta dalga ${fmt(summary.waveMax)} m; ıslak kaya kaygan.`);
    if (hs.some(h => h.rain > 5)) safety.push('Kuvvetli sağanak; gök gürültüsünde karbon kamışı topla, kıyıdan uzaklaş.');

    days.push({
      date, sun: { rise: sun.rise.slice(11), set: sun.set.slice(11) }, moon: m,
      score: dayScore, windows, bestWin, bestHour, spots: spotDay, summary, safety,
      targets: targetsFor(date, summary, ctx, bestWin),
      hours: scored
    });
  }
  return days;
}

function endTime(t) { const [h, m] = t.slice(11, 16).split(':').map(Number); return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function maxOrNull(a) { const v = a.filter(x => x != null); return v.length ? Math.max(...v) : null; }
function circMean(degs) {
  if (!degs.length) return null;
  let x = 0, y = 0; for (const d of degs) { x += Math.cos(d * Math.PI / 180); y += Math.sin(d * Math.PI / 180); }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
export function fmt(v, d = 1) { return v == null ? '–' : v.toFixed(d).replace('.', ','); }

function shelteredEdge(sp, dir) {
  if (dir == null) return '';
  // batılı rüzgârda koyun batı kenarı (rüzgârı arkadan alan) kuytu, doğuluda doğu kenarı
  const westerly = dir > 200 && dir < 340, easterly = dir > 20 && dir < 160;
  if (westerly) return sp.edges.w;
  if (easterly) return sp.edges.e;
  return 'tüm koy';
}

// Hedef türler ve takım (ay + koşullar)
function targetsFor(date, s, ctx, bestWin) {
  const mo = +date.slice(5, 7);
  const windy = s.windMax >= 13;
  const murky = s.rain48 > 8 || s.rain > 5 || s.cloud > 70;
  const color = murky ? 'chartreuse / glow / beyaz' : 'doğal / şeffaf / gümüş';
  const head = windy ? '5–7 g' : '2–5 g';
  const t = [];
  t.push({ sp: 'Hani', lvl: 'hi', lure: `${head} jig head + 2,5" silikon, ${murky ? 'chartreuse' : 'motor yağı / kahve'}`, how: 'Dibe indir, kısa zıplat, sık dur. Kaya diplerinde.' });
  const waveOk = s.waveMax != null && s.waveMax >= 0.3 && s.waveMax <= 1.0;
  if ([10, 11, 12, 1, 2, 3, 4].includes(mo) || waveOk)
    t.push({ sp: 'Levrek', lvl: (waveOk || ctx.rain48 > 10) ? 'hi' : 'md', lure: `7–9 cm minnow veya 3" shad + 5 g, ${murky ? 'beyaz / chartreuse' : 'sardalya deseni'}`, how: 'Köpük hattının içinden yavaş, duraklatarak. Akyarlar burnu ve kaya uçları.' });
  if ([10, 11, 12, 1, 2, 3].includes(mo))
    t.push({ sp: 'Kalamar', lvl: (s.waveMax ?? 0) < 0.4 && ctx.rain48 < 10 ? 'hi' : 'md', lure: `2.0–2.5 zoka, ${murky ? 'turuncu / glow' : 'kırmızı / turuncu'}`, how: 'Gün batımı ±1 saat, deniz çayırı kenarı; iki sert kaldırma, uzun bekleme.' });
  if ([9, 10, 11, 12, 1, 2, 3, 4].includes(mo))
    t.push({ sp: 'İstavrit', lvl: 'md', lure: '1,5–2 g + 1,5" silikon, glow', how: 'Akşam ve gece orta suda sabit yavaş çekiş.' });
  if ((ctx.sst ?? 20) >= 18)
    t.push({ sp: 'Kızıldeniz barbunu', lvl: 'md', lure: '3 g + 2" silikon, kırmızı / doğal', how: 'Kum-kaya geçişinde dipte sürükle.' });
  if ([9, 10, 11, 12].includes(mo))
    t.push({ sp: 'Çinekop', lvl: 'md', lure: '7–10 g mikro jig veya kaşık, gümüş', how: 'Sabah, yüzeyde kaynama görürsen önüne at, hızlı çek.' });
  if ([4, 5, 6, 7, 8, 9, 10].includes(mo) || (ctx.sst ?? 0) >= 18)
    t.push({ sp: 'Çipura', lvl: [11, 12, 1, 2, 3].includes(mo) ? 'lo' : 'md', lure: '3–5 g yengeç / creature silikon', how: 'Kaya-kum geçişinde dipte çok yavaş sürükle.' });
  return t.slice(0, 5);
}
