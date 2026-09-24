# Damla Alarmı

Reçetedeki 24 Eylül–21 Ekim 2026 damla saatleri için hazırlanmış Next.js PWA.
Saatler Türkiye saatiyle (GMT+3) çalışır ve `24:00` kaydı ertesi günün `00:00` saati olarak yorumlanır.

## Yerelde çalıştırma

```bash
npm install
npm run dev
```

## Vercel’e yayınlama

1. Projeyi kendi GitHub deponuza gönderin.
2. [Vercel](https://vercel.com/new) üzerinde depoyu içe aktarın.
3. Framework ayarını değiştirmeden **Deploy** seçin. Vercel `npm run build` komutunu otomatik çalıştırır.
4. Yayınlanan adresi her bilgisayarda açın ve **Alarmları etkinleştir** düğmesine basın.

## Alarm sınırı

- PWA açıkken ya da arka plan sekmesindeyken sesli uyarı ve tarayıcı bildirimi verir.
- Tarayıcı tamamen kapalıysa veya cihaz uyku modundaysa bir web uygulaması sesli alarmı garanti edemez. Kritik dozlar için cihazın yerleşik alarmı da kullanılmalıdır.
- Tamamlama işaretleri tarayıcıda yerel olarak saklanır; programın kendisi ise yayınlandığı aynı URL’den tüm cihazlarda kullanılabilir.
