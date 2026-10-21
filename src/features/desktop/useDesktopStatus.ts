import { useEffect, useState } from 'react';
import { readDesktopStatus, type DesktopStatus } from '../../services/desktop';

export function useDesktopStatus(): DesktopStatus {
  const [status, setStatus] = useState<DesktopStatus>({ kind: 'checking' });

  useEffect(() => {
    let active = true;

    void readDesktopStatus().then((result) => {
      if (active) {
        setStatus(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
