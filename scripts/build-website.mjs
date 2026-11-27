import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const docsDir = path.join(root, 'docs');
fs.mkdirSync(docsDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'website', 'src', 'main.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: path.join(docsDir, 'app.js'),
});

fs.copyFileSync(path.join(root, 'website', 'index.html'), path.join(docsDir, 'index.html'));
if (fs.existsSync(path.join(root, 'assets', 'icon.png'))) {
  fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(docsDir, 'icon.png'));
}

console.log('Built website cleanly into docs/ (index.html, app.js, icon.png)');
