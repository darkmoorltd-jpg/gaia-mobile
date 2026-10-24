import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, typography } from '../../src/theme';
import { useLocale, langName, flagEmoji } from '../../src/store/locale';

export default function LanguageSelect() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const country = useLocale((s) => s.country);
  const setLanguage = useLocale((s) => s.setLanguage);
  const [search, setSearch] = useState('');

  if (!country) { router.replace('/(auth)/country-select' as any); return null; }

  const ALL_LANGS = ['en','fr','pt','ar','sw','ha','yo','ig','pcm','tw','am','so','zu','af','rw','mg','sn','es','de','it','nl','el','pl','sv','no','da','uk','ru','tr','fa','he','ur','hi','bn','zh','ja','ko','th','vi','id','ms','fil'];
  // Show country's native languages first, then all
  const local = (country.languages || []).filter((c: string) => ALL_LANGS.includes(c));
  const others = ALL_LANGS.filter((c: string) => !local.includes(c));
  const codes = [...local, ...others];
  const filtered = search.trim()
    ? codes.filter((c) => langName(c).toLowerCase().includes(search.toLowerCase()))
    : codes;

  const pick = async (code: string) => {
    await setLanguage(code);
    router.replace('/(auth)/login' as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>{flagEmoji(country.code)}</Text>
        <Text style={styles.title}>{country.name}</Text>
        <Text style={styles.subtitle}>Pick the language you'd like GAIA to speak to you in.</Text>
        {codes.length > 4 ? (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search language…"
            placeholderTextColor={palette.textDim}
            style={styles.search}
            autoCapitalize="none"
          />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {filtered.map((code) => {
          const recommended = code === country.default_language;
          return (
            <Pressable
              key={code}
              onPress={() => pick(code)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.name}>{langName(code)}</Text>
                  {recommended ? <Text style={styles.chip}>RECOMMENDED</Text> : null}
                </View>
                <Text style={styles.meta}>{code.toUpperCase()}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: p.border },
  brand: { fontSize: 34, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 6, lineHeight: 19 },
  search: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: p.text },
  chip: { fontSize: 9, fontWeight: '800', color: p.neon, letterSpacing: 1, backgroundColor: 'rgba(0,255,136,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  meta: { fontSize: 10, color: p.textMuted, marginTop: 2, letterSpacing: 1 },
  chevron: { fontSize: 22, color: p.textDim },
});
