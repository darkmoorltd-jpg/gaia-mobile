import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, Linking,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';
import { useAuth } from '../src/store/auth';
import {
  listMyGroups, getGroupDetail, createGroup, joinGroup,
  startCycle, contribute, approveContribution, triggerPayout,
  removeMember, leaveGroup, isVerified,
  fmtN, fmtDate, fmtDateTime,
  FREQUENCIES, VARIANTS,
  type Group, type GroupDetail,
} from '../src/utils/rosca';

type Screen = 'list' | 'detail';

export default function SavingsGroups() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);

  const [screen, setScreen] = useState<Screen>('list');
  const [groups, setGroups] = useState<Group[]>([]);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cFreq, setCFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [cMembers, setCMembers] = useState('10');
  const [cVariant, setCVariant] = useState('esusu');
  const [cState, setCState] = useState('');
  const [cLga, setCLga] = useState('');

  // Join modal
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // PIN modal (for contribute)
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const v = await isVerified();
      setVerified(v);
      const list = await listMyGroups();
      setGroups(list);
    } catch (e: any) {
      Alert.alert('Load failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, [user]);

  const loadDetail = useCallback(async (groupId: string) => {
    setBusy(true);
    try {
      const d = await getGroupDetail(groupId);
      setDetail(d);
      setScreen('detail');
    } catch (e: any) {
      Alert.alert('Detail failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
      setRef(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRef(true);
    if (screen === 'detail' && detail?.group?.id) {
      loadDetail(detail.group.id);
    } else {
      load();
    }
  };

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', code);
  };

  const shareWhatsApp = (g: any) => {
    const msg = 'Join my GAIA savings group "' + g.name + '" — code ' + g.invite_code +
      '. Contribute ' + fmtN(g.contribution_amount) + ' ' + g.frequency + ' via GAIA app.';
    Linking.openURL('whatsapp://send?text=' + encodeURIComponent(msg));
  };

  const onCreate = async () => {
    if (!verified) {
      Alert.alert('Verify first', 'Complete KYC in Profile → Verification', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify', onPress: () => router.push('/verification' as any) },
      ]);
      return;
    }
    const amt = parseFloat(cAmount);
    if (!cName.trim()) { Alert.alert('Name required'); return; }
    if (!amt || amt < 100) { Alert.alert('Minimum N100'); return; }
    const members = parseInt(cMembers) || 10;
    if (members < 2 || members > 50) { Alert.alert('Members must be 2-50'); return; }

    setActionBusy(true);
    try {
      const r = await createGroup({
        name: cName.trim(),
        amount: amt,
        frequency: cFreq,
        cycle_members: members,
        variant: cVariant,
        state: cState.trim() || undefined,
        lga: cLga.trim() || undefined,
      });
      setCreateOpen(false);
      setCName(''); setCAmount(''); setCState(''); setCLga('');
      Alert.alert('Group created', 'Invite code: ' + r.invite_code);
      load();
    } catch (e: any) {
      Alert.alert('Create failed', e?.message || 'Try again');
    } finally {
      setActionBusy(false);
    }
  };

  const onJoin = async () => {
    if (!verified) {
      Alert.alert('Verify first', 'Complete KYC to join a savings group', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify', onPress: () => router.push('/verification' as any) },
      ]);
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code) { Alert.alert('Enter invite code'); return; }
    setActionBusy(true);
    try {
      const r = await joinGroup(code);
      setJoinOpen(false);
      setJoinCode('');
      Alert.alert('Joined', 'You are position ' + r.position);
      load();
    } catch (e: any) {
      Alert.alert('Join failed', e?.message || 'Check the code');
    } finally {
      setActionBusy(false);
    }
  };

  const onStartCycle = () => {
    if (!detail) return;
    Alert.alert('Start the cycle?',
      'This locks in the payout order and opens round 1. Members will not be able to join after this.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'START', onPress: async () => {
          setActionBusy(true);
          try {
            await startCycle(detail.group.id);
            Alert.alert('Cycle started');
            loadDetail(detail.group.id);
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Try again');
          } finally {
            setActionBusy(false);
          }
        }},
      ],
    );
  };

  const onContributePress = () => {
    setPin('');
    setPinOpen(true);
  };

  const onContributeConfirm = async () => {
    if (!detail) return;
    if (!/^[0-9]{4,8}$/.test(pin)) { Alert.alert('Enter PIN'); return; }
    setActionBusy(true);
    try {
      const r = await contribute(detail.group.id, pin);
      setPinOpen(false);
      setPin('');
      Alert.alert('Paid', 'Round ' + r.round + '. ' + fmtN(r.amount) +
        (r.penalty > 0 ? ' + ' + fmtN(r.penalty) + ' penalty' : '') +
        '\nNew wallet balance ' + fmtN(r.balance, 2));
      loadDetail(detail.group.id);
    } catch (e: any) {
      Alert.alert('Payment failed', e?.message || 'Try again');
    } finally {
      setActionBusy(false);
    }
  };

  const onApprove = (contributionId: number, email: string | null) => {
    Alert.alert('Approve?', 'Confirm ' + (email || 'member') + ' paid this round', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        try {
          await approveContribution(contributionId);
          if (detail) loadDetail(detail.group.id);
        } catch (e: any) { Alert.alert('Failed', e?.message || ''); }
      }},
    ]);
  };

  const onPayout = () => {
    if (!detail) return;
    Alert.alert('Trigger payout?',
      'The current escrow will be sent to the next member in rotation.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'PAYOUT', onPress: async () => {
          setActionBusy(true);
          try {
            const r = await triggerPayout(detail.group.id);
            Alert.alert('Payout sent', fmtN(r.amount) + ' delivered');
            loadDetail(detail.group.id);
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Try again');
          } finally {
            setActionBusy(false);
          }
        }},
      ],
    );
  };

  const onRemoveMember = (userId: string, email: string | null) => {
    if (!detail) return;
    Alert.alert('Remove member?',
      (email || 'This member') + ' will be refunded what they paid and removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          setActionBusy(true);
          try {
            await removeMember(detail.group.id, userId);
            loadDetail(detail.group.id);
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Try again');
          } finally {
            setActionBusy(false);
          }
        }},
      ],
    );
  };

  const onLeave = () => {
    if (!detail) return;
    Alert.alert('Leave group?',
      'You will be refunded everything you have paid so far.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          setActionBusy(true);
          try {
            const r = await leaveGroup(detail.group.id);
            Alert.alert('Left', 'Refunded ' + fmtN(r.refund, 2));
            setScreen('list');
            setDetail(null);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Try again');
          } finally {
            setActionBusy(false);
          }
        }},
      ],
    );
  };

  const isOwner = detail && user && detail.group.owner_id === user.id;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={onRefresh} tintColor={palette.neon} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            if (screen === 'detail') { setScreen('list'); setDetail(null); }
            else router.back();
          }}
        >
          <Text style={styles.backText}>{'< BACK'}</Text>
        </Pressable>

        <Pill label="Ajo / Esusu / Adashe" />
        <Text style={styles.title}>Savings Groups</Text>
        <Text style={styles.subtitle}>
          Rotating savings — everyone contributes, one collects per round
        </Text>

        {verified === false ? (
          <Pressable onPress={() => router.push('/verification' as any)} style={styles.kycWarn}>
            <Text style={styles.kycWarnTitle}>KYC REQUIRED</Text>
            <Text style={styles.kycWarnText}>
              Verify your identity to create or join savings groups. Tap here to start.
            </Text>
          </Pressable>
        ) : null}

        {busy && !detail && groups.length === 0 ? (
          <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} />
        ) : null}

        {screen === 'list' ? (
          <>
            <View style={styles.actions}>
              <NeonButton
                label="+ NEW GROUP"
                onPress={() => verified === false ? Alert.alert('Verify first') : setCreateOpen(true)}
                style={{ flex: 1 }}
              />
              <NeonButton
                label="JOIN"
                variant="ghost"
                onPress={() => verified === false ? Alert.alert('Verify first') : setJoinOpen(true)}
                style={{ flex: 1 }}
              />
            </View>

            <Text style={styles.section}>MY GROUPS ({groups.length})</Text>
            {groups.length === 0 && !busy ? (
              <GlassCard>
                <Text style={styles.empty}>
                  No groups yet. Create one or join with an invite code.
                </Text>
              </GlassCard>
            ) : (
              groups.map((g) => (
                <Pressable key={g.id} onPress={() => loadDetail(g.id)} style={{ marginBottom: 10 }}>
                  <GlassCard>
                    <View style={styles.rowBetween}>
                      <Text style={styles.groupName}>{g.name}</Text>
                      <View style={[styles.statusPill, {
                        backgroundColor: g.status === 'active' ? 'rgba(0,255,136,0.15)' :
                          g.status === 'completed' ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.06)',
                      }]}>
                        <Text style={[styles.statusText, {
                          color: g.status === 'active' ? '#00ff88' :
                            g.status === 'completed' ? '#4fc3f7' : palette.textMuted,
                        }]}>{g.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.groupAmount}>
                      {fmtN(g.contribution_amount)} / {g.frequency}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.groupMeta}>{g.members}/{g.cycle_members} members</Text>
                      <Text style={styles.groupMeta}>·</Text>
                      <Text style={styles.groupMeta}>Pool {fmtN(g.contribution_amount * g.cycle_members)}</Text>
                    </View>
                    {g.escrow > 0 ? (
                      <Text style={styles.escrowLine}>
                        Escrow: {fmtN(g.escrow, 2)} held for next payout
                      </Text>
                    ) : null}
                  </GlassCard>
                </Pressable>
              ))
            )}
          </>
        ) : null}

        {screen === 'detail' && detail ? (
          <>
            <GlassCard style={{ marginTop: 16 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.groupName}>{detail.group.name}</Text>
                <View style={[styles.statusPill, {
                  backgroundColor: detail.group.status === 'active' ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.06)',
                }]}>
                  <Text style={[styles.statusText, { color: detail.group.status === 'active' ? '#00ff88' : palette.textMuted }]}>
                    {detail.group.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.groupAmount}>
                {fmtN(detail.group.contribution_amount)} / {detail.group.frequency}
              </Text>
              <Text style={styles.groupPool}>
                Pool per round: {fmtN(detail.group.contribution_amount * detail.group.cycle_members)}
              </Text>

              {detail.group.status === 'draft' ? (
                <Pressable onPress={() => copyCode(detail.group.invite_code)} style={styles.codeBox}>
                  <Text style={styles.codeLabel}>INVITE CODE — TAP TO COPY</Text>
                  <Text style={styles.codeVal}>{detail.group.invite_code}</Text>
                </Pressable>
              ) : null}

              <NeonButton label="SHARE VIA WHATSAPP" onPress={() => shareWhatsApp(detail.group)} style={{ marginTop: 12 }} />
            </GlassCard>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{detail.members.filter(m => m.status === 'active').length}/{detail.group.cycle_members}</Text>
                <Text style={styles.statLbl}>MEMBERS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>
                  {fmtN(detail.wallet?.escrow || 0)}
                </Text>
                <Text style={styles.statLbl}>ESCROW</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>
                  #{detail.members.find(m => m.user_id === user?.id)?.position || '—'}
                </Text>
                <Text style={styles.statLbl}>YOUR TURN</Text>
              </View>
            </View>

            {isOwner && detail.group.status === 'draft' ? (
              <NeonButton
                label={detail.members.length === detail.group.cycle_members ? 'START CYCLE' : 'WAITING FOR MEMBERS (' + detail.members.length + '/' + detail.group.cycle_members + ')'}
                onPress={onStartCycle}
                disabled={detail.members.length !== detail.group.cycle_members}
                loading={actionBusy}
              />
            ) : null}

            {detail.group.status === 'active' && detail.members.some(m => m.user_id === user?.id && m.status === 'active') ? (
              <NeonButton
                label="PAY MY CONTRIBUTION"
                onPress={onContributePress}
                loading={actionBusy}
                style={{ marginTop: 12 }}
              />
            ) : null}

            {isOwner && detail.group.status === 'active' ? (
              <View style={styles.ownerActions}>
                <NeonButton
                  label="TRIGGER PAYOUT"
                  variant="ghost"
                  onPress={onPayout}
                  disabled={actionBusy || (detail.wallet?.escrow || 0) < detail.group.contribution_amount * detail.group.cycle_members * 0.5}
                />
              </View>
            ) : null}

            {!isOwner && detail.group.status === 'active' && detail.members.some(m => m.user_id === user?.id && m.status === 'active') ? (
              <Pressable onPress={onLeave} style={styles.leaveBtn}>
                <Text style={styles.leaveText}>Leave group (get refund)</Text>
              </Pressable>
            ) : null}

            <Text style={styles.section}>MEMBER ORDER ({(detail.members || []).length})</Text>
            {(detail.members || []).map((m) => {
              const isMe = m.user_id === user?.id;
              const canRemove = isOwner && !isMe && !m.has_collected && m.status === 'active' && detail.group.status !== 'completed';
              return (
                <GlassCard key={m.user_id} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.posBadge, m.has_collected && styles.posBadgeDone, m.status !== 'active' && { opacity: 0.4 }]}>
                      <Text style={styles.posText}>{m.position}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {m.name || m.email}{isMe ? ' (you)' : ''}
                      </Text>
                      <Text style={styles.memberSub}>
                        {m.has_collected ? 'Collected ' + fmtDate(m.collected_at) :
                         m.status === 'removed' ? 'Removed' :
                         m.status === 'exited' ? 'Exited' :
                         'Waiting · paid ' + fmtN(m.total_paid)}
                      </Text>
                      {m.due_date && !m.has_collected && m.status === 'active' ? (
                        <Text style={styles.memberDue}>Due {fmtDate(m.due_date)}</Text>
                      ) : null}
                    </View>
                    {canRemove ? (
                      <Pressable onPress={() => onRemoveMember(m.user_id, m.email)} style={styles.removeBtn}>
                        <Text style={styles.removeTxt}>REMOVE</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>
              );
            })}

            <Text style={styles.section}>RECENT CONTRIBUTIONS ({(detail.contributions || []).length})</Text>
            {(detail.contributions || []).length === 0 ? (
              <Text style={styles.empty}>No contributions yet.</Text>
            ) : (detail.contributions || []).slice(0, 30).map((c) => (
              <View key={c.id} style={styles.contribRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contribEmail} numberOfLines={1}>{c.email || 'member'}</Text>
                  <Text style={styles.contribMeta}>
                    Round {c.round} · {fmtDateTime(c.paid_at)}
                    {c.penalty > 0 ? ' · penalty ' + fmtN(c.penalty) : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.contribAmount}>{fmtN(c.amount)}</Text>
                  {c.approved ? (
                    <Text style={styles.approvedTag}>APPROVED</Text>
                  ) : isOwner ? (
                    <Pressable onPress={() => onApprove(c.id, c.email)} style={styles.approveBtn}>
                      <Text style={styles.approveTxt}>APPROVE</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.pendingTag}>PENDING</Text>
                  )}
                </View>
              </View>
            ))}

            <Text style={styles.section}>ACTIVITY LOG</Text>
            {(detail.events || []).slice(0, 20).map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventKind}>{e.kind.replace(/_/g, ' ').toUpperCase()}</Text>
                  <Text style={styles.eventTime}>{fmtDateTime(e.created_at)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>New Savings Group</Text>

            <Text style={styles.label}>GROUP NAME</Text>
            <TextInput value={cName} onChangeText={setCName} style={styles.input} placeholder="e.g. Farmers of Kano" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>CONTRIBUTION AMOUNT (N)</Text>
            <TextInput value={cAmount} onChangeText={setCAmount} keyboardType="number-pad" style={styles.input} placeholder="5000" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>FREQUENCY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FREQUENCIES.map((f) => (
                <Pressable key={f} onPress={() => setCFreq(f)} style={[styles.chip, cFreq === f && styles.chipActive]}>
                  <Text style={[styles.chipText, cFreq === f && styles.chipTextActive]}>{f.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>TRADITION</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {VARIANTS.map((v) => (
                <Pressable key={v.key} onPress={() => setCVariant(v.key)} style={[styles.chip, cVariant === v.key && styles.chipActive]}>
                  <Text style={[styles.chipText, cVariant === v.key && styles.chipTextActive]}>{v.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>NUMBER OF MEMBERS (2-50)</Text>
            <TextInput value={cMembers} onChangeText={setCMembers} keyboardType="number-pad" style={styles.input} />

            <Text style={styles.label}>STATE (OPTIONAL)</Text>
            <TextInput value={cState} onChangeText={setCState} style={styles.input} placeholder="Kaduna" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>LGA (OPTIONAL)</Text>
            <TextInput value={cLga} onChangeText={setCLga} style={styles.input} placeholder="Zaria" placeholderTextColor={palette.textDim} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onCreate} disabled={actionBusy} style={[styles.saveBtn, actionBusy && { opacity: 0.5 }]}>
                {actionBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.saveText}>Create</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* JOIN MODAL */}
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
              <Pressable onPress={onJoin} disabled={actionBusy} style={[styles.saveBtn, actionBusy && { opacity: 0.5 }]}>
                {actionBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.saveText}>Join</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PIN MODAL */}
      <Modal visible={pinOpen} transparent animationType="fade" onRequestClose={() => setPinOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Contribution</Text>
            <Text style={styles.pinSub}>
              {detail ? fmtN(detail.group.contribution_amount) + ' from your wallet' : ''}
            </Text>
            <Text style={styles.label}>4-DIGIT WALLET PIN</Text>
            <TextInput
              value={pin}
              onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 8))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="••••"
              placeholderTextColor={palette.textDim}
              style={[styles.input, { fontSize: 22, letterSpacing: 12, textAlign: 'center' }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setPinOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onContributeConfirm} disabled={actionBusy} style={[styles.saveBtn, actionBusy && { opacity: 0.5 }]}>
                {actionBusy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.saveText}>Pay</Text>}
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
  backText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: 6, marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  section: { ...typography.micro, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  groupName: { fontSize: 18, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  groupAmount: { fontSize: 15, color: p.neon, fontWeight: '800', marginTop: 6 },
  groupPool: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  groupMeta: { fontSize: 11, color: p.textMuted },
  escrowLine: { fontSize: 11, color: '#ffb300', marginTop: 6, fontWeight: '700' },
  empty: { color: p.textMuted, textAlign: 'center', padding: 20 },
  codeBox: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center' },
  codeLabel: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5 },
  codeVal: { fontSize: 24, fontWeight: '900', color: p.neon, letterSpacing: 6, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 },
  statBox: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, color: p.textMuted, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
  ownerActions: { marginTop: 10 },
  leaveBtn: { marginTop: 12, padding: 14, alignItems: 'center' },
  leaveText: { fontSize: 12, color: '#ff3b5c', fontWeight: '800' },
  posBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: p.surface, borderWidth: 2, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  posBadgeDone: { backgroundColor: p.neonSoft, borderColor: p.neon },
  posText: { color: p.text, fontWeight: '900' },
  memberEmail: { color: p.text, fontWeight: '700', fontSize: 13 },
  memberSub: { color: p.textMuted, fontSize: 11, marginTop: 2 },
  memberDue: { color: '#ffb300', fontSize: 10, marginTop: 3, fontWeight: '700' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ff3b5c' },
  removeTxt: { fontSize: 9, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  contribRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  contribEmail: { color: p.text, fontWeight: '700', fontSize: 12 },
  contribMeta: { color: p.textMuted, fontSize: 10, marginTop: 2 },
  contribAmount: { fontSize: 14, fontWeight: '900', color: p.neon },
  approvedTag: { fontSize: 8, fontWeight: '900', color: '#00ff88', marginTop: 3, letterSpacing: 1 },
  pendingTag: { fontSize: 8, fontWeight: '900', color: '#ffb300', marginTop: 3, letterSpacing: 1 },
  approveBtn: { marginTop: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#00ff88' },
  approveTxt: { fontSize: 8, fontWeight: '900', color: '#00ff88', letterSpacing: 1 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.neon },
  eventKind: { fontSize: 11, fontWeight: '800', color: p.text, letterSpacing: 0.5 },
  eventTime: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  kycWarn: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,179,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', marginBottom: 16 },
  kycWarnTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#ffb300' },
  kycWarnText: { fontSize: 12, color: p.text, marginTop: 6, lineHeight: 17 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: p.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: p.borderHi },
  modalTitle: { fontSize: 22, fontWeight: '900', color: p.text, marginBottom: 12 },
  pinSub: { fontSize: 13, color: p.textMuted, marginBottom: 16 },
  label: { ...typography.micro, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipText: { color: p.textMuted, fontWeight: '800', fontSize: 11 },
  chipTextActive: { color: p.obsidian },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  cancelText: { color: p.text, fontWeight: '800' },
  saveBtn: { flex: 2, padding: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  saveText: { color: p.obsidian, fontWeight: '900' },
});
