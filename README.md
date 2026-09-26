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
4. Aşağıdaki arka plan bildirim kurulumunu tamamlayıp projeyi yeniden deploy edin.
5. Yayınlanan adresi her cihazda açıp **Alarmları etkinleştir** düğmesine basın. Her tarayıcı için ayrı izin gerekir.

## Arka plan alarmı kurulumu

Push alarmının sayfa kapalıyken gönderilmesi için Vercel sunucusu, Redis ve QStash gerekir:

1. Upstash’te bir Redis veritabanı açıp REST URL ve token’ını alın.
2. Upstash QStash token’ı oluşturun. Dakikalık tarama, Vercel Hobby Cron sınırına takılmadan QStash üzerinden çalışır.
3. `npx web-push generate-vapid-keys` komutuyla VAPID anahtarlarını üretin.
4. Vercel projesinin **Settings → Environment Variables** bölümüne `.env.example` içindeki değerleri ekleyin. `CRON_SECRET` için rastgele, uzun bir değer kullanın. `VAPID_SUBJECT` değerini kendi e-posta adresinizle değiştirin.
5. Projeyi yeniden deploy edin ve yayınlanan HTTPS adresinde **Alarmları etkinleştir** düğmesine basın. İlk başarılı etkinleştirmede dakikalık QStash zamanlaması otomatik kurulur.

`Alarmları etkinleştir` düğmesi “Arka plan alarmları açık” yazana kadar sunucu kurulumu bitmemiştir; ekrandaki hata mesajı eksik ayarı belirtir.

## Bildirim sınırları

- Web Push, service worker’ı sayfa açık değilken de uyandırıp sistem bildirimi gösterebilir. Bildirim sesi ve titreşim, tarayıcı/işletim sistemi ayarlarına bağlıdır; web sayfası arka planda özel, sürekli çalan sesi zorlayamaz.
- Cihaz kapalıysa, internetsizse, tarayıcı bildirimleri engellenmişse veya işletim sistemi uygulamayı kısıtlıyorsa zamanında teslim garanti edilemez. Cihazdaki “Rahatsız Etmeyin” ve pil tasarrufu ayarları da bildirimi susturabilir.
- QStash zamanlaması dakikalık kontrol yapar; push iletimi yine ağ ve sağlayıcı gecikmesine bağlıdır. Dakikada yaklaşık 1.440 zamanlayıcı isteği oluşur; QStash Free günlük 1.000 mesaj sınırının üstüne çıktığı için düzenli kullanımda Pay as You Go planı gerekebilir.
- Her cihaz kendi push aboneliğini ve işaretleme verisini kullanır. Cihazlar arasında aynı işaretlemeleri paylaşmak için ayrıca kullanıcı hesabı ve ortak veri eşitlemesi gerekir.
