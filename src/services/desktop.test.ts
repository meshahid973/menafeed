import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDesktopStatus } from './desktop';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
}));

import { invoke, isTauri } from '@tauri-apps/api/core';

const mockedIsTauri = vi.mocked(isTauri);
const mockedInvoke = vi.mocked(invoke);

describe('desktop boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supports browser previews without invoking native commands', async () => {
    mockedIsTauri.mockReturnValue(false);
    await expect(readDesktopStatus()).resolves.toEqual({ kind: 'preview' });
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it('accepts the typed Tauri readiness handshake', async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockResolvedValue({ appName: 'SIGNAL', schemaVersion: 1 });
    await expect(readDesktopStatus()).resolves.toEqual({
      kind: 'ready',
      schemaVersion: 1,
    });
    expect(mockedInvoke).toHaveBeenCalledWith('get_app_status');
  });

  it('treats malformed native responses as failures', async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockResolvedValue({ appName: 'OTHER', schemaVersion: 0 });
    await expect(readDesktopStatus()).resolves.toEqual({ kind: 'error' });
  });

  it('does not expose native exceptions to the view', async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockRejectedValue(new Error('sensitive internal path'));
    await expect(readDesktopStatus()).resolves.toEqual({ kind: 'error' });
  });
});
