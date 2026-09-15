// Zero-dependency check: every lesson's words must only use letters/keys
// taught by that lesson or an earlier one. Run with: node test/curriculum.test.js
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'words.js'), 'utf8') + '\nmodule.exports = { LESSONS };';
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const { LESSONS } = mod.exports;

const allowed = new Set([' ']);
let failures = 0;

LESSONS.forEach(lesson => {
  lesson.newKeys.forEach(k => { if (k.length === 1) allowed.add(k.toLowerCase()); });
  lesson.words.forEach(word => {
    for (const ch of word.toLowerCase()) {
      if (/[a-z]/.test(ch) && !allowed.has(ch)) {
        console.error(`FAIL: lesson ${lesson.id} ("${lesson.title}") word "${word}" uses untaught letter "${ch}"`);
        failures++;
      }
    }
  });
});

if (failures === 0) {
  console.log(`PASS: all ${LESSONS.length} lessons use only letters taught by that point.`);
  process.exit(0);
} else {
  console.error(`${failures} violation(s) found.`);
  process.exit(1);
}
