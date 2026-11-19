import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const AUTH_DIR = join(import.meta.dirname, '.auth');

export default async function globalTeardown() {
  // Clean up auth directory on teardown
  if (existsSync(AUTH_DIR)) {
    rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('Cleaned up auth storage states');
  }
}