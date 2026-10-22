import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { useTranslation } from 'react-i18next';
import { useLocale, countryFlag } from '../../src/store/locale';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const pickCountry = useLocale((s) => s.country?.code || '');
  const pickLanguage = useLocale((s) => s.language);
  const countriesList = useLocale((s) => s.countries);
  const currentCountry = useLocale((s) => s.country || (s as any).countries?.find((c: any) => c.code === s.country?.code) || null);

  // If country is null (state not yet hydrated), load it
  useEffect(() => {
    if (!currentCountry) {
      useLocale.getState().load();
    }
  }, [currentCountry]);

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
    try { router.replace('/(tabs)' as any); } catch {}
    if (err) setError(err);
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


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.leaf}>GAIA</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue protecting your farm</Text>

        <View style={styles.tabs}>
          {([
            { k: 'password', label: 'EMAIL' },
            { k: 'google', label: 'GOOGLE' },
            { k: 'agent', label: 'AGENT' },
          ] as { k: Tab; label: string }[]).map((t) => (
            <Pressable
              key={t.k}
              onPress={() => { setTab(t.k); setError(''); }}
              style={[styles.tab, tab === t.k && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === t.k && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'password' ? (
          <>
            
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Dropdown label="COUNTRY" value={pickCountry} options={((countriesList?.length ?? 0) > 0 ? countriesList!.map((c) => ({ label: countryFlag(c.code) + ' ' + c.name, value: c.code })) : [{ label: countryFlag(pickCountry || 'NG') + ' ' + (currentCountry?.name || 'Select country'), value: pickCountry || 'NG' }])} onChange={(v) => { useLocale.getState().setCountry(v); }} />
            </View>
            <View style={{ flex: 1 }}>
              <Dropdown label="LANGUAGE" value={pickLanguage} options={[{ label: 'English', value: 'en' }, { label: 'Fran\u00e7ais', value: 'fr' }, { label: 'Portugu\u00eas', value: 'pt' }, { label: 'Espa\u00f1ol', value: 'es' }, { label: 'Deutsch', value: 'de' }, { label: 'Italiano', value: 'it' }, { label: 'Nederlands', value: 'nl' }, { label: 'Kiswahili', value: 'sw' }, { label: 'Hausa', value: 'ha' }, { label: 'Yor\u00f9b\u00e1', value: 'yo' }, { label: 'Igbo', value: 'ig' }, { label: 'Naij\u00e1', value: 'pcm' }]} onChange={(v) => { useLocale.getState().setLanguage(v); }} />
            </View>
          </View>
<Text style={styles.label}>EMAIL OR PHONE</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
                placeholder="you@example.com or 08031234567" placeholderTextColor={palette.textDim}
                style={styles.input}
              />
            </View>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={password} onChangeText={setPassword}
                secureTextEntry placeholder={t('password')}
                placeholderTextColor={palette.textDim} style={styles.input}
              />
            </View>
            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'flex-end', marginTop: -6, marginBottom: 12 }}
            >
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={handleLogin}
              disabled={busy || !email || !password}
              style={[styles.cta, (busy || !email || !password) && { opacity: 0.4 }]}
            >
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>{t('signin_button')}</Text>}
            </Pressable>
            {bioAvailable && bioEnabled ? (
              <Pressable onPress={handleBiometricLogin} style={styles.bioBtn}>
                <Text style={styles.bioText}>USE {(bioType || 'BIOMETRIC').toUpperCase()}</Text>
              </Pressable>
            ) : null}
            {bioAvailable && !bioEnabled && user ? (
              <Pressable onPress={offerBiometricSetup} style={styles.bioBtnOutline}>
                <Text style={styles.bioTextOutline}>ENABLE {(bioType || 'BIOMETRIC').toUpperCase()}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {tab === 'google' ? (
          <>
            <Text style={styles.googleIntro}>
              Use your Google account to sign in instantly. No password to remember.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={handleGoogle} disabled={busy} style={[styles.googleBtn, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#4285F4" /> : (
                <View style={styles.googleInner}>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleText}>CONTINUE WITH GOOGLE</Text>
                </View>
              )}
            </Pressable>
            <Text style={styles.googleFoot}>
              You will be redirected to Google. Sign in and you'll return to GAIA automatically.
            </Text>
          </>
        ) : null}

        {tab === 'agent' ? (
          <>
            <Text style={styles.googleIntro}>
              Extension agents and support staff use their assigned agent code to sign in.
            </Text>
            <Text style={styles.label}>AGENT EMAIL</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
                placeholder="agent@example.com" placeholderTextColor={palette.textDim}
                style={styles.input}
              />
            </View>
            <Text style={styles.label}>AGENT CODE</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={agentCode} onChangeText={(v) => setAgentCode(v.toUpperCase())}
                autoCapitalize="characters"
                placeholder="GAIA-AG-0001" placeholderTextColor={palette.textDim}
                style={styles.input}
              />
            </View>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={password} onChangeText={setPassword}
                secureTextEntry placeholder="password"
                placeholderTextColor={palette.textDim} style={styles.input}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={handleAgent}
              disabled={busy || !email || !agentCode || !password}
              style={[styles.cta, (busy || !email || !agentCode || !password) && { opacity: 0.4 }]}
            >
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SIGN IN AS AGENT</Text>}
            </Pressable>

        {/* DEBUG-BAR */}
        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#111', borderRadius: 8 }}>
          <Text style={{ color: '#0f0', fontSize: 9, fontFamily: 'monospace' }}>
            DEBUG ctx={loginContext || '-'} role={role || '-'} user={user?.email?.slice(0,20) || 'none'}
          </Text>
        </View>
          </>
        ) : null}

        <Pressable onPress={() => router.push('/agent-apply' as any)} style={{ marginTop: 12 }}>
          <Text style={[styles.signup, { color: palette.neon }]}>Want to become an agent? Apply here</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/signup')} style={{ marginTop: 24 }}>
          <Text style={styles.signup}>Don't have an account? Sign up</Text>
        </Pressable>
        <View style={{ height: 60 }} />
              <Pressable onPress={() => router.push('/agent-apply' as any)} style={{ marginTop: 24, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={[styles.signup, { color: palette.neon, fontWeight: '700' }]}>
            Want to become a GAIA agent? Apply here
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  leaf: { fontSize: 40, fontWeight: '900', color: p.neon, letterSpacing: 8, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: p.textMuted, marginTop: 6 },
  tabs: { flexDirection: 'row', marginTop: 28, marginBottom: 24, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: p.textMuted },
  tabTextOn: { color: p.neon },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  inputWrap: { borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 14 },
  input: { paddingVertical: 14, color: p.text, fontSize: 15 },
  error: { color: p.danger, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  forgot: { fontSize: 12, color: p.neon, fontWeight: '700' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 15, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  googleIntro: { fontSize: 13, color: p.textMuted, lineHeight: 20, marginBottom: 20 },
  googleBtn: { padding: 18, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleIcon: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleText: { fontSize: 14, fontWeight: '900', color: '#1f1f1f', letterSpacing: 0.5 },
  googleFoot: { fontSize: 11, color: p.textMuted, textAlign: 'center', marginTop: 14, lineHeight: 16 },
  bioBtn: { marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  bioText: { color: p.neon, fontWeight: '900', letterSpacing: 1 },
  bioBtnOutline: { marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  bioTextOutline: { color: p.text, fontWeight: '700', letterSpacing: 1 },
  signup: { color: p.textMuted, textAlign: 'center', fontSize: 14 },
});
