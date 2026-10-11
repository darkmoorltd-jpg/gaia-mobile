import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function AgentLayout() {
  const { palette } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.obsidian },
      }}
    />
  );
}
