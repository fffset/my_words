// node fetch_definitions.js tech_words.json
// Sadece definitions ve synonyms eksik olan kelimeleri çeker

const fs    = require('fs');
const https = require('https');
const path  = require('path');

const DATA_FILE = path.resolve(process.argv[2] || 'tech_words.json');
const DELAY_MS  = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchDictAPI(word) {
  return new Promise((resolve) => {
    function doGet(url, hops) {
      if (hops > 3) return resolve(null);
      try {
        const u = new URL(url);
        https.get({
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: { 'User-Agent': 'kelime-kartlari/1.0' }
        }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) return doGet(res.headers.location, hops+1);
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
        }).on('error', () => resolve(null));
      } catch(e) { resolve(null); }
    }
    doGet('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), 0);
  });
}

function extractFromData(data) {
  const synSet = new Set();
  const defMap = {};
  const exMap  = {};

  if (!Array.isArray(data)) return { synonyms: [], definitions: [] };

  for (const entry of data) {
    for (const m of (entry.meanings || [])) {
      const pos = m.partOfSpeech;
      for (const d of (m.definitions || [])) {
        if (!defMap[pos]) defMap[pos] = d.definition;
        if (!exMap[pos] && d.example) exMap[pos] = d.example;
        (d.synonyms || []).forEach(s => synSet.add(s));
      }
      (m.synonyms || []).forEach(s => synSet.add(s));
    }
  }

  return {
    synonyms:    [...synSet].slice(0, 8),
    definitions: Object.entries(defMap).slice(0, 3).map(([pos, def]) => ({
      pos,
      def,
      example: exMap[pos] || null
    }))
  };
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) { console.error('Dosya bulunamadi: ' + DATA_FILE); process.exit(1); }

  const words = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const todo  = words.filter(w =>
    (!w.definitions || w.definitions.length === 0) ||
    (!w.synonyms    || w.synonyms.length === 0)    ||
    (w.definitions  && w.definitions.some(d => !d.example))
  );

  console.log('Toplam  : ' + words.length);
  console.log('Eksik   : ' + todo.length + ' kelime');
  console.log('Tahmini : ~' + Math.ceil(todo.length * DELAY_MS / 1000) + ' saniye\n');

  let doneDef = 0, doneSyn = 0, notFound = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const needDef = !w.definitions || w.definitions.length === 0 ||
                    w.definitions.some(d => !d.example);
    const needSyn = !w.synonyms || w.synonyms.length === 0;
    if (!needDef && !needSyn) continue;

    process.stdout.write('[' + (i+1) + '/' + words.length + '] ' + w.text.padEnd(30) + ' ');

    const data   = await fetchDictAPI(w.text);
    const result = extractFromData(data);

    let line = '';
    if (needDef) {
      if (result.definitions.length) {
        if (!w.definitions || w.definitions.length === 0) {
          w.definitions = result.definitions;
          doneDef++;
          line += '[' + result.definitions.length + ' def]';
        } else {
          // Sadece example eksik olanları doldur
          let exAdded = 0;
          for (const existing of w.definitions) {
            if (!existing.example) {
              const match = result.definitions.find(d => d.pos === existing.pos);
              if (match && match.example) { existing.example = match.example; exAdded++; }
            }
          }
          if (exAdded) { doneDef++; line += '[' + exAdded + ' ex eklendi]'; }
          else { line += '(ex yok)'; }
        }
      } else { line += '(def yok)'; notFound++; }
    }
    if (needSyn) {
      if (result.synonyms.length) { w.synonyms = result.synonyms; doneSyn++; line += ' [' + result.synonyms.length + ' syn]'; }
      else { line += ' (syn yok)'; }
    }

    console.log(line);

    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), 'utf8');
      console.log('\n  -> ' + (i+1) + '. kelimede ara kayit.\n');
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), 'utf8');
  console.log('\nTamamlandi!');
  console.log('Tanim eklendi : ' + doneDef);
  console.log('Esanl. eklendi: ' + doneSyn);
  console.log('Bulunamadi    : ' + notFound);
}

main().catch(console.error);
