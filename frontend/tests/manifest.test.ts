import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('web app manifest', () => {
  const m = manifest();

  it('opens standalone on the dashboard', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/dashboard');
  });

  it('has the 192px and 512px icons installers require, and they exist', () => {
    const sizes = (m.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of m.icons ?? []) {
      expect(existsSync(join(__dirname, '..', 'public', icon.src))).toBe(true);
    }
  });
});
