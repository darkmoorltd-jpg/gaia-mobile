import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const CONTRIBUTION_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

interface Group {
  id: string;
  name: string;
  contribution_amount: number;
  frequency: string;
  cycle_members: number;
  currency: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

interface Member {
  user_id: string;
  email: string;
  joined_at: string;
  position: number;
  has_collected: boolean;
}

interface Contribution {
  id: number;
  group_id: string;
  user_id: string;
  amount: number;
  paid_at: string;
  round: number;
}

export default function SavingsGroups() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);

  // create flow
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [cycleMembers, setCycleMembers] = useState('10');

  // join flow
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('savings_groups')
      .select('*')
      .order('created_at', { ascending: false });
    setGroups(data || []);
  };

  const loadGroupDetail = async (g: Group) => {
    setActiveGroup(g);
    const { data: m } = await supabase
      .from('savings_group_members')
      .select('user_id, joined_at, position, has_collected, user_profiles(email)')
      .eq('group_id', g.id)
      .order('position', { ascending: true });
    setMembers(
      (m || []).map((row: any) => ({
        user_id: row.user_id,
        email: row.user_profiles?.email || 'unknown',
        joined_at: row.joined_at,
        position: row.position,
        has_collected: row.has_collected,
      }))
    );

    const { data: c } = await supabase
      .from('savings_contributions')
      .select('*')
      .eq('group_id', g.id)
      .order('paid_at', { ascending: false })
      .limit(100);
    setContributions(c || []);
  };

  const createGroup = async () => {
    if (!user) return;
    if (!name.trim()) return Alert.alert('Name required');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid amount');

    const invite = Math.random().toString(36).slice(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from('savings_groups')
      .insert({
        name: name.trim(),
        contribution_amount: amt,
        frequency,
        cycle_members: parseInt(cycleMembers) || 10,
        currency: 'NGN',
        owner_id: user.id,
        invite_code: invite,
      })
      .select()
      .single();

    if (error || !data) {
      Alert.alert('Create failed', error?.message || 'unknown');
      return;
    }

    // Add owner as first member
    await supabase.from('savings_group_members').insert({
      group_id: data.id,
      user_id: user.id,
      position: 1,
    });

    setCreateOpen(false);
    setName(''); setAmount('');
    await load();
    Alert.alert('Group created', 'Invite code: ' + invite + '\\n\\nShare it with friends to join.');
  };

  const joinGroup = async () => {
    if (!user) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) return Alert.alert('Enter invite code');

    const { data: g } = await supabase
      .from('savings_groups')
      .select('*')
      .eq('invite_code', code)
      .single();

    if (!g) return Alert.alert('Group not found');

    const { data: existing } = await supabase
      .from('savings_group_members')
      .select('user_id')
      .eq('group_id', g.id)
      .eq('user_id', user.id);

    if (existing && existing.length > 0) {
      Alert.alert('Already a member');
      setJoinOpen(false);
      return;
    }

    const { count } = await supabase
      .from('savings_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id);

    const nextPos = (count || 0) + 1;
    await supabase.from('savings_group_members').insert({
      group_id: g.id,
      user_id: user.id,
      position: nextPos,
    });

    setJoinOpen(false);
    setJoinCode('');
    await load();
    Alert.alert('Joined!', 'You are position ' + nextPos + ' in the payout order.');
  };

  const contribute = async (g: Group) => {
    if (!user) return;

    // Which round are we in?
    const { count } = await supabase
      .from('savings_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id);
    const round = Math.floor((count || 0) / g.cycle_members) + 1;

    // Record contribution
    await supabase.from('savings_contributions').insert({
      group_id: g.id,
      user_id: user.id,
      amount: g.contribution_amount,
      round,
    });

    // Check if round complete (everyone paid)
    const { count: roundCount } = await supabase
      .from('savings_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id)
      .eq('round', round);

    if ((roundCount || 0) >= g.cycle_members) {
      // Payout to the member at this position
      const nextToCollect = members.find((m) => !m.has_collected);
      if (nextToCollect) {
        await supabase.from('savings_group_members')
          .update({ has_collected: true })
          .eq('group_id', g.id)
          .eq('user_id', nextToCollect.user_id);
        Alert.alert(
          'Round ' + round + ' complete',
          'Payout of N' + (g.contribution_amount * g.cycle_members).toLocaleString() + ' goes to ' + nextToCollect.email
        );
      }
    }

    await loadGroupDetail(g);
    Alert.alert('Paid', 'Contribution of N' + g.contribution_amount.toLocaleString() + ' recorded');
  };

  const shareInvite = (g: Group) => {
    const msg = 'Join my GAIA savings group "' + g.name + '" — code ' + g.invite_code + '. Contribute N' + g.contribution_amount + ' ' + g.frequency + ' via GAIA app.';
    Linking.openURL('whatsapp://send?text=' + encodeURIComponent(msg));
  };

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Code ' + code + ' copied');
  };

  // Total pool value
  const poolTotal = activeGroup
    ? activeGroup.contribution_amount * activeGroup.cycle_members
    : 0;

  const userPosition = members.findIndex((m) => m.user_id === user?.id) + 1;
  const myContributions = contributions.filter((c) => c.user_id === user?.id);
  const totalPaid = myContributions.reduce((s, c) => s + c.amount, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Ajo / Esusu" />
        <Text style={styles.title}>Savings Groups</Text>
        <Text style={styles.subtitle}>
          Digital ROSCA — everyone contributes, one collects per round
        </Text>

        {activeGroup ? (
          <>
            <Pressable onPress={() => setActiveGroup(null)} style={styles.back}>
              <Text style={styles.backText}>{'< ALL GROUPS'}</Text>
            </Pressable>

            <GlassCard style={{ marginTop: 16 }}>
              <Text style={styles.groupName}>{activeGroup.name}</Text>
              <Text style={styles.groupAmount}>
                N{activeGroup.contribution_amount.toLocaleString()} / {activeGroup.frequency}
              </Text>
              <Text style={styles.groupPool}>
                Pool per round: N{poolTotal.toLocaleString()}
              </Text>
              <Pressable onPress={() => copyCode(activeGroup.invite_code)} style={styles.codeBox}>
                <Text style={styles.codeLabel}>INVITE CODE</Text>
                <Text style={styles.codeVal}>{activeGroup.invite_code}</Text>
              </Pressable>
              <NeonButton label="SHARE INVITE" onPress={() => shareInvite(activeGroup)} style={{ marginTop: 12 }} />
            </GlassCard>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{members.length}/{activeGroup.cycle_members}</Text>
                <Text style={styles.statLbl}>MEMBERS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>#{userPosition || '—'}</Text>
                <Text style={styles.statLbl}>YOUR TURN</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>N{totalPaid.toLocaleString()}</Text>
                <Text style={styles.statLbl}>YOU PAID</Text>
              </View>
            </View>

            <NeonButton label="I PAID THIS ROUND" onPress={() => contribute(activeGroup)} />

            <Text style={styles.section}>MEMBER ORDER</Text>
            {members.map((m, i) => (
              <GlassCard key={m.user_id} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.posBadge, m.has_collected && styles.posBadgeDone]}>
                  <Text style={styles.posText}>{m.position}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberEmail} numberOfLines={1}>{m.email}</Text>
                  <Text style={styles.memberSub}>
                    {m.has_collected ? 'Collected' : 'Waiting'} · joined {new Date(m.joined_at).toLocaleDateString()}
                  </Text>
                </View>
              </GlassCard>
            ))}

            <Text style={styles.section}>RECENT CONTRIBUTIONS</Text>
            {contributions.slice(0, 20).map((c) => (
              <GlassCard key={c.id} style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.contribAmount}>N{c.amount.toLocaleString()}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.contribRound}>Round {c.round}</Text>
                <Text style={styles.contribDate}>
                  {new Date(c.paid_at).toLocaleDateString()}
                </Text>
              </GlassCard>
            ))}
          </>
        ) : (
          <>
            <View style={styles.actions}>
              <NeonButton label="+ NEW GROUP" onPress={() => setCreateOpen(true)} style={{ flex: 1 }} />
              <NeonButton label="JOIN" variant="ghost" onPress={() => setJoinOpen(true)} style={{ flex: 1 }} />
            </View>

            <Text style={styles.section}>MY GROUPS</Text>
            {groups.length === 0 ? (
              <GlassCard>
                <Text style={styles.empty}>No groups yet. Create or join one to start saving.</Text>
              </GlassCard>
            ) : (
              groups.map((g) => (
                <Pressable key={g.id} onPress={() => loadGroupDetail(g)} style={{ marginBottom: 10 }}>
                  <GlassCard>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.groupName}>{g.name}</Text>
                      <Text style={styles.freqTag}>{g.frequency.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.groupAmount}>
                      N{g.contribution_amount.toLocaleString()} per {g.frequency}
                    </Text>
                    <Text style={styles.groupPool}>
                      Pool: N{(g.contribution_amount * g.cycle_members).toLocaleString()}
                    </Text>
                  </GlassCard>
                </Pressable>
              ))
            )}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ---- CREATE MODAL ---- */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Savings Group</Text>

            <Text style={styles.label}>GROUP NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="e.g. Farmers of Kano" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>CONTRIBUTION (N)</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={styles.input} placeholder="5000" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>FREQUENCY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CONTRIBUTION_FREQUENCIES.map((f) => (
                <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.chip, frequency === f && styles.chipActive]}>
                  <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>NUMBER OF MEMBERS</Text>
            <TextInput value={cycleMembers} onChangeText={setCycleMembers} keyboardType="number-pad" style={styles.input} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createGroup} style={styles.saveBtn}>
                <Text style={styles.saveText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---- JOIN MODAL ---- */}
      <Modal visible={joinOpen} transparent animationType="fade" onRequestClose={() => setJoinOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join a Group</Text>
            <Text style={styles.label}>INVITE CODE</Text>
            <TextInput
              value={joinCode}
              onChangeText={(v) => setJoinCode(v.toUpperCase())}
              style={[styles.input, { letterSpacing: 4, textAlign: 'center', fontSize: 22, fontWeight: '900' }]}
              placeholder="ABC123"
              placeholderTextColor={palette.textDim}
              autoCapitalize="characters"
              maxLength={6}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setJoinOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={joinGroup} style={styles.saveBtn}>
                <Text style={styles.saveText}>Join</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: 6, marginBottom: 20 },
  back: { marginTop: 10 },
  backText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  groupName: { fontSize: 18, fontWeight: '800', color: p.text },
  groupAmount: { fontSize: 15, color: p.neon, fontWeight: '800', marginTop: 6 },
  groupPool: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  freqTag: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  empty: { color: p.textMuted, textAlign: 'center', padding: 20 },
  codeBox: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center' },
  codeLabel: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5 },
  codeVal: { fontSize: 24, fontWeight: '900', color: p.neon, letterSpacing: 6, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 },
  statBox: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 10, color: p.textMuted, fontWeight: '600', marginTop: 4 },
  posBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: p.surface, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  posBadgeDone: { backgroundColor: p.neonSoft, borderColor: p.neon },
  posText: { color: p.text, fontWeight: '900' },
  memberEmail: { color: p.text, fontWeight: '600', fontSize: 13 },
  memberSub: { color: p.textMuted, fontSize: 11, marginTop: 2 },
  contribAmount: { fontSize: 15, fontWeight: '900', color: p.neon },
  contribRound: { fontSize: 11, color: p.textMuted, marginRight: 10 },
  contribDate: { fontSize: 11, color: p.textDim },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: p.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: p.borderHi },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginBottom: 20 },
  label: { ...typography.micro, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipText: { color: p.textMuted, fontWeight: '800', fontSize: 11 },
  chipTextActive: { color: p.obsidian },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  cancelText: { color: p.text, fontWeight: '800' },
  saveBtn: { flex: 2, padding: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  saveText: { color: p.obsidian, fontWeight: '900' },
});
