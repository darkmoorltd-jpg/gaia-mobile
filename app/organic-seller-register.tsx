import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';

// DEPRECATED: Organic seller registration is now part of the unified seller tier flow.
// Redirect to /seller-dashboard, which routes through verify → subscribe → organic setup.
export default function OrganicSellerRegisterLegacy() {
  const router = useRouter();
  const { palette } = useTheme();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/seller-dashboard' as any);
    }, 600);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.obsidian }}>
      <ActivityIndicator color={palette.neon} size="large" />
      <Text style={{ marginTop: 16, color: palette.textMuted, fontSize: 13 }}>
        Redirecting to seller setup…
      </Text>
    </View>
  );
}
