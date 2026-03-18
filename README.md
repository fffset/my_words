# Kelime Kartları

İngilizce kelime ezberlemek için tarayıcı tabanlı flash card uygulaması. Oxford 3000 kelime listesini temel alır.

## Özellikler

- **Kart sistemi** — İngilizce tarafına tıklayarak Türkçe çeviriyi gör, tekrar tıklayınca geri dön
- **3 buton** — Doğru / Zor / Yanlış; streak ve tekrar sayısı her kelime için ayrı tutulur
- **Yanlışlar modu** — `wrong > 0` ve `streak < 3` olan kelimeleri ayrı sekmede çalış; 3 üst üste doğru yapınca listeden çıkar
- **Öncelik sıralaması** — Yeni kelimeler (random sırada) → Süresi geçmişler (2 hafta) → Skor tabanlı sıralama `(yanlış×3 + zor×2 - doğru + geçenGün×0.5)`
- **IPA telaffuz** — Kart ön yüzünde gösterilir
- **Ses** — Duolingo veya Dictionary API CDN'inden; yoksa tarayıcı TTS devreye girer
- **Eş anlamlılar** — Kart ön yüzünde küçük ipucu olarak (`≈ option, selection`)
- **Sözlük tanımı + örnek cümle** — Kart arka yüzünde Türkçe çevirinin altında, kelime türüne göre (noun, verb...)
- **Yeni kelime ekleme** — Kelime yazınca IPA, ses ve eş anlamlılar otomatik çekilir; kelime zaten varsa çeviriler birleştirilir, sayaçlar sıfırlanır
- **Açık/koyu tema** — Sistem tercihine göre otomatik

## Kurulum

Node.js gereklidir.

```bash
node server.js
```

Tarayıcıda `http://localhost:3000` adresini aç.

## Veri Çekme Araçları

### IPA + Ses + Eş Anlamlılar

```bash
node fetch_ipa.js
# veya farklı bir dosya için:
node fetch_ipa.js oxford_3000_new.json
```

Her kelime için IPA, ses URL'si ve eş anlamlıları çeker. IPA yoksa Wiktionary'ye fallback yapar. Her kelimede 600ms bekler, her 50 kelimede ara kayıt yapar.

### Sözlük Tanımı + Örnek Cümle + Eş Anlamlılar

```bash
node fetch_definitions.js words.json
```

`definitions` veya `synonyms` eksik olan kelimeleri tamamlar. Her kelime türü (noun, verb...) için ilk tanım ve varsa örnek cümleyi çeker. Her kelimede 500ms bekler, her 100 kelimede ara kayıt yapar.

Her iki araç da yarıda kalsa kaldığı yerden devam eder.

## Oxford 3000 Listesi

PDF'den parse edilen 2336 kelimeyi Türkçe çevirisiyle `oxford_3000_new.json` olarak eklemek için:

```bash
# Mevcut words.json ile birleştir (duplicate olmaz)
node -e "
const fs = require('fs');
const a = JSON.parse(fs.readFileSync('words.json'));
const b = JSON.parse(fs.readFileSync('oxford_3000_new.json'));
const existing = new Set(a.map(w => w.text.toLowerCase()));
const newOnly = b.filter(w => !existing.has(w.text.toLowerCase()));
fs.writeFileSync('words.json', JSON.stringify([...a, ...newOnly], null, 2));
console.log('Eklenen:', newOnly.length, '| Toplam:', a.length + newOnly.length);
"
```

## JSON Veri Yapısı

```json
{
  "text": "choice",
  "translations": ["seçim", "tercih"],
  "audioURL": "https://...",
  "ipa": "/tʃɔɪs/",
  "synonyms": ["option", "selection", "pick"],
  "definitions": [
    {
      "pos": "noun",
      "def": "An option; a decision to choose something.",
      "example": "it's your choice"
    }
  ],
  "isNew": true,
  "correct": 0,
  "wrong": 0,
  "hard": 0,
  "streak": 0,
  "lastSeen": null
}
```

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `index.html` | Uygulama arayüzü |
| `server.js` | Yerel HTTP sunucusu (port 3000) |
| `fetch_ipa.js` | IPA, ses ve eş anlamlı çekme aracı |
| `fetch_definitions.js` | Sözlük tanımı ve örnek cümle çekme aracı |
| `words.json` | Kelime listesi ve ilerleme verisi |
| `oxford_3000_new.json` | Oxford 3000 listesi (Türkçe çevirili, IPA/ses eksik) |

## Ses Kaynakları

Yeni kelime eklerken ses otomatik çekilir. Manuel eklemek istersen:
- **Forvo.com** — Gerçek telaffuzlar, linki kopyala
- **Google TTS** — `https://translate.google.com/translate_tts?ie=UTF-8&q=KELIME&tl=en&client=tw-ob`
