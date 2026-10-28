import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { categoryLabel } from '../../src/data/input_categories';

export default function ProviderProfile() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const signOut = useAuth((s: any) => s.signOut);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data: d } = await supabase.from('input_providers').select('*').eq('user_id', (await supabase.auth.getUser()).data.user?.id).maybeSingle();
      if (d) setData(d);
    } catch {}
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = () => {
    Alert.alert('Sign out?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Text style={styles.title}>Business Profile</Text>
        {busy && !data ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}
        {data && (
          <>
            <Text style={styles.section}>BUSINESS</Text>
            <Row l="Name" v={data.business_name} styles={styles} />
            <Row l="Reg. Number" v={data.business_reg_number || '—'} styles={styles} />
            <Row l="Status" v={String(data.status || '').toUpperCase()} styles={styles} />
            <Row l="Categories" v={(data.categories || []).map(categoryLabel).join(', ') || '—'} styles={styles} />
            <Row l="Description" v={data.description || '—'} styles={styles} />

            <Text style={styles.section}>CONTACT</Text>
            <Row l="Email" v={data.email || '—'} styles={styles} />
            <Row l="Phone" v={data.phone || '—'} styles={styles} />
            <Row l="WhatsApp" v={data.whatsapp || '—'} styles={styles} />

            <Text style={styles.section}>ADDRESS</Text>
            <Row l="State" v={data.state || '—'} styles={styles} />
            <Row l="LGA" v={data.lga || '—'} styles={styles} />
            <Row l="City" v={data.city || '—'} styles={styles} />
            <Row l="Address" v={data.address || '—'} styles={styles} />

            <Text style={styles.section}>BANK (for payouts)</Text>
            <Row l="Bank" v={data.bank_name || '—'} styles={styles} />
            <Row l="Account #" v={data.bank_account_number || '—'} styles={styles} />
            <Row l="Account name" v={data.bank_account_name || '—'} styles={styles} />
          </>
        )}

        <Pressable onPress={() => router.push('/provider/wallet' as any)} style={[styles.logout, { borderColor: '#b388ff', marginTop: 20 }]}>
          <Text style={[styles.logoutText, { color: '#b388ff' }]}>VIEW WALLET →</Text>
        </Pressable>
        <Pressable onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </Pressable>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function Row({ l, v, styles }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{l}</Text>
      <Text style={styles.rowV} numberOfLines={3}>{v}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff', marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowL: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, flex: 1.5, textAlign: 'right', fontWeight: '600' },
  logout: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.danger, alignItems: 'center', marginTop: 30 },
  logoutText: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.danger },
});
