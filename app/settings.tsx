import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput,
  Alert, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme';
import { useLocale, langName } from '../src/store/locale';
import { useAuth } from '../src/store/auth';
import { useThemeMode, ThemeMode } from '../src/store/themeMode';

const ALL_LANGUAGES: { code: string; region: string }[] = [
  { code: 'en', region: 'Global' },
  { code: 'fr', region: 'Africa / Europe' },
  { code: 'pt', region: 'Africa / Europe' },
  { code: 'ar', region: 'Africa / Middle East' },
  { code: 'sw', region: 'Africa' },
  { code: 'ha', region: 'Nigeria' },
  { code: 'yo', region: 'Nigeria' },
  { code: 'ig', region: 'Nigeria' },
  { code: 'pcm', region: 'Nigeria' },
  { code: 'tw', region: 'Ghana' },
  { code: 'am', region: 'Ethiopia' },
  { code: 'so', region: 'Somalia' },
  { code: 'zu', region: 'South Africa' },
  { code: 'af', region: 'South Africa' },
  { code: 'rw', region: 'Rwanda' },
  { code: 'mg', region: 'Madagascar' },
  { code: 'sn', region: 'Zimbabwe' },
  { code: 'es', region: 'Americas / Europe' },
  { code: 'de', region: 'Europe' },
  { code: 'it', region: 'Europe' },
  { code: 'nl', region: 'Europe' },
  { code: 'el', region: 'Europe' },
  { code: 'pl', region: 'Europe' },
  { code: 'sv', region: 'Europe' },
  { code: 'no', region: 'Europe' },
  { code: 'da', region: 'Europe' },
  { code: 'uk', region: 'Europe' },
  { code: 'ru', region: 'Europe / Asia' },
  { code: 'tr', region: 'Asia / Europe' },
  { code: 'fa', region: 'Middle East' },
  { code: 'he', region: 'Middle East' },
  { code: 'ur', region: 'South Asia' },
  { code: 'hi', region: 'South Asia' },
  { code: 'bn', region: 'South Asia' },
  { code: 'zh', region: 'Asia' },
  { code: 'ja', region: 'Asia' },
  { code: 'ko', region: 'Asia' },
  { code: 'th', region: 'Southeast Asia' },
  { code: 'vi', region: 'Southeast Asia' },
  { code: 'id', region: 'Southeast Asia' },
  { code: 'ms', region: 'Southeast Asia' },
  { code: 'fil', region: 'Southeast Asia' },
];

export default function Settings() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(palette);
  const system = useColorScheme();

  const currentLang = useLocale((s) => s.language);
  const setLanguage = useLocale((s) => s.setLanguage);
  const signOut = useAuth((s) => s.signOut);

  const themeMode = useThemeMode((s) => s.mode);
  const setThemeMode = useThemeMode((s) => s.setMode);

  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? ALL_LANGUAGES.filter((l) => langName(l.code).toLowerCase().includes(search.toLowerCase()))
    : ALL_LANGUAGES;

  const grouped = filtered.reduce((acc, l) => {
    (acc[l.region] = acc[l.region] || []).push(l);
    return acc;
  }, {} as Record<string, typeof ALL_LANGUAGES>);

  const pickLang = async (code: string) => {
    await setLanguage(code);
    setLangOpen(false);
  };

  const pickTheme = async (m: ThemeMode) => {
    await setThemeMode(m);
    setThemeOpen(false);
  };

  const themeLabel = (m: ThemeMode) =>
    m === 'dark' ? t('theme.dark') : m === 'light' ? t('theme.light') : t('theme.auto');

  const doSignOut = () => {
    Alert.alert(t('common.signOut'), t('common.signOut') + '?', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('profile.items.settings')}</Text>

        <Text style={styles.section}>{t('profile.items.settings').toUpperCase()}</Text>

        <Pressable onPress={() => setLangOpen(true)} style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.items.language')}</Text>
          <Text style={styles.rowValue}>{langName(currentLang || 'en')} ›</Text>
        </Pressable>

        <Text style={styles.section}>{t('theme.label').toUpperCase()}</Text>
        <Pressable onPress={() => setThemeOpen(true)} style={styles.row}>
          <Text style={styles.rowLabel}>{t('theme.label')}</Text>
          <Text style={styles.rowValue}>{themeLabel(themeMode)} ›</Text>
        </Pressable>

        <Text style={styles.section}>{t('settings.sections.account').toUpperCase()}</Text>
        <Pressable onPress={() => router.push('/profile')} style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.items.myAccount')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/verification')} style={styles.row}>
          <Text style={styles.rowLabel}>{t('profile.items.verification')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>

        <Text style={styles.section}>{t('settings.sections.support').toUpperCase()}</Text>
        <Pressable onPress={() => router.push('/help')} style={styles.row}>
          <Text style={styles.rowLabel}>{t('profile.items.helpSupport')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>

        <Text style={styles.section}>{t('settings.sections.about').toUpperCase()}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.items.appVersion')}</Text>
          <Text style={styles.rowValue}>v{Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.items.buildHash')}</Text>
          <Text style={styles.rowValue}>{(Constants.expoConfig?.extra?.buildHash || 'dev').slice(0, 7)}</Text>
        </View>

        <Text style={styles.section}>{t('settings.sections.privacy').toUpperCase()}</Text>
        <Pressable onPress={() => router.push('/help' as any)} style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.items.privacyPolicy')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/help' as any)} style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.items.terms')}</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>

        <Pressable onPress={doSignOut} style={[styles.row, { borderColor: palette.danger }]}>
          <Text style={[styles.rowLabel, { color: palette.danger, fontWeight: '800' }]}>
            {t('common.signOut')}
          </Text>
        </Pressable>

        <Text style={styles.version}>
          GAIA v{Constants.expoConfig?.version || '1.0.0'} · build {(Constants.expoConfig?.extra?.buildHash || 'dev').slice(0, 7)}
        </Text>
      </ScrollView>

      {/* LANGUAGE PICKER MODAL */}
      <Modal visible={langOpen} animationType="slide" transparent onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setLangOpen(false)}><Text style={styles.back}>{t('common.close').toUpperCase()}</Text></Pressable>
            <Text style={styles.title}>{t('settings.sections.language')}</Text>
            <Text style={styles.sub}>{ALL_LANGUAGES.length} {t('settings.items.language')}</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('onboarding.searchLanguage')}
              placeholderTextColor={palette.textDim}
              style={styles.search}
              autoCapitalize="none"
            />
            <ScrollView>
              {Object.entries(grouped).map(([region, langs]) => (
                <View key={region}>
                  <Text style={styles.regionHeader}>{region.toUpperCase()}</Text>
                  {langs.map((l) => (
                    <Pressable
                      key={l.code}
                      onPress={() => pickLang(l.code)}
                      style={[styles.langRow, l.code === currentLang && styles.langRowActive]}
                    >
                      <Text style={[styles.langName, l.code === currentLang && styles.langNameActive]}>
                        {langName(l.code)}
                      </Text>
                      {l.code === currentLang ? <Text style={styles.check}>✓</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* THEME PICKER MODAL */}
      <Modal visible={themeOpen} animationType="slide" transparent onRequestClose={() => setThemeOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setThemeOpen(false)}><Text style={styles.back}>{t('common.close').toUpperCase()}</Text></Pressable>
            <Text style={styles.title}>{t('theme.label')}</Text>
            <Text style={styles.sub}>{t('theme.choose')}</Text>

            {(['dark', 'light', 'auto'] as ThemeMode[]).map((m) => {
              const active = themeMode === m;
              const desc = m === 'dark' ? t('theme.darkDesc') : m === 'light' ? t('theme.lightDesc') : t('theme.autoDesc') + (system ? ' (' + system + ')' : '');
              return (
                <Pressable
                  key={m}
                  onPress={() => pickTheme(m)}
                  style={[styles.themeRow, active && styles.themeRowActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langName, active && styles.langNameActive]}>
                      {themeLabel(m)}
                    </Text>
                    <Text style={styles.themeDesc}>{desc}</Text>
                  </View>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
            <View style={{ height: 40 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: p.textMuted, marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 14, backgroundColor: p.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  rowLabel: { fontSize: 15, color: p.text, fontWeight: '600' },
  rowValue: { fontSize: 14, color: p.neon, fontWeight: '700' },
  version: { fontSize: 10, color: p.textDim, textAlign: 'center', marginTop: 40, letterSpacing: 1 },
  search: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 12 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '94%' },
  regionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  langRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  langRowActive: { backgroundColor: 'rgba(0,255,136,0.08)' },
  langName: { fontSize: 15, color: p.text },
  langNameActive: { color: p.neon, fontWeight: '800' },
  check: { fontSize: 16, color: p.neon, fontWeight: '900' },
  themeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  themeRowActive: { backgroundColor: 'rgba(0,255,136,0.08)' },
  themeDesc: { fontSize: 12, color: p.textMuted, marginTop: 2 },
});
