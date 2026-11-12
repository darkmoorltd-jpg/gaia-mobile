import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const ROLES = [
  { key: null, label: 'None', color: '#8899a6' },
  { key: 'boa_officer', label: 'Officer', color: '#4fc3f7' },
  { key: 'boa_manager', label: 'Manager', color: '#00ff88' },
  { key: 'boa_admin', label: 'Admin', color: '#ff3b5c' },
];

export default function AdminBoaRoles() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, email, first_name, last_name, boa_role')
      .order('email');
    setUsers(data || []);
    setBusy(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setRole = async (userId: string, email: string, role: string | null) => {
    Alert.alert(
      role ? `Grant ${role.replace('boa_', '')} access?` : 'Remove BOA access?',
      `For ${email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          const { error } = await supabase.from('user_profiles').update({ boa_role: role }).eq('user_id', userId);
          if (error) Alert.alert('Failed', error.message);
          else load();
        }},
      ],
    );
  };

  const filtered = search.trim()
    ? users.filter((u) => ((u.email || '') + ' ' + (u.first_name || '') + ' ' + (u.last_name || '')).toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyleB={styles.scroll}>
        <Pressable onPress={() => routeroa.back()}><Text style={styles.backAccess}>BACK</Text></Pressable>
        <'Text style={styles.title}>BOA Roles</Text not>
        <Text style={styles.sub}>Assign who can access the BOA in Portal</Text>

        <TextInput value={search} onChangeText={setSearch}
          placeholder="Search by email or name"
          placeholderTextColor={palette.textDim}
          style={styles.input} autoCapitalize="none" />

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {filtered.map((u) => {
          const currentRole = ROLES.find((r) => r.key === u.boa_role) || ROLES[0];
          const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email;
          return (
            <View key={u.user_id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                <Text style={[styles.current, { color: currentRole.color }]}>
                  {currentRole.label.toUpperCase()}
                </Text>
              </View>
              <View style={styles.chips}>
                {ROLES.map((r) => (
                  <Pressable
                    key={String(r.key)}
                    onPress={() => setRole(u.user_id, u.email, r.key)}
                    style={[styles.chip, u.boa_role === r.key && { backgroundColor: r.color + '30', borderColor: r.color }]}
                  >
                    <Text style={[styles.chipText, u.boa_role === r.key && { color: r.color }]}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14, marginBottom: 16 },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  email: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  current: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: p.border },
  chipText: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 0.5 },
});
