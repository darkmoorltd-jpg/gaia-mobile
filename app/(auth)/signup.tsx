import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { useLocale, countryFlag } from '../../src/store/locale';
import { supabase } from '../../src/api/supabase';
import Dropdown from '../../src/components/Dropdown';

export default function Signup() {
  const currentCountry = useLocale((s) => s.country);
  const currentLang = useLocale((s) => s.language);
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const signUp = useAuth((s) => s.signUp);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detectedCode = useLocale((s) => s.detectedCode);
  const countriesList = useLocale((s) => s.countries);
  const [country, setCountry] = useState<string>('');
  const countryOptions = countriesList.length > 0
    ? countriesList.map((c) => ({ label: `${countryFlag(c.code)} ${c.name}`, value: c.code }))
    : ([
        ['NG', 'Nigeria'],
        ['GH', 'Ghana'],
        ['KE', 'Kenya'],
        ['ZA', 'South Africa'],
        ['CI', "Côte d'Ivoire"],
        ['US', 'United States'],
        ['GB', 'United Kingdom'],
      ] as [string, string][]).map(([code, name]) => ({ label: `${countryFlag(code)} ${name}`, value: code }));
  useEffect(() => {
    if (country) return;
    if (detectedCode && countriesList.some((c) => c.code === detectedCode)) {
      setCountry(detectedCode);
      return;
    }
    if (countriesList.length > 0) setCountry(countriesList[0].code);
    else setCountry('NG');
  }, [detectedCode, countriesList.length, country]);


  const handleSubmit = async () => {
    if (!country) { setError('Please select your country.'); return; }
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    const err = await signUp(email.trim(), password);
    if (err) { setBusy(false); setError(err); return; }

    // Save selected country to store first (hydrates full country info)
    try { await useLocale.getState().setCountry(country); } catch {}

    // Persist country name + code + language to user_profiles
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (me) {
        const loc = useLocale.getState();
        const info = loc.country;
        const countryName = info?.name || country;
        const countryCode = info?.code || country;
        const lang = loc.language || info?.default_language || 'en';

        const _picked = (countriesList || []).find((c: any) => c.code === country);
        const _upd1 = await supabase.from('user_profiles').upsert({
          user_id: me.id,
          email: email.trim().toLowerCase(),
          country: countryName,
          country_code: countryCode,
          preferred_language: lang,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (_upd1.error && String(_upd1.error.message).includes('country_code')) {
          await supabase.from('user_profiles').upsert({
            user_id: me.id,
            email: email.trim().toLowerCase(),
            country: countryName,
            preferred_language: lang,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        };
        console.log('[signup] saved country:', countryName, countryCode);
      }
    } catch (e) {
      console.warn('[signup] country save failed', e);
    }

    setBusy(false);
    // Go to tab home — onboarding is a legacy route
    router.replace('/(tabs)' as any);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Text style={styles.leaf}>GAIA</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start diagnosing your farm in 30 seconds.</Text>

        <Dropdown
          label="COUNTRY"
          value={country}
          options={countryOptions}
          onChange={setCountry}
          placeholder="Select your country"
          required
        />

        
        {/* COUNTRY_BANNER */}
        {(() => {
          if (!country) return null;
          const sel = (countriesList || []).find((c: any) => c.code === country)
                   || ALL_COUNTRIES.find((c: any) => c.code === country);
          if (!sel) return null;
          const paymentColors: any = {
            paystack: { bg: '#00C3F7', label: 'Paystack' },
            flutterwave: { bg: '#F5A623', label: 'Flutterwave' },
            stripe: { bg: '#635BFF', label: 'Stripe' },
          };
          const pm = paymentColors[sel.payment_provider] || { bg: '#666666', label: sel.payment_provider || 'Pay' };
          return (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 12, marginBottom: 16, borderRadius: 12,
              backgroundColor: 'rgba(0,255,136,0.08)',
              borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)',
            }}>
              <Text style={{ fontSize: 28 }}>{countryFlag(sel.code)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#2e7d32' }}>{sel.name}</Text>
                <Text style={{ fontSize: 11, color: '#607d8b' }}>
                  {sel.currency} · {sel.currency_symbol} · {(sel.languages || []).slice(0, 2).join(' / ').toUpperCase()}
                </Text>
              </View>
              <View style={{
                backgroundColor: pm.bg, paddingHorizontal: 10, paddingVertical: 5,
                borderRadius: 8,
              }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
                  {pm.label}
                </Text>
              </View>
            </View>
          );
        })()}

<Text style={styles.label}>EMAIL</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="you@example.com" placeholderTextColor={palette.textDim}
            style={styles.input} editable={!busy}
          />
        </View>

        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={password} onChangeText={setPassword}
            secureTextEntry placeholder="at least 6 characters"
            placeholderTextColor={palette.textDim} style={styles.input}
            editable={!busy}
          />
        </View>

        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={confirm} onChangeText={setConfirm}
            secureTextEntry placeholder="type it again"
            placeholderTextColor={palette.textDim} style={styles.input}
            editable={!busy}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={busy || !email || !password || !confirm}
          style={[styles.cta, (busy || !email || !password || !confirm) && { opacity: 0.4 }]}
        >
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>CREATE ACCOUNT</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 24 }}>
          <Text style={styles.signup}>Already have an account? Sign in</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 16 },
  leaf: { fontSize: 40, fontWeight: '900', color: p.neon, letterSpacing: 8, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: p.textMuted, marginTop: 6, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 14 },
  input: { paddingVertical: 14, color: p.text, fontSize: 15 },
  error: { color: p.danger, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  googleBtn: { padding: 18, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', marginBottom: 20 },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleIcon: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleText: { fontSize: 14, fontWeight: '900', color: '#1f1f1f', letterSpacing: 0.5 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: p.border },
  dividerText: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  signup: { color: p.textMuted, textAlign: 'center', fontSize: 14 },
});
