import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

const PURPOSES = [
  { key: 'seeds', label: 'Seeds', icon: '🌱' },
  { key: 'fertilizer', label: 'Fertilizer', icon: '💩' },
  { key: 'livestock', label: 'Livestock', icon: '🐄' },
  { key: 'equipment', label: 'Equipment', icon: '🔧' },
  { key: 'land', label: 'Land Lease', icon: '🌾' },
  { key: 'emergency', label: 'Emergency', icon: '🚨' },
  { key: 'other', label: 'Other', icon: '📦' },
];

const TERMS = [
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 9, label: '9 months' },
  { months: 12, label: '12 months' },
];

export default function LoanApply() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [elig, setElig] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('seeds');
  const [purposeDetail, setPurposeDetail] = useState('');
  const [term, setTerm] = useState(6);
  const [location, setLocation] = useState('');
  const [crop, setCrop] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [e, p] = await Promise.all([
        supabase.rpc('loan_eligibility'),
        supabase.from('user_profiles').select('farm_lga,farm_state,primary_crops').eq('user_id', user?.id).maybeSingle(),
      ]);
      if (!e.error) setElig(e.data);
      if (p.data) {
        setLocation([p.data.farm_lga, p.data.farm_state].filter(Boolean).join(', '));
        setCrop(p.data.primary_crops || '');
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const maxAmount = elig?.max_amount || 0;
  const rate = elig?.interest_rate || 0;

  const computed = () => {
    const a = parseFloat(amount) || 0;
    if (!a) return { total: 0, monthly: 0 };
    const total = a + (a * (rate / 100.0) * term);
    return { total, monthly: total / term };
  };

  const { total, monthly } = computed();

  const submit = async () => {
    const a = parseFloat(amount);
    if (!a || a < 5000) { Alert.alert('Invalid amount', 'Minimum is N5,000'); return; }
    if (a > maxAmount) { Alert.alert('Exceeds limit', 'Max: ' + money(maxAmount)); return; }

    Alert.alert(
      'Confirm loan',
      'You are borrowing ' + money(a) + ' over ' + term + ' months.\n\nTotal to repay: ' + money(total) + '\nMonthly: ' + money(monthly),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'CONFIRM', onPress: doSubmit },
      ]
    );
  };

  const doSubmit = async () => {
    setBusy(true);
    try {
      const r = await supabase.rpc('loan_apply', {
        p_amount: parseFloat(amount),
        p_purpose: purpose,
        p_duration_months: term,
        p_farm_location: location,
        p_crop: crop,
        p_purpose_detail: purposeDetail,
      });
      if (r.error) throw new Error(r.error.message);
      Alert.alert('Application submitted', 'Admin will review shortly. You will be notified once approved.', [
        { text: 'OK', onPress: () => router.replace('/loans' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!elig || maxAmount <= 0) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Not yet eligible</Text>
          <Text style={styles.sub}>
            Your trust score is {elig?.trust_score ?? 0}. Minimum 150 required. Complete your KYC, farm details and phone to unlock.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>GO BACK</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>CANCEL</Text></Pressable>
        <Text style={styles.kicker}>STEP {step} OF 3</Text>
        <Text style={styles.title}>Apply for Loan</Text>

        {/* Progress */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.progressDot, step >= n && styles.progressDotOn]} />
          ))}
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.sub}>How much do you want to borrow?</Text>
            <LinearGradient colors={['#7c4dff', '#b388ff'] as any} style={styles.amountHero}>
              <Text style={styles.amountLabel}>AMOUNT</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.amountInput}
              />
              <Text style={styles.amountMax}>MAX: {money(maxAmount)}</Text>
            </LinearGradient>

            <View style={styles.quickRow}>
              {[5000, 10000, 20000, 50000].filter((x) => x <= maxAmount).map((x) => (
                <Pressable key={x} onPress={() => setAmount(String(x))} style={styles.quickBtn}>
                  <Text style={styles.quickText}>{money(x)}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => { if (!amount) { Alert.alert('Enter amount'); return; } setStep(2); }} style={styles.cta}>
              <Text style={styles.ctaText}>NEXT</Text>
            </Pressable>
          </>
        ) : step === 2 ? (
          <>
            <Text style={styles.sub}>What is the loan for?</Text>
            <View style={styles.purposeGrid}>
              {PURPOSES.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setPurpose(p.key)}
                  style={[styles.purposeCard, purpose === p.key && styles.purposeCardOn]}
                >
                  <Text style={styles.purposeIcon}>{p.icon}</Text>
                  <Text style={[styles.purposeLabel, purpose === p.key && styles.purposeLabelOn]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>DETAILS (optional)</Text>
            <TextInput
              value={purposeDetail}
              onChangeText={setPurposeDetail}
              placeholder="e.g. NPK for 2 acres of maize"
              placeholderTextColor={palette.textDim}
              multiline
              style={[styles.input, { minHeight: 60 }]}
            />

            <Text style={styles.label}>REPAYMENT TERM</Text>
            <View style={styles.termRow}>
              {TERMS.map((t) => (
                <Pressable
                  key={t.months}
                  onPress={() => setTerm(t.months)}
                  style={[styles.termBtn, term === t.months && styles.termBtnOn]}
                >
                  <Text style={[styles.termText, term === t.months && styles.termTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.breakdown}>
              <View style={styles.breakRow}>
                <Text style={styles.breakK}>Principal</Text>
                <Text style={styles.breakV}>{money(parseFloat(amount) || 0)}</Text>
              </View>
              <View style={styles.breakRow}>
                <Text style={styles.breakK}>Interest ({rate}%/mo x {term} mo)</Text>
                <Text style={styles.breakV}>{money(total - (parseFloat(amount) || 0))}</Text>
              </View>
              <View style={[styles.breakRow, styles.breakTotal]}>
                <Text style={styles.breakK}>Total to repay</Text>
                <Text style={[styles.breakV, { color: palette.neon, fontWeight: '900' }]}>{money(total)}</Text>
              </View>
              <View style={styles.breakRow}>
                <Text style={styles.breakK}>Monthly</Text>
                <Text style={styles.breakV}>{money(monthly)}</Text>
              </View>
            </View>

            <View style={styles.btnRow}>
              <Pressable onPress={() => setStep(1)} style={[styles.cta, { flex: 1, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }]}>
                <Text style={[styles.ctaText, { color: palette.text }]}>BACK</Text>
              </Pressable>
              <Pressable onPress={() => setStep(3)} style={[styles.cta, { flex: 2 }]}>
                <Text style={styles.ctaText}>REVIEW</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sub}>Review and confirm</Text>
            <View style={styles.summaryCard}>
              <Row k="Amount" v={money(parseFloat(amount))} styles={styles} />
              <Row k="Purpose" v={PURPOSES.find((x) => x.key === purpose)?.label || purpose} styles={styles} />
              <Row k="Term" v={term + ' months'} styles={styles} />
              <Row k="Interest rate" v={rate + '% per month'} styles={styles} />
              <Row k="Total repayable" v={money(total)} styles={styles} highlight />
              <Row k="Monthly payment" v={money(monthly)} styles={styles} />
              <Row k="Trust score" v={String(elig.trust_score)} styles={styles} />
              <Row k="Tier" v={(elig.tier || '').toUpperCase()} styles={styles} />
            </View>

            <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SUBMIT APPLICATION</Text>}
            </Pressable>

            <Pressable onPress={() => setStep(2)} style={[styles.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border, marginTop: 10 }]}>
              <Text style={[styles.ctaText, { color: palette.text }]}>EDIT</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ k, v, styles, highlight }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={[styles.rowV, highlight && { color: '#00ff88' }]}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 8, marginBottom: 20 },
  progressRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressDotOn: { backgroundColor: p.neon },
  amountHero: { borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 20 },
  amountLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  amountInput: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2, marginTop: 8, textAlign: 'center', minWidth: 200 },
  amountMax: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  quickText: { fontSize: 12, fontWeight: '700', color: p.text },
  purposeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  purposeCard: { width: '31%', padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  purposeCardOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.10)' },
  purposeIcon: { fontSize: 24 },
  purposeLabel: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 6, letterSpacing: 0.5, textAlign: 'center' },
  purposeLabelOn: { color: p.neon },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 18, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  termRow: { flexDirection: 'row', gap: 8 },
  termBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  termBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  termText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  termTextOn: { color: p.neon },
  breakdown: { marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  breakTotal: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 6 },
  breakK: { fontSize: 12, color: p.textMuted },
  breakV: { fontSize: 13, color: p.text, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  summaryCard: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1 },
});
