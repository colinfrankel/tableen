const path = require('path');
const fs = require('fs');

const Mocha = require('mocha');

const mocha = new Mocha({
  ui: 'bdd',
  color: true,
});

const testDir = __dirname;

fs.readdirSync(testDir)
  .filter((file) => file.endsWith('.test.js'))
  .forEach((file) => mocha.addFile(path.join(testDir, file)));

mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});
