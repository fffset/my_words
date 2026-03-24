// Kullanım:
//   node fetch_ipa.js                        → kelimeler.json
//   node fetch_ipa.js oxford_3000_new.json   → belirtilen dosya

const fs    = require('fs');
const https = require('https');
const path  = require('path');

const DATA_FILE = path.resolve(process.argv[2] || 'tech_words.json');
const DELAY_MS  = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchDictAPI(word) {
  return new Promise((resolve) => {
    function doGet(url, hops) {
      if (hops > 5) return resolve(null);
      try {
        const u = new URL(url);
        https.get({
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: { 'User-Agent': 'kelime-kartlari/1.0' }
        }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return doGet(res.headers.location, hops + 1);
          }
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch(e) { resolve(null); }
          });
        }).on('error', () => resolve(null));
      } catch(e) { resolve(null); }
    }
    doGet('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), 0);
  });
}

function fetchWiktionary(word) {
  return new Promise((resolve) => {
    https.get({
      hostname: 'en.wiktionary.org',
      path: '/w/api.php?action=parse&page=' + encodeURIComponent(word) + '&prop=wikitext&format=json',
      headers: { 'User-Agent': 'kelime-kartlari/1.0' }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const wikitext = JSON.parse(body)?.parse?.wikitext?.['*'] || '';
          const m = wikitext.match(/IPA[^/]*\/([^/}|]+)\//);
          resolve(m ? '/' + m[1] + '/' : null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function lookupWord(word) {
  const data = await fetchDictAPI(word);
  let ipa = null;
  let audioURL = null;
  const synSet = new Set();

  if (Array.isArray(data)) {
    for (const entry of data) {
      if (!ipa && entry.phonetic && entry.phonetic.trim()) {
        ipa = entry.phonetic.trim();
      }
      if (!ipa) {
        for (const p of (entry.phonetics || [])) {
          if (p.text && p.text.trim()) { ipa = p.text.trim(); break; }
        }
      }
      if (!audioURL) {
        const phonetics = entry.phonetics || [];
        const notEmpty = phonetics.filter(p => p.audio && p.audio.trim() !== '');
        const us  = notEmpty.find(p => p.audio.includes('-us.'));
        const uk  = notEmpty.find(p => p.audio.includes('-uk.'));
        const any = notEmpty[0];
        audioURL = (us || uk || any)?.audio || null;
      }
      for (const m of (entry.meanings || [])) {
        (m.synonyms || []).forEach(s => synSet.add(s));
        for (const d of (m.definitions || [])) {
          (d.synonyms || []).forEach(s => synSet.add(s));
        }
      }
    }
  }

  if (!ipa) ipa = await fetchWiktionary(word);
  const synonyms = [...synSet].slice(0, 8);

  // definitions: her pos için ilk tanım + örnek, max 3
  const defMap = {};
  const exMap  = {};
  if (Array.isArray(data)) {
    for (const entry of data) {
      for (const m of (entry.meanings || [])) {
        const pos = m.partOfSpeech;
        for (const d of (m.definitions || [])) {
          if (!defMap[pos]) defMap[pos] = d.definition;
          if (!exMap[pos] && d.example) exMap[pos] = d.example;
        }
      }
    }
  }
  const definitions = Object.entries(defMap).slice(0, 3).map(([pos, def]) => ({ pos, def, example: exMap[pos] || null }));

  return { ipa, audioURL, synonyms, definitions };
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('Dosya bulunamadi: ' + DATA_FILE);
    process.exit(1);
  }

  const words = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const todo  = words.filter(w => !w.ipa || w.ipa === '' || !w.audioURL || w.audioURL === '');

  console.log('Dosya  : ' + DATA_FILE);
  console.log('Toplam : ' + words.length + ' kelime');
  console.log('Islenecek: ' + todo.length);
  console.log('Tahmini sure: ~' + Math.ceil(todo.length * DELAY_MS / 1000) + ' saniye\n');

  let doneIPA = 0, doneAudio = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const hasIPA        = w.ipa && w.ipa !== '';
    const hasAudio      = w.audioURL && w.audioURL !== '';
    const hasSynonyms   = w.synonyms && w.synonyms.length > 0;
    const hasDefinitions = w.definitions && w.definitions.length > 0;
    if (hasIPA && hasAudio && hasSynonyms && hasDefinitions) continue;

    process.stdout.write('[' + (i+1) + '/' + words.length + '] ' + w.text.padEnd(30) + ' ');

    const result = await lookupWord(w.text);
    let line = '';

    if (!hasIPA) {
      if (result.ipa) { w.ipa = result.ipa; doneIPA++; line += result.ipa; }
      else            { line += '(ipa yok)'; }
    } else {
      line += w.ipa;
    }

    line += '  ';

    if (!hasAudio) {
      if (result.audioURL) { w.audioURL = result.audioURL; doneAudio++; line += '[ses OK]'; }
      else                 { line += '(ses yok)'; }
    } else {
      line += '[ses var]';
    }

    if (!hasSynonyms && result.synonyms && result.synonyms.length) {
      w.synonyms = result.synonyms;
      line += '  [' + result.synonyms.length + ' syn]';
    }

    if (!w.definitions || !w.definitions.length) {
      if (result.definitions && result.definitions.length) {
        w.definitions = result.definitions;
        line += '  [' + result.definitions.length + ' def]';
      }
    }

    console.log(line);

    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), 'utf8');
      console.log('\n  -> ' + (i+1) + '. kelimede ara kayit.\n');
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), 'utf8');
  console.log('\nTamamlandi!');
  console.log('IPA eklendi : ' + doneIPA);
  console.log('Ses eklendi : ' + doneAudio);
  console.log(DATA_FILE + ' guncellendi.');
}

main().catch(console.error);
