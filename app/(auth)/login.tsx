import { useEffect, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useLocale, countryFlag } from '../../src/store/locale';
import { ALL_COUNTRIES } from '../../src/data/countries';
import Dropdown from '../../src/components/Dropdown';
import { supabase } from '../../src/api/supabase';
import {
  checkBiometricSupport, enableBiometric, isBiometricEnabled,
  promptBiometric, getBiometricEmail,
} from '../../src/utils/biometric';
import { registerForPushNotifications } from '../../src/utils/push';

type Tab = 'password' | 'google' | 'agent';

export default function Login() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const signIn = useAuth((s) => s.signIn);
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const signInAsAgent = useAuth((s) => s.signInAsAgent);
  const setLoginContext = useAuth((s: any) => s.setLoginContext);
  const role = useAuth((s: any) => s.role);
  const loginContext = useAuth((s: any) => s.loginContext);
  const user = useAuth((s) => s.user);

  const [tab, setTab] = useState<Tab>('password');
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const pickCountry = useLocale((s) => s.country?.code || '');
  const [localCountry, setLocalCountry] = useState<string>(
    (() => { try { return useLocale.getState().country?.code || 'NG'; } catch { return 'NG'; } })()
  );

  useEffect(() => {
    const cur = useLocale.getState().country?.code;
    if (cur && cur !== localCountry) setLocalCountry(cur);
  }, [pickCountry]);

  const changeCountry = (v: string) => {
    setLocalCountry(v);
    console.log('[login] picking country:', v);
    useLocale.getState().setCountry(v)
      .then(() => {
        const c = useLocale.getState().country;
        console.log('[login] store now:', c?.code, c?.name);
        (async () => {
          try {
            const { data: { user: me } } = await supabase.auth.getUser();
            if (me && c) {
              await supabase.from('user_profiles').update({ country: c.name }).eq('user_id', me.id);
              console.log('[login] profile country =', c.name);
            }
          } catch (e) { console.warn('[login] profile sync failed', e); }
        })();
      })
      .catch((e) => console.warn('[login] setCountry failed', e));
  };
  // VERSION_STAMP_LOGIN
  const __countryDebug = useLocale((s) => s.country?.code || 'none');
  const __buildHash = 'f0ee52f';


  const pickLanguage = useLocale((s) => s.language);
  const countriesList = useLocale((s) => s.countries);
  // Aliases + local state matching the redesigned UI
  const [country, setCountryRaw] = useState<string>(() => {
    try { return useLocale.getState().country?.code || 'NG'; } catch { return 'NG'; }
  });
  const [showPicker, setShowPicker] = useState(false);
  const setCountry = (v: string) => {
    setCountryRaw(v);
    try { useLocale.getState().setCountry(v); } catch {}
  };
  const currentLang = pickLanguage || 'en';
  const pickedCountry = (countriesList || []).find((c: any) => c.code === country) || null;
  const pickerOptions = countriesList.length > 0
    ? countriesList.slice().sort((a: any, b: any) => a.name.localeCompare(b.name))
    : [{ code: 'NG', name: 'Nigeria', currency: 'NGN', payment_provider: 'paystack' }];
  const currentCountry = useLocale((s) => s.country || (s as any).countries?.find((c: any) => c.code === s.country?.code) || null);

  // Always load store on login mount (ensures countries list populated)
  useEffect(() => {
    useLocale.getState().load().catch(() => {});
  }, []);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);
  const [bioEmail, setBioEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const support = await checkBiometricSupport();
      setBioAvailable(support.available && support.enrolled);
      setBioType(support.type);
      setBioEnabled(await isBiometricEnabled());
      setBioEmail(await getBiometricEmail());
    })();
  }, []);

  useEffect(() => {
    if (user) registerForPushNotifications(user.id);
  }, [user]);

  const handleLogin = async () => {
    setBusy(true); setError('');
    let identifier = email.trim();

    // If it looks like a phone number, resolve to the registered email
    if (identifier && !identifier.includes('@')) {
      try {
        const digits = identifier.replace(/\D/g, '');
        const normalized = digits.startsWith('0') ? '234' + digits.slice(1) : digits;
        const { data } = await supabase
          .from('user_profiles')
          .select('email,phone')
          .or('phone.eq.' + normalized + ',phone.eq.' + digits)
          .limit(1)
          .maybeSingle();
        if (data?.email) identifier = data.email;
        else { setError('No account with that phone number.'); setBusy(false); return; }
      } catch {
        setError('Could not resolve phone number.');
        setBusy(false);
        return;
      }
    }

    const err = await signIn(identifier, password);
    // Sync country from metadata → user_profiles (handles email-confirm case)
    if (!err) {
      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        if (me) {
          const meta = (me.user_metadata || {}) as any;
          if (meta.country_code) {
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('country_code')
              .eq('user_id', me.id)
              .maybeSingle();

            if (prof?.country_code !== meta.country_code) {
              await supabase.from('user_profiles').upsert({
                user_id: me.id,
                email: me.email?.toLowerCase(),
                country: meta.country_name || meta.country_code,
                country_code: meta.country_code,
                payment_provider: meta.payment_provider || 'paystack',
                preferred_language: meta.preferred_language || 'en',
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
              console.log('[login] metadata synced →', meta.country_code);
            }
          }
        }
      } catch (e) {
        console.warn('[login] metadata sync failed', e);
      }
    }

    if (err) { setError(err); setBusy(false); return; }

    // Sync pending country from signup → user_profiles
    try {
      const AS = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AS.getItem('gaia_pending_country');
      if (raw) {
        const pending = JSON.parse(raw);
        const me = useAuth.getState().user;
        if (me && pending.code) {
          const { error: syncErr } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: me.id,
              email: me.email?.toLowerCase(),
              country: pending.name,
              country_code: pending.code,
              payment_provider: pending.payment_provider || 'paystack',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          if (!syncErr) {
            await AS.removeItem('gaia_pending_country');
            console.log('[login] pending country synced:', pending.code, pending.name);
          } else {
            console.warn('[login] sync failed:', syncErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('[login] pending sync error', e);
    }

    try { router.replace('/(tabs)' as any); } catch {}
    setBusy(false);
  };

  const handleGoogle = async () => {
    setBusy(true); setError('');
    const err = await signInWithGoogle();
    if (err) { setError(err); setBusy(false); return; }
    // After success, check if this is a brand-new account
    const isNew = useAuth.getState().isNewUser;
    setBusy(false);
    if (isNew) {
      router.replace('/(auth)/onboarding' as any);
    }
  };

  const handleAgent = async () => {
    if (!email || !agentCode || !password) {
      setError('All fields required.'); return;
    }
    setBusy(true); setError('');
    const err = await signInAsAgent(email.trim(), agentCode.trim(), password);
    setBusy(false);
    if (err) { setError(err); return; }
    // Success — hard navigate
    router.replace('/agent/home' as any);
  };

  const handleBiometricLogin = async () => {
    const ok = await promptBiometric();
    if (ok && bioEmail) {
      setEmail(bioEmail);
      Alert.alert('Biometric verified', 'Enter your password to continue.');
    } else {
      Alert.alert('Authentication failed', 'Try again or use password.');
    }
  };

  const offerBiometricSetup = async () => {
    if (!bioAvailable || !user) return;
    const enabled = await enableBiometric(user.email || '');
    if (enabled) {
      setBioEnabled(true);
      Alert.alert('Success', (bioType || 'Biometric') + ' login enabled.');
    }
  };


  // HYDRATE_COUNTRY: read user_profiles.country on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        if (!me) return;
        const { data } = await supabase
          .from('user_profiles')
          .select('country')
          .eq('user_id', me.id)
          .maybeSingle();
        const saved = data?.country;
        if (!saved) return;
        const current = useLocale.getState().country;
        if (current && current.name.toLowerCase() === saved.toLowerCase()) return;
        const info = ((ALL_COUNTRIES as any[]) || []).find((c: any) =>
          c.code === saved || c.name.toLowerCase() === saved.toLowerCase()
        );
        if (info) {
          await useLocale.getState().setCountry(info.code);
          console.log('[login] hydrated from DB:', info.code);
        }
      } catch (e) { console.warn('[login] hydrate failed', e); }
    })();
  }, []);

  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, useNativeDriver: false }),
      ])
    ).start();
  }, [glowAnim]);
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.35] });
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#ECFDF5', '#D1FAE5', '#ECFDF5']} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.glowHalo, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.topBar}>
            <Pressable onPress={() => setShowPicker(true)} style={styles.countryPill}>
              <Text style={styles.countryPillFlag}>{country ? countryFlag(country) : '🌍'}</Text>
              <Text style={styles.countryPillText}>{country || 'Global'}</Text>
              <Text style={styles.countryPillChev}>▾</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.brand}>GAIA</Text>
            <Text style={styles.tagline}>Your farm. Diagnosed.</Text>
            <Text style={styles.taglineSub}>AI agronomist · 152 diseases · 10+ crops</Text>
          </View>

          <View style={styles.tabBar}>
            {(['password', 'agent', 'google'] as Tab[]).map((tk) => (
              <Pressable
                key={tk}
                onPress={() => { try { Haptics.selectionAsync(); } catch {}; setTab(tk); setError(''); }}
                style={[styles.tabBtn, tab === tk && styles.tabBtnOn]}
              >
                <Text style={[styles.tabText, tab === tk && styles.tabTextOn]}>
                  {tk === 'password' ? 'Password' : tk === 'agent' ? 'Agent' : 'Google'}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'password' && (
            <View style={styles.form}>
              <Text style={styles.label}>EMAIL · PHONE · USERNAME</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  value={email} onChangeText={setEmail}
                  placeholder="you@example.com" placeholderTextColor={palette.textDim}
                  style={styles.input} autoCapitalize="none" keyboardType="email-address"
                  editable={!busy}
                />
              </View>

              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={palette.textDim}
                  style={styles.input} secureTextEntry={!showPw} editable={!busy}
                />
                <Pressable onPress={() => setShowPw(!showPw)} hitSlop={10}>
                  <Text style={styles.eyeBtn}>{showPw ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => router.push('/(auth)/forgot-password' as any)} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable onPress={handleLogin} disabled={busy || !email || !password}>
                <LinearGradient
                  colors={(busy || !email || !password) ? ['#E2E8F0', '#E2E8F0'] : ['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {busy ? <ActivityIndicator color="#060B18" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.ctaText}>SIGN IN</Text>
                      <Text style={styles.ctaArrow}>→</Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {tab === 'agent' && (
            <View style={styles.form}>
              <View style={styles.agentBadge}>
                <Text style={styles.agentBadgeIcon}>🏅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agentBadgeTitle}>EXTENSION AGENT</Text>
                  <Text style={styles.agentBadgeSub}>Register farmers · Earn ₦500 per verified</Text>
                </View>
              </View>

              <Text style={styles.label}>AGENT EMAIL</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  value={email} onChangeText={setEmail}
                  placeholder="agent@example.com" placeholderTextColor={palette.textDim}
                  style={styles.input} autoCapitalize="none" keyboardType="email-address" editable={!busy}
                />
              </View>

              <Text style={styles.label}>AGENT CODE</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  value={agentCode} onChangeText={(v) => setAgentCode(v.toUpperCase())}
                  placeholder="AGT-0001" placeholderTextColor={palette.textDim}
                  style={[styles.input, { letterSpacing: 3, fontWeight: '700' }]}
                  autoCapitalize="characters" editable={!busy}
                />
              </View>

              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={palette.textDim}
                  style={styles.input} secureTextEntry={!showPw} editable={!busy}
                />
                <Pressable onPress={() => setShowPw(!showPw)} hitSlop={10}>
                  <Text style={styles.eyeBtn}>{showPw ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable onPress={handleAgent} disabled={busy || !email || !agentCode || !password}>
                <LinearGradient
                  colors={(busy || !email || !agentCode || !password) ? ['#E2E8F0', '#E2E8F0'] : ['#FFD700', '#FFA000']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {busy ? <ActivityIndicator color="#060B18" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={[styles.ctaText, { color: '#060B18' }]}>SIGN IN AS AGENT</Text>
                      <Text style={[styles.ctaArrow, { color: '#060B18' }]}>→</Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => router.push('/agent-apply' as any)} style={styles.applyLink}>
                <Text style={styles.applyLinkText}>
                  Not an agent yet? <Text style={{ fontWeight: '900', color: '#FFD700' }}>Apply here →</Text>
                </Text>
              </Pressable>
            </View>
          )}

          {tab === 'google' && (
            <View style={styles.form}>
              <Text style={styles.googleHeading}>Continue with Google</Text>
              <Text style={styles.googleSub}>Skip the forms. Get 30 free scans instantly.</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable onPress={handleGoogle} style={styles.googleBtn} disabled={busy}>
                <View style={styles.googleInner}>
                  <Text style={styles.googleG}>G</Text>
                  {busy ? <ActivityIndicator color="#1F1F1F" /> : <Text style={styles.googleBtnText}>Continue with Google</Text>}
                </View>
              </Pressable>
            </View>
          )}

          <View style={styles.bottomCta}>
            <Text style={styles.bottomText}>
              New to GAIA?{' '}
              <Text style={styles.bottomLink} onPress={() => router.push('/(auth)/signup' as any)}>
                Create account →
              </Text>
            </Text>
          </View>

          <View style={styles.trustRow}>
            <Text style={styles.trustText}>🔒 NDPR</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>End-to-end</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>30 free scans</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setShowPicker(false)}>
              <Text style={styles.modalClose}>CLOSE</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Select Country</Text>
            <Text style={styles.modalSub}>{ALL_COUNTRIES.length} available</Text>
            <ScrollView>
              {ALL_COUNTRIES.slice().sort((a: any, b: any) => a.name.localeCompare(b.name)).map((c: any) => {
                const on = c.code === country;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => { setCountry(c.code); try { changeCountry(c.code); } catch {} setShowPicker(false); }}
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
  glowHalo: {
    position: 'absolute', top: -60, left: '50%',
    width: 260, height: 260, borderRadius: 130, marginLeft: -130,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 80, elevation: 10,
  },
  scroll: { paddingHorizontal: 22, paddingTop: 40, paddingBottom: 60 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  countryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  countryPillFlag: { fontSize: 16 },
  countryPillText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  countryPillChev: { fontSize: 10, color: '#10B981' },
  hero: { alignItems: 'center', marginTop: 24, marginBottom: 40 },
  brand: {
    fontSize: 72, fontWeight: '900', color: '#10B981', letterSpacing: 6,
    textShadowColor: 'rgba(16,185,129,0.35)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
    marginBottom: 8,
  },
  tagline: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  taglineSub: { fontSize: 12, color: '#64748B', marginTop: 8, letterSpacing: 0.4 },
  tabBar: {
    flexDirection: 'row', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)',
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabBtnOn: { backgroundColor: 'rgba(16,185,129,0.12)' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextOn: { color: '#10B981', fontWeight: '900' },
  form: {},
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#64748B', marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, paddingVertical: 14, color: '#0F172A', fontSize: 15 },
  eyeBtn: { fontSize: 16, padding: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, paddingVertical: 4 },
  forgotText: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    marginBottom: 16,
  },
  errorIcon: { fontSize: 16 },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '600' },
  cta: {
    paddingVertical: 18, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5 },
  ctaArrow: { fontSize: 18, color: '#FFFFFF', fontWeight: '900' },
  agentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    marginBottom: 20,
  },
  agentBadgeIcon: { fontSize: 28 },
  agentBadgeTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#D97706' },
  agentBadgeSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  applyLink: { alignItems: 'center', marginTop: 24, paddingVertical: 10 },
  applyLinkText: { fontSize: 13, color: '#64748B' },
  googleHeading: { fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 6 },
  googleSub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  googleBtn: {
    backgroundColor: '#FFFFFF', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleG: { fontSize: 22, fontWeight: '900', color: '#4285F4' },
  googleBtnText: { fontSize: 14, fontWeight: '800', color: '#1F1F1F' },
  bottomCta: { alignItems: 'center', marginTop: 32, marginBottom: 12 },
  bottomText: { fontSize: 14, color: '#64748B' },
  bottomLink: { color: '#10B981', fontWeight: '900' },
  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  trustText: { fontSize: 10, color: '#94A3B8' },
  trustDot: { fontSize: 10, color: '#94A3B8' },
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
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 4,
  },
  countryRowOn: { backgroundColor: 'rgba(16,185,129,0.1)' },
  countryRowFlag: { fontSize: 26 },
  countryRowName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  countryRowMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
});
