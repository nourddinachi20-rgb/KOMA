import { spawn } from 'node:child_process';
import path from 'node:path';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'cmd.exe' : 'npm';
const npmArgs = (script) => (isWin ? ['/c', 'npm', ...script] : script);

const vite = spawn(npmCmd, npmArgs(['exec', 'vite']), {
  stdio: 'inherit',
  env: { ...process.env },
});

async function waitForVite(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Wait
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Vite dev server timed out');
}

async function main() {
  const tsc = spawn(npmCmd, npmArgs(['run', 'build:electron']), { stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    tsc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tsc failed: ${code}`))));
  });

  await waitForVite('http://127.0.0.1:5173');

  const electronBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    isWin ? 'electron.cmd' : 'electron',
  );

  const child = spawn(isWin ? 'cmd.exe' : electronBin, isWin ? ['/c', electronBin, '.'] : ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
  });

  child.on('exit', (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  vite.kill();
  process.exit(1);
});
