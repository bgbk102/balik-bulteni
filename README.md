# Balık Bülteni

Bodrum yarımadasının güneybatısında (Bağla – Ilgınlar, Karaincir, Akyarlar, Aspat) kıyıdan LRF için av tahmini. Telefona "Ana ekrana ekle" ile kurulan bir web uygulamasıdır.

## Nasıl çalışır

- Uygulama her açılışta [Open-Meteo](https://open-meteo.com)'dan son 31 gün ve önümüzdeki 7 gün için saatlik rüzgâr, hamle, basınç, yağış, bulut, dalga (yükseklik, yön, periyot), deniz suyu sıcaklığı ve akıntı verisini çeker.
- `js/engine.js` iki ayrı puan hesaplar:
  - **Koşul (0–10):** o saatte o noktada rahat ve güvenli atış yapılabilir mi.
  - **Av şansı (0–10):** sahteye gelecek bir tür o saatte o noktada aktif mi.
- Av defteri telefonda (`localStorage`) tutulur. Her kayıt, modelin o gün için verdiği puanla karşılaştırılır ve puanlar buna göre kaydırılır.
- Çevrimdışıyken son kayıtlı tahmin gösterilir.

## Puanlama

### Koşul

| Etken | Kural |
|---|---|
| Karşıdan rüzgâr | 6 kn üstü −1, 10 üstü −3, 14 üstü −5, 18 üstü −7 |
| Yandan rüzgâr | 10 kn üstü −1,5, 14 üstü −3, 18 üstü −5 |
| Arkadan rüzgâr | 18 kn üstü −3 |
| Hamle | 25 kn üstü −3 |
| Kıyıdaki dalga | 0,6 m üstü −1,5, 0,9 üstü −4, 1,2 üstü −7 |
| Yağış | 0,5 mm/sa üstü −1, 3 üstü −3 |

Kıyıdaki dalga = açık deniz dalgası × (0,25 + 0,85 × kıyının dalga yönüne açıklığı).

### Av şansı

Her tür için aktiflik = mevsim (ay) × ışık evresi (tan, sabah, öğle, ikindi, gün batımı, gece) × su sıcaklığı ve deniz durumu çarpanları × noktanın uygunluğu × sahteyle tutulabilirlik. Tür profilleri `SPECIES` listesindedir.

Türler bağımsız küçük ihtimaller olarak birleştirilir: `şans = 10 × (1 − Π(1 − 0,3 × aktiflik))`. Koşul 6'nın altındaysa şans orantılı kırpılır.

Basınç yalnızca avcı türlerde, 12 saatte 3 hPa'dan fazla düşüşte %10 artı verir. Ay evresi yalnızca ışıksız noktada parlak gecede %10 eksi verir. İkisinin de kanıtı zayıftır.

### Defter düzeltmesi

`düzeltme = (gerçekleşen balıklı av oranı − modelin beklediği oran) × 6 × n / (n + 3)`, −3 ile +2 arasında. En az üç kaydı olan dilim ve noktalar için ayrıca ek düzeltme hesaplanır.

## Noktalar

Dördü de güneye bakar. Koordinatlar, kıyı yönleri ve habitat değerleri (kaya, kum, ışık, burun) `SPOTS` listesindedir ve yaklaşıktır.

## Yerelde çalıştırma

```sh
python3 -m http.server 8000
```

Sonra tarayıcıda `http://localhost:8000` adresini aç.
