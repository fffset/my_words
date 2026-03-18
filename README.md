# Kelime Kartları

İngilizce kelime ezberlemek için tarayıcı tabanlı flash card uygulaması. Oxford 3000 kelime listesini temel alır; IPA telaffuz gösterimi, ses dosyası, Türkçe çeviri ve tekrar takibi içerir.

## Özellikler

- Kartı çevirerek Türkçe çeviriyi görme
- Doğru / Zor / Yanlış butonlarıyla ilerleme takibi
- Her kelimenin ses dosyasını dinleme
- IPA telaffuz gösterimi
- Yeni / Öğrenilen / Hepsi sekmeleri
- Streak ve tekrar sayısı kaydı
- Açık/koyu tema (sistem tercihine göre otomatik)

## Kurulum

Node.js gereklidir.

```bash
node server.js
```

Ardından tarayıcıda `http://localhost:3000` adresini aç.

## IPA ve Ses Verisi Çekme

`words.json` içindeki kelimelere IPA telaffuzu ve ses URL'si eklemek için:

```bash
node fetch_ipa.js
# veya farklı bir dosya için:
node fetch_ipa.js oxford_3000_new.json
```

Veriler [Free Dictionary API](https://dictionaryapi.dev/) ve Wiktionary'den çekilir. Her kelime arasında 600 ms beklenir, her 50 kelimede bir ara kayıt yapılır.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `index.html` | Uygulama arayüzü |
| `server.js` | Yerel HTTP sunucusu (port 3000) |
| `fetch_ipa.js` | IPA ve ses verisi çekme aracı |
| `words.json` | Kelime listesi ve ilerleme verisi |
