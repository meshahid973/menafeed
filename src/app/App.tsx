import { AppShell } from '../components/layout/AppShell';
import { useDesktopStatus } from '../features/desktop/useDesktopStatus';

export function App() {
  const desktopStatus = useDesktopStatus();

  return <AppShell desktopStatus={desktopStatus} />;
}
