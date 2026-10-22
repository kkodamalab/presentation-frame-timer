import {extractFile} from '@electron/asar';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const archive=process.argv[2]||'release/win-unpacked/resources/app.asar';
const files=['time-display.js','electron/window-geometry.cjs','electron/preload.cjs','electron/control.css','audio-engine.js','frame-geometry.js','gauge.js','electron/control.html','electron/control.js','electron/state.cjs','electron/main.cjs','electron/audio.js','electron/overlay.js','electron/overlay.css'];const rows=[];
for(const file of files){const packaged=extractFile(archive,file),source=await readFile(file),sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(packaged),sha(source),`packaged ${file} equals current source`);rows.push({file,sha256:sha(packaged)});}
assert.equal(JSON.parse(extractFile(archive,'package.json')).version,'1.3.1');const html=extractFile(archive,'electron/control.html').toString();for(const id of ['soundDuration','blinkDuration','fontSize','timeColor','position','timeOpacity','timeMargin','time-preview'])assert.ok(html.includes(`id="${id}"`));
await mkdir('test-results',{recursive:true});await writeFile('test-results/desktop-package-manifest.json',JSON.stringify({version:'1.3.1',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),archive,files:rows},null,2));await writeFile('release/PACKAGE-MANIFEST.json',await readFile('test-results/desktop-package-manifest.json'));console.log('Packaged v1.3.1 source hashes verified:',rows.length,'files');
