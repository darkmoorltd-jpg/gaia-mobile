import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Image, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function AdminUser360() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [tab, setTab] = useState<'ndfr' | 'wallet' | 'ai' | 'store'>('ndfr');

  const search = async () => {
    if (query.length < 3) return;
    setSearching(true);
    // Search via profiles
    const { data: res } = await supabase.from('user_profiles')
      .select('user_id, first_name, last_name, email, phone, verification_status')
      .or(`first_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10);
    setUsers(res || []);
    setSearching(false);
  };

  const load360 = async (u: any) => {
    setSelected(u);
    setLoading360(true);
    setTab('ndfr');
    const { data: res, error } = await supabase.rpc('admin_get_user_360', { p_user_id: u.user_id });
    if (!error) setData(res);
    setLoading360(false);
  };

  if (!selected) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>User 360</Text>
          <Text style={styles.sub}>Search by name, phone, or email</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder="e.g. Musa, 080..." placeholderTextColor={palette.textDim} style={[styles.input, { flex: 1, marginBottom: 0 }]} />
            <Pressable onPress={search} style={styles.searchBtn}>
              {searching ? <ActivityIndicator color="#000" /> : <Text style={styles.searchTxt}>FIND</Text>}
            </Pressable>
          </View>

          {users.map(u => {
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown';
            return (
              <Pressable key={u.user_id} onPress={() => load360(u)} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boldText}>{name}</Text>
                  <Text style={styles.text}>{u.email} · {u.phone}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const reg = data?.registry || {};
  const prof = data?.profile || {};
  const ver = data?.verification || {};

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>← BACK TO SEARCH</Text></Pressable>
        <Text style={styles.title}>{reg.full_name || prof.first_name || 'User'}</Text>
        <Text style={styles.sub}>{prof.email} · {prof.phone}</Text>

        {loading360 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {data ? (
          <>
            <View style={styles.tabBar}>
              {(['ndfr', 'wallet', 'ai', 'store'] as const).map(t => (
                <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
                  <Text style={[styles.tabTxt, tab === t && { color: '#000' }]}>{t.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            {/* NDFR TAB */}
            {tab === 'ndfr' && (
              <>
                <Text style={styles.sectionLabel}>IDENTITY & KYC</Text>
                <View style={styles.card}>
                  <Text style={styles.kv}><Text style={styles.k}>NIN: </Text>{prof.nin || ver.id_number || '—'}</Text>
                  <Text style={styles.kv}><Text style={styles.k}>BVN: </Text>{prof.bvn || '—'}</Text>
                  <Text style={styles.kv}><Text style={styles.k}>KYC Status: </Text>{prof.verification_status?.toUpperCase()}</Text>
                </View>

                <Text style={styles.sectionLabel}>FARM & REGISTRY DATA</Text>
                <View style={styles.card}>
                  <Text style={styles.kv}><Text style={styles.k}>Category: </Text>{reg.farmer_category} ({reg.farmer_subcategory})</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Farm Size: </Text>{reg.farm_size_acres} acres ({reg.farm_size_scale})</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Location: </Text>{reg.lga}, {reg.state} {reg.ward ? `(Ward: ${reg.ward})` : ''}</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Tenure: </Text>{reg.land_tenure}</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Household: </Text>{reg.household_size} people</Text>
                  <Text style={styles.kv}><Text style={styles.k}>Literacy: </Text>Level {reg.literacy_level}</Text>
                </View>

                <Text style={styles.sectionLabel}>IMAGES & DOCUMENTS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 10, marginBottom: 20 }}>
                  {ver.id_image_url && (
                    <Pressable onPress={() => Linking.openURL(ver.id_image_url)}><View style={styles.imgBox}><Image source={{ uri: ver.id_image_url }} style={styles.img} /><Text style={styles.imgLbl}>ID CARD</Text></View></Pressable>
                  )}
                  {ver.selfie_url && (
                    <Pressable onPress={() => Linking.openURL(ver.selfie_url)}><View style={styles.imgBox}><Image source={{ uri: ver.selfie_url }} style={styles.img} /><Text style={styles.imgLbl}>SELFIE</Text></View></Pressable>
                  )}
                  {reg.asset_photo_url && (
                    <Pressable onPress={() => Linking.openURL(reg.asset_photo_url)}><View style={styles.imgBox}><Image source={{ uri: reg.asset_photo_url }} style={styles.img} /><Text style={styles.imgLbl}>FARM ASSET</Text></View></Pressable>
                  )}
                  {reg.farmer_portrait_url && (
                    <Pressable onPress={() => Linking.openURL(reg.farmer_portrait_url)}><View style={styles.imgBox}><Image source={{ uri: reg.farmer_portrait_url }} style={styles.img} /><Text style={styles.imgLbl}>PORTRAIT</Text></View></Pressable>
                  )}
                </ScrollView>
              </>
            )}

            {/* WALLET TAB */}
            {tab === 'wallet' && (
              <>
                <Text style={styles.sectionLabel}>TRANSACTION HISTORY</Text>
                {(data.payments || []).map((p: any, i: number) => (
                  <View key={i} style={styles.card}>
                    <Text style={styles.boldText}>₦{Number(p.amount).toLocaleString()}</Text>
                    <Text style={styles.text}>{p.plan} · {p.reference}</Text>
                    <Text style={styles.dimText}>{new Date(p.paid_at).toLocaleString()}</Text>
                  </View>
                ))}
                {(data.payments || []).length === 0 && <Text style={styles.dimText}>No payments yet.</Text>}
              </>
            )}

            {/* AI TAB */}
            {tab === 'ai' && (
              <>
                <Text style={styles.sectionLabel}>SCANS REMAINING: {data.scans}</Text>
                <Text style={styles.sectionLabel}>CHAT HISTORY</Text>
                {(data.chats || []).map((c: any, i: number) => (
                  <View key={i} style={styles.card}>
                    <Text style={styles.boldText}>{c.count} messages</Text>
                    <Text style={styles.dimText}>{new Date(c.updated_at).toLocaleString()}</Text>
                  </View>
                ))}
                {(data.chats || []).length === 0 && <Text style={styles.dimText}>No chats yet.</Text>}
              </>
            )}

            {/* STORE TAB */}
            {tab === 'store' && (
              <>
                <Text style={styles.sectionLabel}>MARKETPLACE LISTINGS</Text>
                {(data.listings || []).map((l: any, i: number) => (
                  <View key={i} style={styles.card}>
                    <Text style={styles.boldText}>{l.title}</Text>
                    <Text style={styles.text}>₦{Number(l.price).toLocaleString()} · {l.quantity} {l.unit}</Text>
                  </View>
                ))}
                {(data.listings || []).length === 0 && <Text style={styles.dimText}>No listings yet.</Text>}
              </>
            )}
          </>
        ) : null}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border },
  searchBtn: { backgroundColor: p.neon, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  searchTxt: { fontSize: 12, fontWeight: '900', color: '#000' },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  boldText: { fontSize: 15, fontWeight: '900', color: p.text },
  text: { fontSize: 13, color: p.textMuted, marginTop: 4 },
  dimText: { fontSize: 11, color: p.textDim, marginTop: 4 },
  kv: { fontSize: 13, color: p.text, marginBottom: 6 },
  k: { color: p.textMuted, fontWeight: '700' },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 20, backgroundColor: p.surface, padding: 4, borderRadius: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: p.neon },
  tabTxt: { fontSize: 10, fontWeight: '800', color: p.textMuted },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  imgBox: { width: 120, marginRight: 10 },
  img: { width: 120, height: 120, borderRadius: 10, backgroundColor: p.surface },
  imgLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, textAlign: 'center', marginTop: 4 },
  chevron: { fontSize: 22, color: p.textDim },
});
