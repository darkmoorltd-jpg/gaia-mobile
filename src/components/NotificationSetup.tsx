import { useAuth } from '../store/auth';
import { usePushRegistration } from '../hooks/usePushRegistration';

export default function NotificationSetup() {
  const user = useAuth((s: any) => s.user);
  usePushRegistration(user);
  return null;
}
