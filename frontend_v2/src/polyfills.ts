// Ensure Buffer is available globally before other modules run
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

// Provide a minimal `process.env` object for libraries that read it
if (!(globalThis as any).process) {
  (globalThis as any).process = { env: {} };
}

export {};
