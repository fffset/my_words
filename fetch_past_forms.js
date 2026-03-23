// node fetch_past_forms.js words.json
// Fiil olan kelimelere past form ekler

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(process.argv[2] || 'words.json');

const IRREGULAR = {"arise":"arose","awake":"awoke","be":"was/were","bear":"bore","beat":"beat","become":"became","begin":"began","bend":"bent","bet":"bet","bind":"bound","bite":"bit","bleed":"bled","blow":"blew","break":"broke","breed":"bred","bring":"brought","broadcast":"broadcast","build":"built","burn":"burned/burnt","buy":"bought","catch":"caught","choose":"chose","come":"came","cost":"cost","cut":"cut","deal":"dealt","dig":"dug","do":"did","draw":"drew","dream":"dreamed/dreamt","drink":"drank","drive":"drove","eat":"ate","fall":"fell","feed":"fed","feel":"felt","fight":"fought","find":"found","flee":"fled","fly":"flew","forget":"forgot","forgive":"forgave","freeze":"froze","get":"got","give":"gave","go":"went","grow":"grew","hang":"hung","have":"had","hear":"heard","hide":"hid","hit":"hit","hold":"held","hurt":"hurt","keep":"kept","know":"knew","lay":"laid","lead":"led","leave":"left","lend":"lent","let":"let","lie":"lay","lose":"lost","make":"made","mean":"meant","meet":"met","pay":"paid","put":"put","read":"read","ride":"rode","ring":"rang","rise":"rose","run":"ran","say":"said","see":"saw","seek":"sought","sell":"sold","send":"sent","set":"set","shake":"shook","shine":"shone","shoot":"shot","show":"showed","shut":"shut","sing":"sang","sink":"sank","sit":"sat","sleep":"slept","slide":"slid","speak":"spoke","spend":"spent","spread":"spread","stand":"stood","steal":"stole","stick":"stuck","strike":"struck","swear":"swore","swim":"swam","take":"took","teach":"taught","tear":"tore","tell":"told","think":"thought","throw":"threw","understand":"understood","wake":"woke","wear":"wore","win":"won","write":"wrote","learn":"learned/learnt","smell":"smelled/smelt","spell":"spelled/spelt"};

function getPastForm(word) {
  const w = word.toLowerCase().trim().split(' ')[0]; // ilk kelimeyi al
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (IRREGULAR[word.toLowerCase().trim()]) return IRREGULAR[word.toLowerCase().trim()];
  // Düzenli kural
  if (w.endsWith('e')) return w + 'd';
  if (w.match(/[^aeiou]y$/)) return w.slice(0,-1) + 'ied';
  if (w.match(/[^aeiou][aeiou][^aeioulwxy]$/) && w.length <= 7) return w + w.slice(-1) + 'ed';
  return w + 'ed';
}

function isVerb(w) {
  if (!w.definitions || !w.definitions.length) return false;
  return w.definitions.some(d => d.pos === 'verb');
}

const words = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const verbs = words.filter(w => isVerb(w) && !w.pastForm);

console.log(`Toplam: ${words.length} | Fiil (past form eksik): ${verbs.length}\n`);

let added = 0;
for (const w of verbs) {
  const past = getPastForm(w.text);
  w.pastForm = past;
  added++;
  console.log(`${w.text.padEnd(25)} → ${past}`);
}

fs.writeFileSync(DATA_FILE, JSON.stringify(words, null, 2), 'utf8');
console.log(`\nTamamlandı! ${added} kelimeye past form eklendi.`);
