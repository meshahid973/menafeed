import { invoke, isTauri } from '@tauri-apps/api/core';

interface NativeAppStatus {
  appName: string;
  schemaVersion: number;
}

export type DesktopStatus =
  | { kind: 'checking' }
  | { kind: 'preview' }
  | { kind: 'error' }
  | { kind: 'ready'; schemaVersion: number };

export async function readDesktopStatus(): Promise<DesktopStatus> {
  if (!isTauri()) {
    return { kind: 'preview' };
  }

  try {
    const response = await invoke<NativeAppStatus>('get_app_status');
    if (
      response.appName !== 'SIGNAL' ||
      !Number.isInteger(response.schemaVersion) ||
      response.schemaVersion < 1
    ) {
      return { kind: 'error' };
    }

    return { kind: 'ready', schemaVersion: response.schemaVersion };
  } catch {
    return { kind: 'error' };
  }
}
