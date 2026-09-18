import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useTheme, typography, spacing, radius, shadows } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

export default function Wallet() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [balance, setBalance] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [txns, setTxns] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      try {
        const { data: w } = await supabase
          .from('farmer_wallets')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (w) {
          setBalance(Number(w.balance || 0));
          setEscrow(Number(w.escrow_balance || 0));
        } else {
          await supabase.from('farmer_wallets').insert({
            user_id: user.id, balance: 0, account_bank: 'Wema Bank',
            account_name: user.email,
            virtual_account: 'GAIA-' + user.id.slice(0, 8).toUpperCase(),
          });
        }
        const { data: ph } = await supabase
          .from('payment_history')
          .select('*')
          .eq('user_id', user.id)
          .order('paid_at', { ascending: false })
          .limit(20);
        setTxns(ph || []);
      } catch {}
      setBusy(false);
    })();
  }, [user]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Your money, secured.</Text>

        <LinearGradient colors={palette.gradientNeon as any} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.balanceValue}>
            N{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.balanceDivider} />
          <Text style={styles.balanceSub}>
            GAIA-{user?.id?.slice(0, 8).toUpperCase()} · Wema Bank
          </Text>
        </LinearGradient>

        <View style={styles.actionRow}>
          <Pressable style={styles.topUpBtn}>
            <Text style={styles.topUpText}>TOP UP</Text>
          </Pressable>
          <Pressable style={styles.withdrawBtn}>
            <Text style={styles.withdrawText}>WITHDRAW</Text>
          </Pressable>
        </View>

        <View style={styles.escrowCard}>
          <Text style={styles.escrowLabel}>IN ESCROW</Text>
          <Text style={styles.escrowValue}>N{escrow.toLocaleString()}</Text>
        </View>

        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && txns.length === 0 ? (
          <Text style={styles.empty}>No transactions yet.</Text>
        ) : null}

        {txns.map((t, i) => {
          const positive = (t.amount || 0) > 0;
          return (
            <View key={i} style={styles.txnRow}>
              <View style={styles.txnIconWrap}>
                <Text style={styles.txnIcon}>{positive ? '+' : '-'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnLabel}>{t.plan ? t.plan.toUpperCase() : 'Transaction'}</Text>
                <Text style={styles.txnSub}>{new Date(t.paid_at || t.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txnAmt, { color: positive ? palette.neon : palette.text }]}>
                N{(Math.abs(t.amount || 0) / 100).toFixed(2)}
              </Text>
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 56 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  balanceCard: { borderRadius: radius.xl, padding: spacing.xxl, marginTop: spacing.xl, ...shadows.neon },
  balanceLabel: { ...typography.micro, color: 'rgba(0,0,0,0.7)' },
  balanceValue: { fontSize: 40, fontWeight: '900', color: '#000', marginTop: 8, letterSpacing: -1.5 },
  balanceDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginVertical: spacing.lg },
  balanceSub: { ...typography.caption, color: 'rgba(0,0,0,0.7)', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  topUpBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: palette.neon, alignItems: 'center',
  },
  topUpText: { fontSize: 13, fontWeight: '900', color: palette.obsidian, letterSpacing: 1 },
  withdrawBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: palette.borderHi, alignItems: 'center',
  },
  withdrawText: { fontSize: 13, fontWeight: '900', color: palette.neon, letterSpacing: 1 },
  escrowCard: {
    padding: spacing.lg, marginTop: spacing.lg, borderRadius: 14,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  escrowLabel: { ...typography.micro, color: palette.textMuted },
  escrowValue: { fontSize: 24, fontWeight: '900', color: palette.warning, marginTop: 4 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginVertical: spacing.lg },
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center', paddingVertical: 20 },
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  txnIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: palette.neonSoft, alignItems: 'center', justifyContent: 'center',
  },
  txnIcon: { fontSize: 20, fontWeight: '900', color: palette.neon },
  txnLabel: { ...typography.body, color: palette.text, fontWeight: '600' },
  txnSub: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
  txnAmt: { fontWeight: '800', fontSize: 14 },
});
