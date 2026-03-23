const https = require('https');

function fetch(word) {
  return new Promise(resolve => {
    https.get({
      hostname: 'api.dictionaryapi.dev',
      path: '/api/v2/entries/en/' + encodeURIComponent(word),
      headers: { 'User-Agent': 'test/1.0' }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  for (const word of ['go', 'steal', 'run', 'make']) {
    const data = await fetch(word);
    if (!data || !Array.isArray(data)) { console.log(word, '-> null'); continue; }
    const entry = data[0];
    console.log(`\n=== ${word} ===`);
    console.log('keys:', Object.keys(entry));
    // meanings içinde inflections var mı?
    for (const m of (entry.meanings || [])) {
      if (m.partOfSpeech === 'verb') {
        console.log('verb definitions[0]:', m.definitions?.[0]?.definition?.slice(0,60));
        console.log('synonyms:', m.synonyms?.slice(0,3));
        // tüm keylere bak
        console.log('meaning keys:', Object.keys(m));
      }
    }
  }
}
main();
