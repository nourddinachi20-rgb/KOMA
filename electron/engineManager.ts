import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { app } from 'electron';

export interface EngineStatus {
  ready: boolean;
  port: number | null;
  url: string | null;
  sourcesCount: number;
  error: string | null;
}

class EngineManager {
  private proc: ChildProcess | null = null;
  private status: EngineStatus = {
    ready: false,
    port: null,
    url: null,
    sourcesCount: 0,
    error: null,
  };
  private logs: string[] = [];

  getStatus(): EngineStatus {
    return { ...this.status };
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  private resolveJarPath(): string {
    const devPath = path.join(app.getAppPath(), 'engine', 'build', 'libs', 'noctis-engine.jar');
    if (fs.existsSync(devPath)) return devPath;
    const prodPath = path.join(process.resourcesPath, 'noctis-engine.jar');
    if (fs.existsSync(prodPath)) return prodPath;
    return devPath;
  }

  private resolveJavaBin(): string {
    const devJre = path.join(app.getAppPath(), 'engine', 'jre', 'bin', 'java.exe');
    if (fs.existsSync(devJre)) return devJre;
    const prodJre = path.join(process.resourcesPath, 'jre', 'bin', 'java.exe');
    if (fs.existsSync(prodJre)) return prodJre;
    return 'java';
  }

  private findFreePort(preferred = 47832): Promise<number> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => {
        const fallback = net.createServer();
        fallback.unref();
        fallback.listen(0, '127.0.0.1', () => {
          const addr = fallback.address();
          const port = typeof addr === 'object' && addr ? addr.port : 47833;
          fallback.close(() => resolve(port));
        });
      });
      server.listen(preferred, '127.0.0.1', () => {
        server.close(() => resolve(preferred));
      });
    });
  }

  async start(onStatus?: (status: EngineStatus) => void): Promise<EngineStatus> {
    if (this.status.ready && this.proc) return this.getStatus();

    const jarPath = this.resolveJarPath();
    if (!fs.existsSync(jarPath)) {
      this.status = {
        ready: false,
        port: null,
        url: null,
        sourcesCount: 0,
        error: `Engine JAR not found at ${jarPath}`,
      };
      onStatus?.(this.getStatus());
      return this.getStatus();
    }

    const port = await this.findFreePort(47832);
    const url = `http://127.0.0.1:${port}`;

    this.proc = spawn(
      this.resolveJavaBin(),
      [
        '-Xmx768m',
        '-XX:+TieredCompilation',
        '-XX:TieredStopAtLevel=1',
        '-Dfile.encoding=UTF-8',
        '-jar',
        jarPath,
        String(port),
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const pushLog = (chunk: Buffer) => {
      const lines = chunk.toString('utf8').split(/\r?\n/).filter(Boolean);
      for (const l of lines) {
        this.logs.push(l);
        if (this.logs.length > 200) this.logs.shift();
      }
    };

    this.proc.stdout?.on('data', pushLog);
    this.proc.stderr?.on('data', pushLog);
    this.proc.on('exit', (code) => {
      if (this.status.ready) {
        this.status = {
          ...this.status,
          ready: false,
          error: `Engine exited with code ${code}`,
        };
      }
      this.proc = null;
    });

    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}/health`);
        if (res.ok) {
          const data = (await res.json()) as { status: string; sourcesCount?: number };
          this.status = {
            ready: true,
            port,
            url,
            sourcesCount: data.sourcesCount ?? 0,
            error: null,
          };
          onStatus?.(this.getStatus());
          return this.getStatus();
        }
      } catch {
        // Still booting
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    this.status = {
      ready: false,
      port,
      url: null,
      sourcesCount: 0,
      error: 'Engine startup timed out',
    };
    onStatus?.(this.getStatus());
    return this.getStatus();
  }

  stop(): void {
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        // Ignore
      }
      this.proc = null;
    }
    this.status.ready = false;
  }
}

export const engineManager = new EngineManager();
