import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/api/supabase';
import { useTheme, spacing, typography } from '../../src/theme';
import { useLocale, flagEmoji, regionGroup, CountryInfo } from '../../src/store/locale';

export default function CountrySelect() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const setCountry = useLocale((s) => s.setCountry);

  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('countries')
          .select('code,name,region,currency,currency_symbol,languages,default_language,payment_provider')
          .eq('enabled', true)
          .order('launch_order');
        if (error) {
          console.warn('countries query error:', error.message);
          setErrorMsg('Could not load country list: ' + error.message);
        }
        if (!data || data.length === 0) {
          setErrorMsg('No countries returned. Check Supabase config.');
        }
        setCountries((data as any) || []);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Network error');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const pick = async (c: CountryInfo) => {
    await setCountry(c);
    router.replace('/(auth)/language-select' as any);
  };

  const filtered = search.trim()
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()))
    : countries;

  const order = ['Africa', 'Europe', 'Middle East', 'Asia', 'Americas', 'Oceania', 'Other'];
  const groups: Record<string, CountryInfo[]> = {};
  filtered.forEach((c) => {
    const g = regionGroup(c.region);
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>GAIA</Text>
        <Text style={styles.title}>Where are you farming?</Text>
        <Text style={styles.subtitle}>Choose your country to personalise payments, currency, and language.</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search country…"
          placeholderTextColor={palette.textDim}
          style={styles.search}
          autoCapitalize="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {errorMsg ? (
          <View style={{ margin: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,59,92,0.15)', borderWidth: 1, borderColor: '#ff3b5c' }}>
            <Text style={{ color: '#ff3b5c', fontWeight: '700', fontSize: 13 }}>⚠️ {errorMsg}</Text>
            <Text style={{ color: '#8899a6', fontSize: 11, marginTop: 6 }}>Countries: {countries.length}</Text>
          </View>
        ) : null}
        {order.filter((g) => groups[g]).map((group) => (
          <View key={group}>
            <Text style={styles.sectionLabel}>{group.toUpperCase()}</Text>
            {groups[group].map((c) => (
              <Pressable
                key={c.code}
                onPress={() => pick(c)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.flag}>{flagEmoji(c.code)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.meta}>{c.currency} · {c.currency_symbol} · {c.payment_provider}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: p.border },
  brand: { fontSize: 28, fontWeight: '900', color: p.neon, letterSpacing: 6, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 6, lineHeight: 19 },
  search: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 16, paddingBottom: 40 },
  sectionLabel: { ...typography.micro, color: p.textMuted, marginTop: 20, marginBottom: 8, letterSpacing: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  flag: { fontSize: 30 },
  name: { fontSize: 15, fontWeight: '700', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: p.textDim },
});
