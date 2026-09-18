import { Redirect } from 'expo-router';

export default function ChatTab() {
  return <Redirect href={'/chat' as any} />;
}
