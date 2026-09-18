
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, GlassCard } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { typography, spacing } from '../src/theme';
import { useTheme } from '../src/theme';

export default function PaymentHistory() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase.from('payment_history')
      .select('*')
      .eq('user_id', user.id)
      .order('paid_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [user]));

  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Your complete payment history</Text>

        {rows.length === 0 ? (
          <GlassCard style={{ marginTop: spacing.xl }}>
            <Text style={styles.empty}>No payments yet.</Text>
          </GlassCard>
        ) : (
          rows.map((r, i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <GlassCard>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plan}>{r.plan?.toUpperCase()}</Text>
                    <Text style={styles.ref}>#{r.reference?.slice(0, 16)}</Text>
                    <Text style={styles.date}>
                      {new Date(r.paid_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>${(r.amount / 100).toFixed(2)}</Text>
                    <Text style={styles.scans}>+{r.scans_added} scans</Text>
                  </View>
                </View>
              </GlassCard>
            </View>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  plan: { ...typography.body, color: palette.text, fontWeight: '800' },
  ref: { ...typography.mono, color: palette.textMuted, marginTop: 4, fontSize: 11 },
  date: { ...typography.micro, color: palette.textDim, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '900', color: palette.neon },
  scans: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
});
