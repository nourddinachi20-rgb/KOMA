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

const cacheTag = Date.now().toString(36);
const rawHtml = fs.readFileSync(path.join(root, 'website', 'index.html'), 'utf8');
const bustedHtml = rawHtml.replace('./app.js', `./app.js?v=${cacheTag}`);
fs.writeFileSync(path.join(docsDir, 'index.html'), bustedHtml, 'utf8');
if (fs.existsSync(path.join(root, 'assets', 'icon.png'))) {
  fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(docsDir, 'icon.png'));
}

const copyDir = (srcRel, dstRel) => {
  const src = path.join(root, srcRel);
  const dst = path.join(docsDir, dstRel);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const fullSrc = path.join(src, name);
    if (fs.statSync(fullSrc).isFile()) {
      fs.copyFileSync(fullSrc, path.join(dst, name));
    }
  }
};

copyDir('website/screenshots', 'screenshots');
copyDir('website/tiles', 'tiles');

console.log('Built pure monochrome OLED website + screenshots + tiles into docs/');
