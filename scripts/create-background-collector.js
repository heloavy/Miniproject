// scripts/create-background-collector.js
const fs = require('fs');
const path = require('path');

const content = `// This file is auto-generated
require('ts-node').register({
  project: 'tsconfig.scripts.json'
});
require('./background-collector.ts');
`;

fs.writeFileSync(
  path.join(__dirname, 'background-collector.js'),
  content,
  'utf8'
);

console.log('✅ Created background-collector.js');