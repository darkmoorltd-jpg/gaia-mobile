import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import {
  loadPreferences, savePreferences, DEFAULT_PREFS, fmtN, type WalletPrefs,
} from '../src/utils/wallet';

const LANGS = [
  { k: 'en', label: 'English' },
  { k: 'ha', label: 'Hausa' },
  { k: 'yo', label: 'Yoruba' },
  { k: 'ig', label: 'Igbo' },
  { k: 'pcm', label: 'Pidgin' },
];

const CURRENCIES = [
  { k: 'NGN', label: 'Naira (N)' },
  { k: 'USD', label: 'US Dollar ($)' },
  { k: 'GBP', label: 'Pound (£)' },
];

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const LIMITS = [20000, 50000, 100000, 200000];

export default function WalletPreferences() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [prefs, setPrefs] = useState<WalletPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await loadPreferences();
      setPrefs(p);
      setBusy(false);
    })();
  }, []);

  const update = (k: keyof WalletPrefs, v: any) => setPrefs((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await savePreferences(prefs);
      Alert.alert('Saved', 'Preferences updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  if (busy) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Wallet Preferences</Text>
        <Text style={styles.sub}>Notifications, limits, and formats</Text>

        {/* Language */}
        <Text style={styles.label}>LANGUAGE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {LANGS.map((l) => (
            <Pressable key={l.k} onPress={() => update('language', l.k)} style={[styles.chip, prefs.language === l.k && styles.chipOn]}>
              <Text style={[styles.chipText, prefs.language === l.k && styles.chipTextOn]}>{l.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Currency */}
        <Text style={styles.label}>DISPLAY CURRENCY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {CURRENCIES.map((c) => (
            <Pressable key={c.k} onPress={() => update('currency', c.k)} style={[styles.chip, prefs.currency === c.k && styles.chipOn]}>
              <Text style={[styles.chipText, prefs.currency === c.k && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Date format */}
        <Text style={styles.label}>DATE FORMAT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {DATE_FORMATS.map((d) => (
            <Pressable key={d} onPress={() => update('date_format', d)} style={[styles.chip, prefs.date_format === d && styles.chipOn]}>
              <Text style={[styles.chipText, prefs.date_format === d && styles.chipTextOn]}>{d}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Daily limit */}
        <Text style={styles.label}>DAILY SEND LIMIT</Text>
        <Text style={styles.helper}>Applies to transfers out. Resets each day.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {LIMITS.map((v) => (
            <Pressable key={v} onPress={() => update('daily_limit_naira', v)} style={[styles.chip, prefs.daily_limit_naira === v && styles.chipOn]}>
              <Text style={[styles.chipText, prefs.daily_limit_naira === v && styles.chipTextOn]}>{fmtN(v, 0)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Toggles */}
        <Text style={styles.label}>NOTIFICATIONS</Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Transaction SMS</Text>
            <Text style={styles.toggleSub}>Get a text for every wallet movement</Text>
          </View>
          <Switch
            value={prefs.receipt_sms}
            onValueChange={(v) => update('receipt_sms', v)}
            trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
            thumbColor={prefs.receipt_sms ? palette.neon : '#888'}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Email Receipt</Text>
            <Text style={styles.toggleSub}>Email PDF receipt for each transaction</Text>
          </View>
          <Switch
            value={prefs.receipt_email}
            onValueChange={(v) => update('receipt_email', v)}
            trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
            thumbColor={prefs.receipt_email ? palette.neon : '#888'}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Push Notifications</Text>
            <Text style={styles.toggleSub}>In-app alerts when money moves</Text>
          </View>
          <Switch
            value={prefs.notify_txn_push}
            onValueChange={(v) => update('notify_txn_push', v)}
            trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
            thumbColor={prefs.notify_txn_push ? palette.neon : '#888'}
          />
        </View>

        <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
          {saving ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.saveBtnTxt}>SAVE PREFERENCES</Text>}
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  helper: { fontSize: 11, color: p.textMuted, marginTop: -4, marginBottom: 10 },
  chipScroll: { gap: 6, paddingRight: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 12, fontWeight: '800', color: p.textMuted },
  chipTextOn: { color: p.neon },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  toggleTitle: { fontSize: 13, fontWeight: '800', color: p.text },
  toggleSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  saveBtn: { marginTop: 28, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
});
