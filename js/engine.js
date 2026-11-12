// Balık Bülteni motoru, 2. sürüm.
// İki ayrı soru ayrı puanlanır:
//   KOŞUL  : O saatte o noktada rahat ve güvenli atış yapılabilir mi? (rüzgâr, dalga, yağış — iyi tahmin edilir)
//   ŞANS   : O saatte sahteye gelecek bir tür orada ve aktif mi? (mevsim, su sıcaklığı, ışık, deniz durumu — kaba tahmin)
// Basınç ve ay evresi, kanıtı zayıf olduğu için puanı neredeyse etkilemez; yalnızca bilgi olarak gösterilir.
// Kurallar README.md ile aynıdır; değiştirirsen ikisini birlikte güncelle.

export const SPOTS = [
  // facing: kıyının denize baktığı yön. rock/sand/lights/point: 0–1 habitat özellikleri. Koordinatlar yaklaşıktır.
  { id: 'ilginlar', name: 'Bağla – Ilgınlar', short: 'Ilgınlar', facing: 180, lat: 36.9645, lon: 27.3290, main: true,
    rock: 0.5, sand: 0.9, lights: 0.1, point: 0.2, edges: { w: 'batı kayalıkları', e: 'doğu kayalıkları' },
    tip: 'Kumsalın ortası sığ ve boş kumdur. Balık iki uçtaki kayalıklarda ve kayanın kuma döndüğü çizgide durur.' },
  { id: 'karaincir', name: 'Karaincir', short: 'Karaincir', facing: 185, lat: 36.9605, lon: 27.3150,
    rock: 0.5, sand: 0.9, lights: 0.1, point: 0.3, edges: { w: 'batı ucu', e: 'doğu ucu' },
    tip: 'Ilgınlar gibi: orta kısım kum, iki uç kaya. Uçlardan açığa doğru at.' },
  { id: 'akyarlar', name: 'Akyarlar', short: 'Akyarlar', facing: 215, lat: 36.9600, lon: 27.2930,
    rock: 0.9, sand: 0.3, lights: 0.7, point: 1, edges: { w: 'fener ve burun', e: 'liman tarafı' },
    tip: 'Burun akıntı alır, liman ışık verir. Gece ışık altı ve alacakaranlıkta burun, bu dört noktanın en güçlüsü.' },
  { id: 'aspat', name: 'Aspat', short: 'Aspat', facing: 200, lat: 36.9700, lon: 27.3560,
    rock: 0.8, sand: 0.4, lights: 0.2, point: 0.5, edges: { w: 'batı kayalıkları', e: 'ada tarafı' },
    tip: 'Kayalık ve çabuk derinleşen kıyı. Kaya balıkları ve alacakaranlıkta avcılar için.' }
];

export const WINDOWS = [
  { id: 'sabah', name: 'Sabah' }, { id: 'oglen', name: 'Öğlen' }, { id: 'aksam', name: 'Akşam' }, { id: 'gece', name: 'Gece' }
];

// Işık evreleri: tan, sabah, öğle, ikindi, gün batımı, gece
export const PHASES = ['tan', 'sabah', 'ogle', 'ikindi', 'batim', 'gece'];

// Tür profilleri.
//  ay: Ocak..Aralık mevsim ağırlığı (0–1). isik: PHASES sırasıyla aktiflik (0–1). lrf: hafif sahteyle tutulabilirlik.
//  kanit: bu profilin dayanağı — 'biyoloji' (türün bilinen davranışı), 'tecrube' (balıkçı ortak görüşü).
export const SPECIES = [
  { id: 'hani', name: 'Hani', ay: [.7, .7, .7, .8, .9, .9, .9, .9, .9, .9, .9, .8], isik: [.6, .9, .7, .9, .8, .1], lrf: .9,
    hab: s => 0.45 + 0.55 * s.rock, kanit: 'biyoloji',
    lure: '3–5 g jig head + 2–2,5" silikon; berrakta motor yağı / kahve', how: 'Kayanın dibine indir, kısa kısa zıplat, sık durdur. Vuruş genelde duruşta gelir.',
    bilgi: 'Gündüzcü kaya balığı. Yıl boyu aynı taşlarda durur; gece yemez. Senin defterinde Ilgınlar\'ın en güvenilir türü.' },
  { id: 'iskorpit', name: 'İskorpit, lipsoz', ay: [.7, .7, .7, .7, .7, .7, .7, .7, .7, .7, .7, .7], isik: [.6, .3, .15, .3, .8, 1], lrf: .7,
    hab: s => 0.3 + 0.7 * s.rock, kanit: 'biyoloji',
    lure: '3–5 g jig head + 2" creature / kurt silikon, koyu renk ya da glow', how: 'Tam dipte, çok yavaş sürükle ve beklet. Kaya oyuklarının ağzı.',
    bilgi: 'Gececi pusu avcısı. Gün batımından sonra oyuktan çıkar. Sırt dikenleri zehirlidir; pense ile tut.' },
  { id: 'istavrit', name: 'İstavrit', ay: [1, .9, .8, .6, .4, .3, .3, .3, .6, .8, .9, 1], isik: [.8, .4, .2, .4, .9, .5], lrf: .9,
    hab: s => 0.35 + 0.65 * s.lights, nightLights: true, warm: 23, kanit: 'tecrube',
    lure: '1–2 g jig head + 1,5" ince silikon (glow / şeffaf) ya da 3–5 g mikro jig', how: 'Işığın karanlıkla birleştiği çizgiye at, orta suda sabit yavaş çek.',
    bilgi: 'Gündüz açıkta ve derinde, akşam karanlığında kıyıya ve ışık altına gelir. Işıksız plajda gece şansı düşüktür; liman ve iskele ara.' },
  { id: 'kupez', name: 'Kupez', ay: [.6, .6, .6, .6, .6, .6, .6, .6, .6, .6, .6, .6], isik: [.6, .7, .5, .7, .7, .3], lrf: .55,
    hab: s => 0.6 + 0.3 * s.lights, nightLights: true, kanit: 'tecrube',
    lure: '1–1,5 g jig head + 1–1,5" silikon, çok küçük iğne', how: 'Orta su ve yüzeye yakın, yavaş. Ağzı küçüktür; sahteyi küçült.',
    bilgi: 'Yıl boyu sürü hâlinde gezer. Küçük sahte ister; 2,5" silikona vurur ama takılmaz.' },
  { id: 'kalamar', name: 'Kalamar', ay: [1, .9, .7, .4, .1, .05, .05, .05, .15, .5, .8, 1], isik: [.7, .2, .05, .3, 1, .8], lrf: .8,
    hab: s => 0.6 + 0.25 * s.lights + 0.15 * s.sand, cool: [21, 23], hateTurbid: .5, hateChop: [.5, .6], kanit: 'tecrube',
    lure: '2.0–2.5 numara zoka; alacakaranlıkta turuncu / pembe, karanlıkta glow', how: 'Dibe yakın indir, iki sert kaldır, 5–8 saniye bekle. Gün batımı ±1 saat.',
    bilgi: 'Su 21 °C\'nin altına inince kıyıya yanaşır; asıl sezon Aralık–Şubat. Berrak ve sakin su ister, bulanıkta gelmez.' },
  { id: 'levrek', name: 'Levrek', ay: [1, 1, .8, .5, .2, .2, .2, .2, .3, .5, .7, .9], isik: [1, .5, .2, .4, .9, .7], lrf: .45,
    hab: s => 0.35 + 0.35 * s.rock + 0.3 * s.point, warm: 22, likeChop: true, likeTurbid: 1.2, front: true, kanit: 'tecrube',
    lure: '7–9 cm minnow ya da 3" shad + 5–7 g; bulanıkta beyaz / chartreuse', how: 'Köpüğün içinden yavaş çek, duraklat. Dümdüz berrak denizde bekleme.',
    bilgi: 'Hareketli, köpüklü, hafif bulanık suda avlanır. Asıl sezon su soğuyunca, Aralık–Mart. Kıyıdan sahteyle zor ve seyrek bir balıktır.' },
  { id: 'cinekop', name: 'Çinekop, lüfer', ay: [.3, .1, .1, .1, .1, .1, .1, .3, .7, .9, .9, .6], isik: [1, .5, .2, .4, .9, .4], lrf: .6,
    hab: s => 0.3 + 0.7 * s.point, front: true, kanit: 'tecrube',
    lure: '7–12 g kaşık ya da mikro jig, gümüş; çelik tel ya da kalın köstek', how: 'Uzağa at, hızlı çek. Yüzeyde kaçışan yem balığı görürsen önüne at.',
    bilgi: 'Sonbahar göçünde burunlardan geçer; gelir ya da gelmez, sürü işidir. Dişleri misinayı keser.' },
  { id: 'iskarmoz', name: 'İskarmoz (barakuda)', ay: [.2, .2, .2, .2, .3, .6, .8, .9, 1, 1, .8, .5], isik: [1, .3, .1, .3, .9, .8], lrf: .6,
    hab: s => 0.4 + 0.3 * s.point + 0.3 * s.lights, coldBelow: 19, kanit: 'tecrube',
    lure: '7–9 cm ince minnow ya da 5–10 g mikro jig; kalın köstek', how: 'Alacakaranlıkta ve gece yüzeye yakın, düz ve orta hızda çek.',
    bilgi: 'Sıcak su avcısı. Su 20 °C\'nin üstündeyken alacakaranlık ve gece kıyıya ve ışık altına girer.' },
  { id: 'zargana', name: 'Zargana', ay: [.7, .6, .5, .3, .3, .3, .3, .3, .7, .9, 1, .9], isik: [.6, .9, .8, .9, .6, .05], lrf: .55,
    hab: () => 0.8, hateChop: [.6, .7], kanit: 'tecrube',
    lure: '3–7 g mikro jig ya da ince kaşık; yüzeyden', how: 'Yüzeyde hızlı ve seğirterek çek. Gagası serttir; vuruşların çoğu takılmaz.',
    bilgi: 'Gündüz yüzeyde gezer; sonbahar ve kış başında kıyıya çok yaklaşır. Gündüz için en gerçekçi hedeflerden.' },
  { id: 'sargoz', name: 'Sargoz, karagöz, sarıgöz', ay: [.75, .75, .75, .7, .6, .6, .6, .6, .6, .75, .75, .75], isik: [.8, .4, .2, .4, .9, .8], lrf: .35,
    hab: s => 0.3 + 0.7 * s.rock, likeChop: true, kanit: 'tecrube',
    lure: '2–3 g jig head + 1,5–2" creature / yengeç silikon', how: 'Köpüklü kaya dibinde, dipte çok yavaş. Sahteye nazlıdır.',
    bilgi: 'Dalganın yıkadığı kayada beslenir. Sahteyle az tutulur; düz denizde neredeyse hiç.' },
  { id: 'barbun', name: 'Kızıldeniz barbunu', ay: [.3, .3, .3, .4, .6, .7, .8, .8, .8, .7, .6, .4], isik: [.5, .8, .7, .8, .5, .1], lrf: .5,
    hab: s => 0.4 + 0.6 * s.sand, coldBelow: 20, kanit: 'tecrube',
    lure: '2–3 g jig head + 1,5–2" kurt silikon, kırmızı / doğal', how: 'Kayanın kuma döndüğü çizgide, dipte toz kaldırarak sürükle.',
    bilgi: 'Sıcak su türü; su soğudukça azalır. İstilacıdır, tutmakta sakınca yok.' },
  { id: 'cipura', name: 'Çipura', ay: [.3, .3, .4, .6, .8, .9, .9, .9, .9, .8, .5, .3], isik: [.8, .6, .4, .6, .9, .4], lrf: .15,
    hab: s => 0.5 + 0.3 * s.sand, kanit: 'tecrube',
    lure: '3–5 g yengeç / creature silikon', how: 'Dipte çok yavaş, uzun bekletmeli.',
    bilgi: 'Dalışta gördüğün çipuralar sahteye çok seyrek gelir; yemli takım balığıdır. Kasım–Aralık\'ta yumurtlamak için derine çekilir.' }
];

const WIND_NAMES = [[22.5, 'Yıldız'], [67.5, 'Poyraz'], [112.5, 'Gündoğusu'], [157.5, 'Keşişleme'], [202.5, 'Kıble'], [247.5, 'Lodos'], [292.5, 'Günbatısı'], [337.5, 'Karayel'], [360, 'Yıldız']];
export function windName(deg) { const d = ((deg % 360) + 360) % 360; for (const [lim, n] of WIND_NAMES) if (d < lim) return n; return 'Yıldız'; }

export function moon(date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853;
  const age = (((date.getTime() - ref) / 86400000) % syn + syn) % syn;
  return { illum: (1 - Math.cos(2 * Math.PI * age / syn)) / 2, waxing: age < syn / 2, age };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 2) / 2;
const cosd = d => Math.cos(d * Math.PI / 180);
export function fmt(v, d = 1) { return v == null || isNaN(v) ? '–' : v.toFixed(d).replace('.', ','); }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function maxOrNull(a) { const v = a.filter(x => x != null); return v.length ? Math.max(...v) : null; }
function circMean(degs) { if (!degs.length) return null; let x = 0, y = 0; for (const d of degs) { x += cosd(d); y += Math.sin(d * Math.PI / 180); } return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
function minutesOf(iso) { const t = iso.slice(11, 16).split(':'); return +t[0] * 60 + +t[1]; }

export function levelOf(s) { return s >= 7.5 ? 4 : s >= 6 ? 3 : s >= 4.5 ? 2 : s >= 3 ? 1 : 0; }
export const LEVELS = ['Zayıf', 'Düşük', 'Orta', 'İyi', 'Çok iyi'];

function phaseOf(min, rise, set) {
  if (min < rise - 60) return 'gece';
  if (min < rise + 45) return 'tan';
  if (min < rise + 180) return 'sabah';
  if (min < set - 180) return 'ogle';
  if (min < set - 60) return 'ikindi';
  if (min < set + 45) return 'batim';
  return 'gece';
}
function windowOf(min, rise, set) {
  if (min < rise - 60) return null;
  if (min < rise + 150) return 'sabah';
  if (min < set - 120) return 'oglen';
  if (min < set + 60) return 'aksam';
  return 'gece';
}

// Noktadaki dalga: açık deniz dalgası × o kıyının dalga yönüne açıklığı
function spotWave(h, spot) {
  if (h.wave == null) return null;
  const exp = h.waveDir == null ? 0.6 : Math.max(0, cosd(h.waveDir - spot.facing));
  return h.wave * (0.25 + 0.85 * exp);
}

// KOŞUL 0–10: rahat ve güvenli atış
export function fishability(h, spot) {
  const on = cosd(h.dir - spot.facing); // +1 karşıdan, −1 arkadan
  const w = spotWave(h, spot);
  const why = [];
  let s = 10;
  const kn = h.wind;
  if (on > 0.35) {
    if (kn > 18) { s -= 7; why.push('karşıdan çok sert rüzgâr'); }
    else if (kn > 14) { s -= 5; why.push('karşıdan sert rüzgâr'); }
    else if (kn > 10) { s -= 3; why.push('karşıdan rüzgâr, hafif sahte uçmaz'); }
    else if (kn > 6) { s -= 1; why.push('hafif karşı rüzgâr'); }
  } else if (on > -0.35) {
    if (kn > 18) { s -= 5; why.push('yandan çok sert rüzgâr'); }
    else if (kn > 14) { s -= 3; why.push('yandan sert rüzgâr, misina torba yapar'); }
    else if (kn > 10) { s -= 1.5; why.push('yandan rüzgâr'); }
  } else {
    if (kn > 18) { s -= 3; why.push('arkadan çok sert rüzgâr'); }
    else if (kn > 6) why.push('rüzgâr arkadan, atış uzun');
  }
  if (h.gust > 25) { s -= 3; why.push(`hamle ${Math.round(h.gust)} kn`); }
  if (w != null) {
    if (w > 1.2) { s -= 7; why.push('kıyıda büyük dalga'); }
    else if (w > 0.9) { s -= 4; why.push('kıyıda yüksek dalga'); }
    else if (w > 0.6) { s -= 1.5; why.push('kıyıda çırpıntı'); }
  }
  if (h.rain > 3) { s -= 3; why.push('sağanak'); } else if (h.rain > 0.5) { s -= 1; why.push('yağmur'); }
  return { score: clamp(s, 0, 10), why, wave: w, on };
}

// Bir türün o saat, o noktada aktifliği (0–1) ve nedenleri
export function activity(sp, h, spot, ctx, fa) {
  const mo = +h.date.slice(5, 7) - 1;
  const why = [];
  let a = sp.ay[mo];
  let light = sp.isik[PHASES.indexOf(h.phase)];
  if (h.phase === 'gece' && sp.nightLights) light = 0.25 + 0.7 * spot.lights;         // ışık altında gece
  if (h.phase === 'gece' && !sp.nightLights && sp.isik[5] > 0.3 && spot.lights < 0.3 && h.moon > 0.8) light *= 0.9;
  const day = h.phase === 'sabah' || h.phase === 'ogle' || h.phase === 'ikindi';
  if (day && h.cloud >= 70 && sp.isik[0] > sp.isik[2]) { light = Math.min(1, light * 1.25); why.push('kapalı hava'); }
  a *= light;
  const sst = ctx.sst;
  if (sst != null) {
    if (sp.cool) { if (sst > sp.cool[1]) { a *= 0.45; why.push(`su ${fmt(sst)}° — henüz sıcak`); } else if (sst > sp.cool[0]) { a *= 0.75; why.push('su ılık'); } }
    if (sp.warm && sst > sp.warm) { a *= 0.75; why.push('su henüz sıcak'); }
    if (sp.coldBelow && sst < sp.coldBelow) { a *= 0.6; why.push('su soğudu'); }
  }
  const w = fa.wave ?? 0;
  if (sp.likeChop) { if (w >= 0.3 && w <= 0.9) { a *= 1.3; why.push('köpüklü su'); } else if (w < 0.15) { a *= 0.6; why.push('deniz dümdüz'); } }
  if (sp.hateChop && w > sp.hateChop[0]) { a *= sp.hateChop[1]; why.push('çırpıntı'); }
  if (ctx.turbid) { if (sp.likeTurbid) { a *= sp.likeTurbid; why.push('bulanık su'); } else if (sp.hateTurbid) { a *= sp.hateTurbid; why.push('bulanık su'); } else a *= 0.9; }
  if (sp.front && h.dp12 != null && h.dp12 <= -3) { a *= 1.1; why.push('cephe yaklaşıyor'); }
  a *= sp.hab(spot) * sp.lrf;
  return { a: clamp(a, 0, 1), why };
}

// Türlerin birleşimi: her tür bağımsız bir küçük ihtimal sayılır. K, ölçeği belirler (defterle ayarlanır).
const K = 0.3;
// O saat, o nokta: şans (0–10), koşul (0–10), türler
export function scoreHour(h, spot, ctx) {
  const fa = fishability(h, spot);
  const sp = SPECIES.map(s => ({ sp: s, ...activity(s, h, spot, ctx, fa) })).sort((x, y) => y.a - x.a);
  let miss = 1; for (const x of sp) miss *= (1 - K * x.a);
  const gate = fa.score >= 6 ? 1 : fa.score <= 2 ? 0.25 : 0.25 + 0.75 * (fa.score - 2) / 4;
  const raw = 10 * (1 - miss);
  return { spot, chance: clamp(raw * gate, 0, 10), raw, cond: fa.score, condWhy: fa.why, wave: fa.wave, on: fa.on, species: sp };
}

// API yanıtlarından günler. offsets: av defterinden gelen düzeltme { global, win:{}, spot:{} }
export function buildDays(wx, marine, offsets) {
  const H = wx.hourly, M = marine && marine.hourly;
  const mIdx = new Map(); if (M) M.time.forEach((t, i) => mIdx.set(t, i));
  const sunBy = new Map(); wx.daily.time.forEach((d, i) => sunBy.set(d, { rise: wx.daily.sunrise[i], set: wx.daily.sunset[i] }));
  const hours = H.time.map((t, i) => {
    const date = t.slice(0, 10), sun = sunBy.get(date), min = minutesOf(t), rise = minutesOf(sun.rise), set = minutesOf(sun.set), mi = mIdx.get(t);
    const g = k => (mi != null && M[k]) ? M[k][mi] : null;
    return { t, date, min, i, wind: H.wind_speed_10m[i], dir: H.wind_direction_10m[i], gust: H.wind_gusts_10m[i],
      p: H.pressure_msl[i], dp12: i >= 12 ? H.pressure_msl[i] - H.pressure_msl[i - 12] : null,
      rain: H.precipitation[i] || 0, cloud: H.cloud_cover[i], temp: H.temperature_2m[i],
      wave: g('wave_height'), waveDir: g('wave_direction'), period: g('wave_period'), sst: g('sea_surface_temperature'),
      cur: g('ocean_current_velocity'), level: g('sea_level_height_msl'),
      phase: phaseOf(min, rise, set), win: windowOf(min, rise, set), moon: moon(new Date(t + ':00+03:00')).illum };
  });
  const byDate = new Map(); for (const h of hours) { if (!byDate.has(h.date)) byDate.set(h.date, []); byDate.get(h.date).push(h); }
  const off = offsets || { global: 0, win: {}, spot: {} };
  const days = [];
  for (const [date, hs] of byDate) {
    if (hs.length < 20) continue;
    const f = hs[0].i, prev48 = hours.slice(Math.max(0, f - 48), f), prev24 = hours.slice(Math.max(0, f - 24), f);
    const rain48 = prev48.reduce((a, h) => a + h.rain, 0);
    const wave24 = maxOrNull(prev24.map(h => h.wave));
    const sst = avg(hs.map(h => h.sst).filter(v => v != null));
    const sstWeek = avg(hours.slice(Math.max(0, f - 168), Math.max(0, f - 144)).map(h => h.sst).filter(v => v != null));
    const ctx = { sst, rain48, wave24, turbid: rain48 > 15 || (wave24 != null && wave24 > 0.9) };

    const scored = hs.filter(h => h.win).map(h => {
      const per = SPOTS.map(sp => { const r = scoreHour(h, sp, ctx); r.chance = clamp(r.chance + off.global + (off.win[h.win] || 0) + (off.spot[sp.id] || 0), 0, 10); return r; })
        .sort((a, b) => b.chance - a.chance);
      return { ...h, per, best: per[0], main: per.find(p => p.spot.main) };
    });
    const windows = WINDOWS.map(w => {
      const wh = scored.filter(h => h.win === w.id); if (!wh.length) return { ...w, score: null };
      const bySpot = SPOTS.map(sp => {
        const ps = wh.map(h => h.per.find(p => p.spot.id === sp.id));
        const topH = wh[ps.indexOf(ps.reduce((a, b) => (b.chance > a.chance ? b : a)))];
        const tp = topH.per.find(p => p.spot.id === sp.id);
        const species = SPECIES.map(s => ({ sp: s, a: avg(ps.map(p => p.species.find(x => x.sp.id === s.id).a)), why: tp.species.find(x => x.sp.id === s.id).why })).sort((a, b) => b.a - a.a);
        return { spot: sp, score: round1(avg(ps.map(p => p.chance))), cond: round1(avg(ps.map(p => p.cond))), condWhy: tp.condWhy, wave: maxOrNull(ps.map(p => p.wave)), on: avg(ps.map(p => p.on)), topHour: topH.t.slice(11, 16), species };
      });
      const ranked = [...bySpot].sort((a, b) => b.score - a.score);
      const bs = ranked[0];
      return { ...w, score: bs.score, cond: bs.cond, spot: bs.spot, bySpot, ranked, from: wh[0].t.slice(11, 16), to: endTime(wh[wh.length - 1].t), species: bs.species, hours: wh };
    });
    const valid = windows.filter(w => w.score != null);
    if (!valid.length) continue;
    const bestWin = valid.reduce((a, b) => (b.score > a.score ? b : a));
    const sun = sunBy.get(date);
    const dayH = hs.filter(h => h.min >= 360 && h.min <= 1320);
    const summary = {
      windMin: Math.min(...dayH.map(h => h.wind)), windMax: Math.max(...dayH.map(h => h.wind)), gustMax: Math.max(...dayH.map(h => h.gust)),
      dirMorning: circMean(dayH.filter(h => h.min < 720).map(h => h.dir)), dirEvening: circMean(dayH.filter(h => h.min >= 900).map(h => h.dir)),
      waveMax: maxOrNull(dayH.map(h => h.wave)), waveDir: circMean(dayH.map(h => h.waveDir).filter(v => v != null)), period: avg(dayH.map(h => h.period).filter(v => v != null)),
      pStart: hs[9]?.p, pEnd: hs[21]?.p, dp: (hs[21]?.p ?? 0) - (hs[9]?.p ?? 0), rain: hs.reduce((a, h) => a + h.rain, 0), cloud: avg(dayH.map(h => h.cloud)),
      tMin: Math.min(...hs.map(h => h.temp)), tMax: Math.max(...hs.map(h => h.temp)), sst, sstWeek, rain48, turbid: ctx.turbid,
      cur: avg(dayH.map(h => h.cur).filter(v => v != null)), levelMin: maxOrNull(dayH.map(h => h.level == null ? null : -h.level)), levelMax: maxOrNull(dayH.map(h => h.level))
    };
    const safety = [];
    if (summary.gustMax > 25) safety.push(`Hamle ${Math.round(summary.gustMax)} knot'a çıkıyor. Kayalık uçlara ve burna çıkma.`);
    if (summary.waveMax != null && summary.waveMax > 1.2) safety.push(`Açıkta dalga ${fmt(summary.waveMax)} m. Islak kaya kaygan, dalga ayağını alır.`);
    if (hs.some(h => h.rain > 5)) safety.push('Kuvvetli sağanak var. Gök gürültüsünde karbon kamışı topla, kıyıdan uzaklaş.');
    days.push({ date, sun: { rise: sun.rise.slice(11), set: sun.set.slice(11), riseMin: minutesOf(sun.rise), setMin: minutesOf(sun.set) },
      moon: moon(new Date(date + 'T22:00:00+03:00')), score: bestWin.score, cond: bestWin.cond, windows, bestWin, summary, safety, hours: scored, ctx });
  }
  return days;
}
function endTime(t) { const [h, m] = t.slice(11, 16).split(':').map(Number); return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

export function shelteredEdge(sp, dir) {
  if (dir == null) return '';
  if (dir > 200 && dir < 340) return sp.edges.w;
  if (dir > 20 && dir < 160) return sp.edges.e;
  return '';
}

// Av defterinden düzeltme. trips: [{win, spot, pred (0–10), fish (0 boş, 1 az, 2 çok)}]
// Mantık: modelin beklediği başarı (pred/10) ile gerçekleşen başarıyı karşılaştır, farkı puana yansıt. Az veriyle büzülür.
export function calibrate(trips) {
  const t = (trips || []).filter(x => x.pred != null);
  const one = arr => {
    const n = arr.length; if (!n) return 0;
    const hit = arr.reduce((a, x) => a + (x.fish > 0 ? 1 : 0), 0) / n, exp = arr.reduce((a, x) => a + x.pred / 10, 0) / n;
    return clamp((hit - exp) * 6 * (n / (n + 3)), -3, 2);
  };
  const global = one(t), win = {}, spot = {};
  for (const w of WINDOWS) { const a = t.filter(x => x.win === w.id); if (a.length >= 3) win[w.id] = clamp(one(a) - global, -1.5, 1.5); }
  for (const s of SPOTS) { const a = t.filter(x => x.spot === s.id); if (a.length >= 3) spot[s.id] = clamp(one(a) - global, -1.5, 1.5); }
  return { global: Math.round(global * 10) / 10, win, spot, n: t.length };
}
