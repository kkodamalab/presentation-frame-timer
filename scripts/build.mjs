import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for (const f of ['index.html','style.css','app.js','core.js','gauge.js','web-overlay.js','web-overlay.css','pip-geometry.js','audio-engine.js']) await copyFile(f,`dist/${f}`);

await cp('audio','dist/audio',{recursive:true});
