import { MotionConfig } from 'motion/react';
import { AppShell } from '../components/layout/AppShell';
import { useDesktopStatus } from '../features/desktop/useDesktopStatus';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppShell desktopStatus={useDesktopStatus()} />
    </MotionConfig>
  );
}
