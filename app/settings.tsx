import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, typography, spacing, radius } from '../src/theme';
import { LANGUAGES, findLanguage } from '../src/utils/languages';

const LANG_KEY = 'gaia.language';

export default function Settings() {
  const { palette, mode, setMode } = useTheme();
  const styles = createStyles(palette);

  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [bio, setBio] = useState(true);
  const [location, setLocation] = useState(true);
  const [langCode, setLangCode] = useState('en');
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => { if (v) setLangCode(v); });
  }, []);

  const changeLanguage = async (code: string) => {
    setLangCode(code);
    await AsyncStorage.setItem(LANG_KEY, code);
    setLangOpen(false);
  };

  const currentLang = findLanguage(langCode);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>Dark mode</Text>
              <Text style={styles.rowHint}>Currently {mode === "dark" ? "ON" : "OFF"}</Text>
            </View>
            <Switch value={mode === "dark"} onValueChange={(v) => setMode(v ? "dark" : "light")} trackColor={{ true: palette.neon, false: palette.textDim }} thumbColor="#fff" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>LANGUAGE</Text>
        <View style={styles.card}>
          <Pressable onPress={() => setLangOpen(true)} style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>App Language</Text>
              <Text style={styles.rowHint}>{currentLang.name} — {currentLang.nativeName}</Text>
            </View>
            <Text style={styles.chevron}>{">"}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Switch value={push} onValueChange={setPush} trackColor={{ true: palette.neon, false: palette.textDim }} thumbColor="#fff" />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>SMS Alerts</Text>
            <Switch value={sms} onValueChange={setSms} trackColor={{ true: palette.neon, false: palette.textDim }} thumbColor="#fff" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>PRIVACY AND SECURITY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Biometric Lock</Text>
            <Switch value={bio} onValueChange={setBio} trackColor={{ true: palette.neon, false: palette.textDim }} thumbColor="#fff" />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Location Access</Text>
            <Switch value={location} onValueChange={setLocation} trackColor={{ true: palette.neon, false: palette.textDim }} thumbColor="#fff" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.aboutLine}>GAIA Mobile</Text>
          <Text style={styles.aboutSub}>Version 1.0.0</Text>
          <Text style={styles.aboutSub}>Powered by Darkmoor Ltd</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setLangOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>App Language</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable onPress={() => changeLanguage(item.code)} style={[styles.langRow, item.code === langCode && styles.langRowActive]}>
                  <View>
                    <Text style={styles.langName}>{item.name}</Text>
                    <Text style={styles.langNative}>{item.nativeName}</Text>
                  </View>
                  {item.code === langCode ? <Text style={styles.langCheck}>V</Text> : null}
                </Pressable>
              )}
            />
            <Pressable onPress={() => setLangOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.obsidian },
    scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
    title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginBottom: spacing.xl },
    sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
    card: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: spacing.lg },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
    rowLabel: { ...typography.body, color: palette.text, fontWeight: '600' },
    rowHint: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
    chevron: { color: palette.neon, fontSize: 22, fontWeight: '900' },
    aboutLine: { ...typography.body, color: palette.text, fontWeight: '700', paddingTop: spacing.md },
    aboutSub: { ...typography.caption, color: palette.textMuted, marginTop: 6, paddingBottom: spacing.sm },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: palette.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: palette.borderHi, maxHeight: '75%' },
    modalTitle: { fontSize: 22, fontWeight: '900', color: palette.text, marginBottom: 16 },
    langRow: { padding: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    langRowActive: { backgroundColor: palette.neonSoft, borderColor: palette.borderHi },
    langName: { color: palette.text, fontWeight: '700', fontSize: 15 },
    langNative: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
    langCheck: { color: palette.neon, fontSize: 20, fontWeight: '900' },
    modalClose: { padding: 16, borderRadius: 14, backgroundColor: palette.surface, alignItems: 'center', marginTop: 10 },
    modalCloseText: { color: palette.text, fontWeight: '800' },
  });
