import { AppShell } from '../components/layout/AppShell';
import { useDesktopStatus } from '../features/desktop/useDesktopStatus';

export function App() {
  return <AppShell desktopStatus={useDesktopStatus()} />;
}
