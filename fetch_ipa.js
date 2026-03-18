const fs    = require('fs');
const https = require('https');
const path  = require('path');

const DATA_FILE = path.resolve(process.argv[2] || 'words.json');
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
        // bos string'leri atla, US > UK > herhangi biri
        const notEmpty = phonetics.filter(p => p.audio && p.audio.trim() !== '');
        const us  = notEmpty.find(p => p.audio.includes('-us.'));
        const uk  = notEmpty.find(p => p.audio.includes('-uk.'));
        const any = notEmpty[0];
        audioURL = (us || uk || any)?.audio || null;
      }
      if (ipa && audioURL) break;
    }
  }

  if (!ipa) ipa = await fetchWiktionary(word);

  return { ipa, audioURL };
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
    const hasIPA   = w.ipa && w.ipa !== '';
    const hasAudio = w.audioURL && w.audioURL !== '';
    if (hasIPA && hasAudio) continue;

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
