import net from 'node:net';
import crypto from 'node:crypto';

const DISCORD_CLIENT_ID = '1345000000000000000'; // App ID placeholder for local IPC presence

class DiscordRpcClient {
  private socket: net.Socket | null = null;
  private connected = false;
  private enabled = false;
  private clientId = DISCORD_CLIENT_ID;

  setClientId(id?: string): void {
    const clean = id?.trim();
    if (clean && clean !== this.clientId) {
      this.clientId = clean;
      this.disconnect();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
      this.disconnect();
    }
  }

  private encodePacket(op: number, data: unknown): Buffer {
    const payload = Buffer.from(JSON.stringify(data), 'utf8');
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(payload.length, 4);
    return Buffer.concat([header, payload]);
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.enabled) return false;
    if (this.connected && this.socket && !this.socket.destroyed) return true;

    for (let i = 0; i < 6; i++) {
      const pipePath = `\\\\.\\pipe\\discord-ipc-${i}`;
      const ok = await new Promise<boolean>((resolve) => {
        const sock = net.createConnection(pipePath);
        const timer = setTimeout(() => {
          sock.destroy();
          resolve(false);
        }, 400);

        sock.once('connect', () => {
          clearTimeout(timer);
          this.socket = sock;
          this.connected = true;
          sock.write(this.encodePacket(0, { v: 1, client_id: this.clientId }));
          sock.on('error', () => {
            this.connected = false;
            this.socket = null;
          });
          sock.on('close', () => {
            this.connected = false;
            this.socket = null;
          });
          resolve(true);
        });

        sock.once('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      });
      if (ok) return true;
    }
    return false;
  }

  async setReadingActivity(mangaTitle: string, chapterLabel: string): Promise<void> {
    if (!this.enabled) return;
    const ok = await this.ensureConnected();
    if (!ok || !this.socket) return;

    const activity = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: {
          details: mangaTitle.slice(0, 120),
          state: chapterLabel.slice(0, 120),
          timestamps: { start: Math.floor(Date.now() / 1000) },
          assets: {
            large_text: 'KOMA — Manga Sanctuary',
          },
        },
      },
      nonce: crypto.randomUUID(),
    };
    try {
      this.socket.write(this.encodePacket(1, activity));
    } catch {
      this.connected = false;
    }
  }

  clear(): void {
    if (!this.connected || !this.socket) return;
    try {
      this.socket.write(
        this.encodePacket(1, {
          cmd: 'SET_ACTIVITY',
          args: { pid: process.pid, activity: null },
          nonce: crypto.randomUUID(),
        }),
      );
    } catch {
      // Ignore
    }
  }

  disconnect(): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.connected = false;
  }
}

export const discordRpc = new DiscordRpcClient();
