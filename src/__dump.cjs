const fs = require('fs');
const src = process.argv[2];
const dst = process.argv[3];
fs.writeFileSync(dst, fs.readFileSync(src, 'utf8'), 'utf8');
process.stdout.write('OK ' + dst + '\n');
