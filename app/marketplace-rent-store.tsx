import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';

// DEPRECATED: The rent-store flow has been replaced by the unified seller tier system.
// Redirect users to /seller-verify, which handles KYC + tier subscription.
export default function RentStoreLegacy() {
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

const styles = StyleSheet.create({});
