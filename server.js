const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'tech_words.json');
const HTML_FILE = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  // GET /words — tüm kelimeleri döndür
  if (req.method === 'GET' && req.url === '/words') {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /words — tüm listeyi kaydet
  if (req.method === 'POST' && req.url === '/words') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET / — index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(404); res.end('index.html bulunamadı');
    }
    return;
  }

  // GET /ipa?word=apple — kelime için IPA çek ve json'a kaydet
  if (req.method === 'GET' && req.url.startsWith('/ipa')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const word = urlObj.searchParams.get('word');
    if (!word) { res.writeHead(400); res.end(JSON.stringify({ error: 'word gerekli' })); return; }

    function saveAndSend(ipa, audioURL, synonyms, definitions) {
      try {
        const words = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const found = words.find(w => w.text.toLowerCase() === word.toLowerCase());
        if (found) {
          if (ipa && !found.ipa)                   found.ipa         = ipa;
          if (audioURL && !found.audioURL)         found.audioURL    = audioURL;
          if (synonyms && synonyms.length && !found.synonyms)     found.synonyms    = synonyms;
          if (definitions && definitions.length && !found.definitions) found.definitions = definitions;
          fs.writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), 'utf8');
        }
      } catch(e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ipa, audioURL, synonyms: synonyms || [], definitions: definitions || [] }));
    }

    function fetchFromWiktionary(audioURL, synonyms, definitions) {
      const wPath = `/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json`;
      https.get({
        hostname: 'en.wiktionary.org',
        path: wPath,
        headers: { 'User-Agent': 'kelime-kartlari/1.0' }
      }, (wRes) => {
        let wb = '';
        wRes.on('data', c => wb += c);
        wRes.on('end', () => {
          try {
            const wj = JSON.parse(wb);
            const wikitext = wj?.parse?.wikitext?.['*'] || '';
            const match = wikitext.match(/IPA[^/]*\/([^/}|]+)\//);
            const ipa = match ? '/' + match[1] + '/' : null;
            saveAndSend(ipa, audioURL, synonyms, definitions);
          } catch(e) { saveAndSend(null, audioURL, synonyms, definitions); }
        });
      }).on('error', () => saveAndSend(null, audioURL, synonyms, definitions));
    }

    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    https.get(apiUrl, (apiRes) => {
      let body = '';
      apiRes.on('data', chunk => body += chunk);
      apiRes.on('end', () => {
        try {
          const data = JSON.parse(body);
          let ipa = null, audioURL = null;
          const synSet = new Set();
          for (const entry of data) {
            if (!ipa && entry.phonetic && entry.phonetic.trim()) ipa = entry.phonetic.trim();
            if (!ipa) {
              for (const p of (entry.phonetics || [])) {
                if (p.text && p.text.trim()) { ipa = p.text.trim(); break; }
              }
            }
            if (!audioURL) {
              const ph = entry.phonetics || [];
              const us  = ph.find(p => p.audio && p.audio.trim() && p.audio.includes('-us.'));
              const any = ph.find(p => p.audio && p.audio.trim());
              audioURL = (us || any)?.audio || null;
            }
            for (const m of (entry.meanings || [])) {
              for (const d of (m.definitions || [])) {
                (d.synonyms || []).forEach(s => synSet.add(s));
              }
              (m.synonyms || []).forEach(s => synSet.add(s));
            }
          }
          const synonyms = [...synSet].slice(0, 8);

          // definitions: her pos için ilk tanım + örnek cümle, max 3
          const defMap = {};
          const exMap  = {};
          for (const entry of data) {
            for (const m of (entry.meanings || [])) {
              const pos = m.partOfSpeech;
              for (const d of (m.definitions || [])) {
                if (!defMap[pos]) defMap[pos] = d.definition;
                if (!exMap[pos] && d.example) exMap[pos] = d.example;
              }
            }
          }
          const definitions = Object.entries(defMap).slice(0, 3).map(([pos, def]) => ({ pos, def, example: exMap[pos] || null }));

          if (ipa) { saveAndSend(ipa, audioURL, synonyms, definitions); } else { fetchFromWiktionary(audioURL, synonyms, definitions); }
        } catch(e) { fetchFromWiktionary(null, [], []); }
      });
    }).on('error', () => fetchFromWiktionary(null, [], []));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n✅ Kelime kartları çalışıyor!`);
  console.log(`👉 Tarayıcıda aç: http://localhost:${PORT}`);
  console.log(`📁 Veriler buraya kaydediliyor: ${DATA_FILE}`);
  console.log(`\nDurdurmak için: Ctrl+C\n`);
});
