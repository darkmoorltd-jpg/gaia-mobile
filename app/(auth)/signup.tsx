import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TextInput, ActivityIndicator, Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { useLocale, countryFlag } from '../../src/store/locale';
import { supabase } from '../../src/api/supabase';
import Dropdown from '../../src/components/Dropdown';


const COUNTRY_CODES = [
  { iso: 'NG', flag: '🇳🇬', dial: '+234' },
  { iso: 'GH', flag: '🇬🇭', dial: '+233' },
  { iso: 'KE', flag: '🇰🇪', dial: '+254' },
  { iso: 'ZA', flag: '🇿🇦', dial: '+27' },
  { iso: 'GB', flag: '🇬🇧', dial: '+44' },
  { iso: 'US', flag: '🇺🇸', dial: '+1' },
  { iso: 'FR', flag: '🇫🇷', dial: '+33' },
  { iso: 'IN', flag: '🇮🇳', dial: '+91' },
  { iso: 'CN', flag: '🇨🇳', dial: '+86' },
];

export default function Signup() {
  useEffect(() => { useLocale.getState().load().catch(() => {}); }, []);
  const currentCountry = useLocale((s) => s.country);
  const currentLang = useLocale((s) => s.language);
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const signUp = useAuth((s) => s.signUp);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+234');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const detectedCode = useLocale((s) => s.detectedCode);
  const countriesList = useLocale((s) => s.countries);
  const [country, setCountry] = useState<string>('');
  const [showPicker, setShowPicker] = useState(false);



  // Helper to get picked country object
  const pickedCountry = countriesList.find((c: any) => c.code === country) || null;
  const pickerOptions = countriesList.length > 0
    ? countriesList.slice().sort((a: any, b: any) => a.name.localeCompare(b.name))
    : [{ code: 'NG', name: 'Nigeria' }, { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }] as any[];


  const handleSubmit = async () => {
    if (!country) { setShowPicker(true); return; }
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (!phone || !/^(0|234)[0-9]{10}$/.test(phone.replace(/\s/g, ''))) {
      setError('Enter a valid phone number (e.g. 08031234567).');
      return;
    }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    // Save country to AsyncStorage FIRST (survives email-confirm flow)
    try {
      const AS = AsyncStorage;
      const picked = (countriesList || []).find((c: any) => c.code === country);
      await AS.setItem('gaia_pending_country', JSON.stringify({
        code: country,
        name: picked?.name || country,
        payment_provider: picked?.payment_provider || 'paystack',
        ts: Date.now(),
      }));
      console.log('[signup] pending saved:', country, picked?.name);
    } catch (e) { console.warn('[signup] AS failed', e); }

    // Build picked country info
    const picked = (countriesList || []).find((c: any) => c.code === country);
    const countryMeta = {
      country_name: picked?.name || country,
      country_code: picked?.code || country,
      payment_provider: picked?.payment_provider || 'paystack',
      preferred_language: picked?.default_language || 'en',
    };

    // ============================================================
    // Normalize phone (country code + local number → E.164)
    // ============================================================
    let digits = (phone || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    const finalPhone = phoneCountryCode.replace('+', '') + digits;

    if (finalPhone.length < 10) {
      setError('Enter a valid phone number (at least 10 digits).');
      setBusy(false);
      return;
    }

    // ============================================================
    // Duplicate phone pre-check (friendly error before hitting DB constraint)
    // ============================================================
    try {
      const dupCheck = await supabase.rpc('find_email_by_identifier', { p_identifier: finalPhone });
      if (dupCheck.data) {
        setError('This phone number is already registered. Please log in instead, or use a different number.');
        setBusy(false);
        return;
      }
    } catch (e) {
      console.warn('[signup] phone pre-check failed (continuing):', e);
    }

    // Sign up with country stored in user_metadata (survives email-confirm flow)
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: countryMeta },
    });

    if (signupError) {
      try { await useLocale.getState().setCountry(country); } catch {}
    setBusy(false);
      setError(signupError.message);
      return;
    }

    // If session exists (email confirm OFF) → write to user_profiles NOW
    if (signupData.session && signupData.user) {
      try {
        // Normalize phone to E.164 (234...)
        let normalizedPhone = (phone || '').replace(/[^0-9]/g, '');
        if (normalizedPhone.startsWith('0')) normalizedPhone = '234' + normalizedPhone.slice(1);
        else if (!normalizedPhone.startsWith('234') && normalizedPhone.length === 10) normalizedPhone = '234' + normalizedPhone;

        await supabase.from('user_profiles').upsert({
          user_id: signupData.user.id,
          email: signupData.user.email!.toLowerCase(),
          phone: finalPhone,
          country: countryMeta.country_name,
          country_code: countryMeta.country_code,
          payment_provider: countryMeta.payment_provider,
          preferred_language: countryMeta.preferred_language,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        console.log('[signup] profile written immediately');
      } catch (e) { console.warn('[signup] immediate write failed:', e); }
    } else {
      // No session (email confirm ON) → metadata will sync on first login
      console.log('[signup] country saved to metadata, will sync on login');
    }

    // Also save to AsyncStorage as extra backup
    try {
      await AsyncStorage.setItem('gaia_pending_country', country);
      await AsyncStorage.setItem('gaia_pending_country_name', countryMeta.country_name);
    } catch {}



    setBusy(false);
    router.replace('/(tabs)' as any);
  };

  const pwScore = (() => {
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwPct = (pwScore / 5) * 100;
  const pwLabel = pwPct < 40 ? 'Weak' : pwPct < 80 ? 'Good' : 'Strong';
  const pwColor = pwPct < 40 ? '#FF3B5C' : pwPct < 80 ? '#FFB300' : '#00FF88';
  const formValid = !!country && !!email && password.length >= 6 && password === confirm;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#ECFDF5', '#D1FAE5', '#ECFDF5']} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>

          <View style={styles.progressRow}>
            <View style={styles.progressDotOn} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <Text style={styles.progressText}>STEP 1 OF 3 · ACCOUNT</Text>
          </View>

          <Text style={styles.leaf}>GAIA</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>30 free AI scans unlocked instantly.</Text>

          <Text style={styles.label}>COUNTRY</Text>
          <Pressable onPress={() => setShowPicker(true)} style={styles.countryCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <Text style={{ fontSize: 28 }}>{country ? countryFlag(country) : '🌍'}</Text>
              <View>
                <Text style={styles.countryName}>{pickedCountry?.name || country || 'Select country'}</Text>
                <Text style={styles.countryMeta}>{(pickedCountry as any)?.currency || 'Paystack'} · {currentLang.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 18, color: palette.neon }}>▾</Text>
          </Pressable>

          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address"
              placeholder="you@example.com" placeholderTextColor={palette.textDim}
              style={styles.input} editable={!busy}
            />
          </View>

          <Text style={styles.label}>PHONE NUMBER *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {COUNTRY_CODES.map((c) => {
              const selected = phoneCountryCode === c.dial;
              return (
                <Pressable
                  key={c.iso}
                  onPress={() => setPhoneCountryCode(c.dial)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selected ? palette.neon : palette.border,
                    backgroundColor: selected ? 'rgba(0,255,136,0.12)' : palette.surface,
                  }}
                >
                  <Text style={{
                    fontSize: 11, fontWeight: '700',
                    color: selected ? palette.neon : palette.textMuted,
                  }}>
                    {c.flag} {c.dial}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.inputWrap}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={phoneCountryCode === '+234' ? '08031234567' : '8012345678'}
            placeholderTextColor={palette.textDim}
            style={styles.input}
            editable={!busy}
          />
        </View>

        <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={password} onChangeText={setPassword}
              secureTextEntry={!showPw} placeholder="at least 6 characters"
              placeholderTextColor={palette.textDim} style={styles.input} editable={!busy}
            />
            <Pressable onPress={() => setShowPw(!showPw)} hitSlop={10}>
              <Text style={styles.eyeBtn}>{showPw ? '🙈' : '👁️'}</Text>
            </Pressable>
          </View>
          {password.length > 0 ? (
            <View style={styles.pwRow}>
              <View style={styles.pwTrack}>
                <View style={[styles.pwFill, { width: pwPct + '%', backgroundColor: pwColor }]} />
              </View>
              <Text style={[styles.pwLabel, { color: pwColor }]}>{pwLabel}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={confirm} onChangeText={setConfirm}
              secureTextEntry={!showPw} placeholder="type it again"
              placeholderTextColor={palette.textDim} style={styles.input} editable={!busy}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable onPress={handleSubmit} disabled={!formValid || busy}>
            <LinearGradient
              colors={(!formValid || busy) ? ['#E2E8F0', '#E2E8F0'] : ['#10B981', '#059669']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {busy ? <ActivityIndicator color="#060B18" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.ctaText}>CREATE ACCOUNT</Text>
                  <Text style={styles.ctaArrow}>→</Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.benefits}>
            <Text style={styles.benefit}>✓  30 free AI scans</Text>
            <Text style={styles.benefit}>✓  Crop disease detection</Text>
            <Text style={styles.benefit}>✓  Marketplace + agent tools</Text>
          </View>

          <Pressable onPress={() => router.replace('/(auth)/login' as any)} style={{ marginTop: 24 }}>
            <Text style={styles.signup}>
              Already have an account? <Text style={{ color: palette.neon, fontWeight: '900' }}>Sign in →</Text>
            </Text>
          </Pressable>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setShowPicker(false)}>
              <Text style={styles.modalClose}>CLOSE</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Select Country</Text>
            <Text style={styles.modalSub}>{pickerOptions.length} available</Text>
            <ScrollView>
              {pickerOptions.map((c: any) => {
                const on = c.code === country;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => { setCountry(c.code); setShowPicker(false); }}
                    style={[styles.countryRow, on && styles.countryRowOn]}
                  >
                    <Text style={styles.countryRowFlag}>{countryFlag(c.code)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.countryRowName, on && { color: palette.neon }]}>{c.name}</Text>
                      <Text style={styles.countryRowMeta}>{(c.currency || '') + ' · ' + (c.payment_provider || 'paystack')}</Text>
                    </View>
                    {on ? <Text style={{ color: palette.neon, fontSize: 18 }}>✓</Text> : null}
                  </Pressable>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ECFDF5' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#10B981' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  progressDotOn: { width: 24, height: 4, borderRadius: 2, backgroundColor: '#10B981' },
  progressDot: { width: 8, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)' },
  progressText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#64748B', marginLeft: 6 },
  leaf: {
    fontSize: 40, fontWeight: '900', color: '#10B981', letterSpacing: 8, marginBottom: 12,
    textShadowColor: 'rgba(16,185,129,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  title: { fontSize: 30, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 6, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 8, marginTop: 8 },
  countryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 14, marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.25)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  countryName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  countryMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, borderRadius: 14, marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, paddingVertical: 14, color: '#0F172A', fontSize: 15 },
  eyeBtn: { fontSize: 16, padding: 4 },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: -4 },
  pwTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  pwFill: { height: 4, borderRadius: 2 },
  pwLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, marginBottom: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  errorIcon: { fontSize: 16 },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '600' },
  cta: {
    paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 12,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5 },
  ctaArrow: { fontSize: 18, color: '#FFFFFF', fontWeight: '900' },
  benefits: { marginTop: 20, gap: 8 },
  benefit: { fontSize: 13, color: '#475569', fontWeight: '600' },
  signup: { color: '#64748B', textAlign: 'center', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '88%',
  },
  modalClose: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#64748B', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4,
  },
  countryRowOn: { backgroundColor: 'rgba(16,185,129,0.1)' },
  countryRowFlag: { fontSize: 26 },
  countryRowName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  countryRowMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
});
