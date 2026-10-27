# Balık Bülteni

Bodrum yarımadasının güneybatısında (Bağla – Ilgınlar, Karaincir, Akyarlar, Aspat) kıyıdan LRF için 7 günlük balık tahmini. Telefona "Ana ekrana ekle" ile kurulan bir web uygulamasıdır.

## Nasıl çalışır

- Uygulama her açılışta [Open-Meteo](https://open-meteo.com)'dan saatlik rüzgâr, hamle, basınç, yağış, bulut, sıcaklık ve dalga / deniz suyu tahminini çeker.
- `js/engine.js` her saat ve her nokta için 1–10 puan hesaplar; puanlar sabah, öğlen, akşam ve gece dilimlerine ve günlere toplanır.
- `data/insights.json` Claude'un her sabah yazdığı notları (MGM uyarıları, gün yorumları, haftalık özet) ve av defterini tutar.
- Çevrimdışıyken son kayıtlı tahmin gösterilir.

## Puanlama

| Etken | Kural |
|---|---|
| Rüzgâr | 4–12 kn +1; karadan (arkadan) esiyorsa +0,5. 13–18 kn denizden −1. 18 kn üstü ya da 25 kn hamle −2,5 |
| Dalga (kıyıda) | ≤0,5 m +1; 0,8–1 m −1; 1 m üstü −2,5. Kıyı dalgası açık deniz dalgasından rüzgârın kıyıya göre yönüyle hesaplanır |
| Basınç (12 saat) | ≤ −2 hPa +1,5; hafif düşüş +1; ≥ +3 hPa −1,5; 1010–1020 +0,5; 1025 üstü −1 |
| Işık | Sabah ve akşam +1,5. Öğlen bulutlu +0,5, güneşli −0,5. Kuvvetli yağış −1 |
| Gece | Ay %80 üstü −0,5, %20 altı +0,5 |
| Su | 13 °C altı −1; 3 günde 2 °C'den fazla soğuma −1; son 48 saatte 10 mm üstü yağış +0,3 |

Taban puan 3,5'tir. Gün puanı en iyi dilimin %65'i ile ikinci en iyi dilimin %35'idir.

## Noktalar

Dördü de güneye bakar: kuzeyli rüzgârlar (poyraz, yıldız, karayel) kıyıdan eser ve koyları düzleştirir. Nokta koordinatları ve kıyı yönleri `js/engine.js` içindeki `SPOTS` listesindedir ve yaklaşıktır.

## Yerelde çalıştırma

```sh
python3 -m http.server 8000
```

Sonra tarayıcıda `http://localhost:8000` adresini aç.
