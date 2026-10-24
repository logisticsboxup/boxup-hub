// Makes latest.json for the update feed from the ui/ folder.
// Run after changing anything in ui/:   node scripts/make-update.js
// Then commit and push this repo; every Logistics Hub sees the update.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), ui = path.join(root, 'ui');
const ver = JSON.parse(fs.readFileSync(path.join(ui, 'version.json'), 'utf8')).version;
const notesFile = path.join(root, 'release-notes.json');
const notes = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : [];
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files.push({ path: path.relative(ui, p).split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') });
  }
})(ui);
const out = { version: ver, date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), notes, files };
fs.writeFileSync(path.join(root, 'latest.json'), JSON.stringify(out, null, 2));
console.log('latest.json written for version', ver, 'with', files.length, 'files');
