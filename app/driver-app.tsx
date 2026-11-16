import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Modal, Image, Linking, Platform, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { startBackgroundTracking, stopBackgroundTracking } from '../src/utils/backgroundLocation';
import { DRIVER_AGREEMENT } from '../src/legal/content';

type Tab = 'home' | 'wallet' | 'profile';

export default function DriverApp() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const user = useAuth((s: any) => s.user);

  const [tab, setTab] = useState<Tab>('home');
  const [isOnline, setIsOnline] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [offerCountdown, setOfferCountdown] = useState(0);
  const [wallet, setWallet] = useState<{ balance: number; transfers: any[] }>({ balance: 0, transfers: [] });
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [showDeliver, setShowDeliver] = useState(false);
  const [deliverWeight, setDeliverWeight] = useState('');
  const [deliverLossReason, setDeliverLossReason] = useState('');
  const [deliverPhoto, setDeliverPhoto] = useState<string | null>(null);

  const [showExpense, setShowExpense] = useState(false);
  const [expenseType, setExpenseType] = useState('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePhoto, setExpensePhoto] = useState<string | null>(null);

  // ---- network ----
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!s.isConnected));
    return () => unsub();
  }, []);

  // ---- push notifications ----
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }
      if (Device.isDevice && user) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          try {
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            await supabase.from('push_tokens').upsert(
              { user_id: user.id, token },
              { onConflict: 'user_id' },
            );
          } catch {}
        }
      }
    })();
  }, [user]);

  // ---- loaders ----
  const loadProfile = useCallback(async () => {
    if (!user) return;
    const [{ data: prof }, { data: shift }] = await Promise.all([
      supabase.from('driver_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('driver_shifts').select('driver_id').eq('driver_id', user.id).is('ended_at', null).maybeSingle(),
    ]);
    setDriverProfile(prof);
    setIsOnline(!!shift);
  }, [user]);

  const loadJobs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('batch_movements')
      .select('*, batches(batch_code, crop_name, quality_grade)')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false });
    if (!data) return;
    setActiveJob(data.find(j => ['assigned', 'in_transit', 'delivered', 'received'].includes(j.status)) || null);
    setHistory(data.filter(j => ['delivered', 'received', 'settled'].includes(j.status)));
  }, [user]);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    const [{ data: bal }, { data: transfers }] = await Promise.all([
      supabase.rpc('driver_wallet_balance'),
      supabase.from('payout_transfers')
        .select('*')
        .eq('recipient_type', 'driver')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setWallet({ balance: Number(bal) || 0, transfers: transfers || [] });
  }, [user]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfile(), loadJobs(), loadWallet()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile, loadJobs, loadWallet]);

  useFocusEffect(useCallback(() => { refreshAll(); }, [refreshAll]));

  // ---- realtime: new offers ----
  useEffect(() => {
    if (!user || !isOnline) return;
    const ch = supabase.channel('driver_offers')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispatch_offers', filter: `driver_id=eq.${user.id}` },
        async payload => {
          if ((payload.new as any).status === 'pending') {
            const { data } = await supabase.from('dispatch_offers')
              .select('*, batch_movements(*, batches(batch_code, crop_name))')
              .eq('id', (payload.new as any).id)
              .maybeSingle();
            if (data) {
              setPendingOffer(data);
              setOfferCountdown(180);
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isOnline]);

  // ---- realtime: job updates ----
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('driver_job')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'batch_movements', filter: `driver_id=eq.${user.id}` },
        () => { loadJobs(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadJobs]);

  // ---- offer countdown ----
  useEffect(() => {
    if (!pendingOffer) return;
    const timer = setInterval(() => {
      setOfferCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          setPendingOffer(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingOffer]);

  // ---- online/offline ----
  const goOnline = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Location required', 'Driver app needs location to dispatch jobs.');
        return;
      }
      const started = await startBackgroundTracking();
      if (!started) {
        Alert.alert('Background location', 'Set location to "Always" in system settings.');
        return;
      }
      const { data: existing } = await supabase.from('driver_shifts')
        .select('driver_id')
        .eq('driver_id', user.id)
        .is('ended_at', null)
        .maybeSingle();
      if (existing) {
        await supabase.from('driver_shifts')
          .update({ started_at: new Date().toISOString() })
          .eq('driver_id', user.id)
          .is('ended_at', null);
      } else {
        const { error } = await supabase.from('driver_shifts').insert({ driver_id: user.id });
        if (error) throw error;
      }
      setIsOnline(true);
    } catch (e: any) {
      Alert.alert('Could not go online', e.message);
    } finally {
      setBusy(false);
    }
  };

  const goOffline = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await stopBackgroundTracking();
      await supabase.from('driver_shifts')
        .update({ ended_at: new Date().toISOString() })
        .eq('driver_id', user.id)
        .is('ended_at', null);
      setIsOnline(false);
    } finally {
      setBusy(false);
    }
  };

  // ---- offer actions ----
  const acceptOffer = async () => {
    if (!pendingOffer) return;
    const offerId = pendingOffer.id;
    setPendingOffer(null);
    setBusy(true);
    try {
      const { error } = await supabase.rpc('accept_dispatch_offer', { p_offer_id: offerId });
      if (error) throw error;
      await loadJobs();
      Alert.alert('Accepted', 'Job is yours. Start trip when ready.');
    } catch (e: any) {
      Alert.alert('Could not accept', e.message);
    } finally {
      setBusy(false);
    }
  };

  const declineOffer = async () => {
    if (!pendingOffer) return;
    const offerId = pendingOffer.id;
    setPendingOffer(null);
    await supabase.rpc('decline_dispatch_offer', { p_offer_id: offerId });
  };

  // ---- trip actions ----
  const startTrip = async () => {
    if (!activeJob) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('start_trip', { p_movement_id: activeJob.id });
      if (error) throw error;
      await loadJobs();
    } catch (e: any) {
      Alert.alert('Start failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const navigate = () => {
    if (!activeJob) return;
    const dest = encodeURIComponent(activeJob.destination_location || 'Destination');
    Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${dest}` : `geo:0,0?q=${dest}`);
  };

  const triggerSOS = () => {
    if (!activeJob || !user) return;
    Alert.alert('Emergency', 'Send SOS with your GPS?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'SEND',
        style: 'destructive',
        onPress: async () => {
          try {
            const loc = await Location.getCurrentPositionAsync({});
            await supabase.from('sos_alerts').insert({
              driver_id: user.id,
              batch_id: activeJob.batch_id,
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
            });
            Alert.alert('SOS sent', 'Admin has been alerted.');
          } catch (e: any) {
            Alert.alert('SOS failed', e.message);
          }
        },
      },
    ]);
  };

  // ---- photo helpers ----
  const pickPhoto = async (setter: (s: string | null) => void) => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled) setter(r.assets[0].uri);
  };

  const uploadPhoto = async (uri: string, bucket: string): Promise<string> => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const path = `${user!.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    return data?.signedUrl || '';
  };

  // ---- deliver ----
  const submitDelivery = async () => {
    if (!activeJob) return;
    if (!deliverPhoto) return Alert.alert('Photo required', 'Take a proof-of-delivery photo.');
    const weight = parseFloat(deliverWeight || String(activeJob.quantity_kg));
    if (!weight || weight <= 0) return Alert.alert('Weight required', 'Enter a valid weight.');
    if (weight < Number(activeJob.quantity_kg) && !deliverLossReason) {
      return Alert.alert('Loss reason required', 'Explain why weight is lower.');
    }
    setBusy(true);
    try {
      const podUrl = await uploadPhoto(deliverPhoto, 'delivery-photos');
      const { error } = await supabase.rpc('deliver_trip', {
        p_movement_id: activeJob.id,
        p_weight: weight,
        p_loss_reason: deliverLossReason || null,
        p_pod_url: podUrl,
      });
      if (error) throw error;
      setShowDeliver(false);
      setDeliverWeight('');
      setDeliverLossReason('');
      setDeliverPhoto(null);
      await loadJobs();
      Alert.alert('Delivered', 'Awaiting warehouse confirmation.');
    } catch (e: any) {
      Alert.alert('Delivery failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- expense ----
  const submitExpense = async () => {
    if (!activeJob || !user) return;
    const amount = parseFloat(expenseAmount);
    if (!amount || amount <= 0) return Alert.alert('Amount required');
    setBusy(true);
    try {
      let receiptUrl: string | null = null;
      if (expensePhoto) receiptUrl = await uploadPhoto(expensePhoto, 'expense-receipts');
      await supabase.from('trip_expenses').insert({
        movement_id: activeJob.id,
        driver_id: user.id,
        expense_type: expenseType,
        amount_naira: amount,
        receipt_url: receiptUrl,
        client_reference: `exp-${activeJob.id}-${Date.now()}`,
      });
      setShowExpense(false);
      setExpenseAmount('');
      setExpensePhoto(null);
      Alert.alert('Logged', 'Expense recorded.');
    } catch (e: any) {
      Alert.alert('Expense failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- gates ----
  if (isOffline) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No internet — reconnect to continue.</Text>
      </View>
    );
  }
  if (!driverProfile) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Not a driver yet</Text>
        <Text style={styles.muted}>Register to start earning.</Text>
        <Pressable onPress={() => router.push('/driver-register' as any)} style={styles.btn}>
          <Text style={styles.btnText}>BECOME A DRIVER</Text>
        </Pressable>
      </View>
    );
  }
  if (!driverProfile.agreement_signed_at) {
    return <DriverAgreementGate onAccepted={loadProfile} />;
  }

  if (driverProfile.status !== 'active') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Status: {String(driverProfile.status).toUpperCase()}</Text>
        <Text style={styles.muted}>
          {driverProfile.status === 'pending'
            ? 'Application under review. You will be notified once approved.'
            : 'Contact support if this is unexpected.'}
        </Text>
      </View>
    );
  }

  // ---- main ----
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Driver Portal</Text>
          <Text style={styles.muted}>{isOnline ? '🟢 Online — receiving offers' : '⚪ Offline'}</Text>
        </View>
        <Pressable
          onPress={isOnline ? goOffline : goOnline}
          disabled={busy}
          style={[styles.toggle, { backgroundColor: isOnline ? '#ff3b5c' : palette.neon }]}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[styles.toggleText, { color: isOnline ? '#fff' : '#000' }]}>
              {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {(['home', 'wallet', 'profile'] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t && { color: '#000' }]}>
              {t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'home' && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={palette.neon} />}
        >
          {activeJob ? (
            <View style={styles.jobCard}>
              <View style={styles.row}>
                <Text style={styles.jobCode}>{activeJob.batches?.batch_code}</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{activeJob.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.jobLine}>
                {activeJob.batches?.crop_name} · {activeJob.quantity_kg}kg
              </Text>
              <Text style={styles.jobLine}>
                📍 {activeJob.origin_location} → {activeJob.destination_location}
              </Text>

              {activeJob.status === 'assigned' && (
                <Pressable onPress={startTrip} disabled={busy} style={styles.btn}>
                  {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>▶ START TRIP</Text>}
                </Pressable>
              )}

              {activeJob.status === 'in_transit' && (
                <>
                  <Pressable
                    onPress={navigate}
                    style={[styles.btn, { backgroundColor: '#3b82f6' }]}
                  >
                    <Text style={[styles.btnText, { color: '#fff' }]}>🗺️ NAVIGATE</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowExpense(true)}
                    style={[styles.btn, { backgroundColor: '#333', marginTop: 8 }]}
                  >
                    <Text style={[styles.btnText, { color: '#fff' }]}>⛽ ADD EXPENSE</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowDeliver(true)}
                    style={[styles.btn, { marginTop: 8 }]}
                  >
                    <Text style={styles.btnText}>✅ ARRIVED</Text>
                  </Pressable>
                  <Pressable
                    onPress={triggerSOS}
                    style={[styles.btn, { backgroundColor: '#ff3b5c', marginTop: 8 }]}
                  >
                    <Text style={[styles.btnText, { color: '#fff' }]}>🚨 SOS</Text>
                  </Pressable>
                </>
              )}

              {(activeJob.status === 'delivered' || activeJob.status === 'received') && (
                <Text style={styles.muted}>Awaiting warehouse confirmation.</Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.muted}>
                {isOnline ? 'Waiting for offers…' : 'Go online to receive delivery offers.'}
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>RECENT TRIPS</Text>
          {history.length === 0 && <Text style={styles.muted}>No completed trips yet.</Text>}
          {history.slice(0, 10).map(t => (
            <View key={t.id} style={styles.historyCard}>
              <View style={styles.row}>
                <Text style={styles.jobCode}>{t.batches?.batch_code}</Text>
                <Text style={styles.amount}>₦{Number(t.delivery_fee || 0).toLocaleString()}</Text>
              </View>
              <Text style={styles.muted}>
                {t.status} · {t.received_at ? new Date(t.received_at).toLocaleDateString() : '—'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {tab === 'wallet' && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={palette.neon} />}
        >
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.walletValue}>₦{wallet.balance.toLocaleString()}</Text>
            <Text style={styles.muted}>Ledger-based — confirmed payments only.</Text>
          </View>

          <Pressable
            onPress={() => router.push('/driver-withdraw' as any)}
            style={{ backgroundColor: palette.neon, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12, marginBottom: 8 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 }}>WITHDRAW TO BANK</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>PAYOUT HISTORY</Text>
          {wallet.transfers.length === 0 && <Text style={styles.muted}>No payouts yet.</Text>}
          {wallet.transfers.map(t => (
            <View key={t.id} style={styles.historyCard}>
              <View style={styles.row}>
                <Text style={styles.jobCode}>#{String(t.id).slice(0, 8)}</Text>
                <Text style={[styles.amount, { color: t.status === 'paid' ? palette.neon : '#ffb300' }]}>
                  ₦{Number(t.amount_naira || 0).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.muted}>
                {t.status} · {new Date(t.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {tab === 'profile' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.jobCard}>
            <Text style={styles.sectionLabel}>LICENSE</Text>
            <Text style={styles.body}>{driverProfile.license_number}</Text>

            <Text style={styles.sectionLabel}>BANK</Text>
            <Text style={styles.body}>
              {driverProfile.bank_name} · {driverProfile.bank_account_number}
            </Text>

            <Text style={styles.sectionLabel}>RATING</Text>
            <Text style={styles.body}>
              ⭐ {driverProfile.average_rating ?? '—'} ({driverProfile.total_ratings ?? 0})
            </Text>

            <Text style={styles.sectionLabel}>COMPLETED TRIPS</Text>
            <Text style={styles.body}>{driverProfile.completed_trips ?? 0}</Text>
          </View>
        </ScrollView>
      )}

      {/* OFFER MODAL */}
      <Modal visible={!!pendingOffer} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>NEW OFFER</Text>
            <Text style={styles.muted}>{offerCountdown}s remaining</Text>
            <Text style={styles.jobCode}>{pendingOffer?.batch_movements?.batches?.batch_code}</Text>
            <Text style={styles.body}>
              {pendingOffer?.batch_movements?.batches?.crop_name} · {pendingOffer?.batch_movements?.quantity_kg}kg
            </Text>
            <Text style={styles.body}>
              📍 {pendingOffer?.batch_movements?.origin_location} → {pendingOffer?.batch_movements?.destination_location}
            </Text>
            <Text style={styles.amount}>
              ₦{Number(pendingOffer?.offered_fee_naira || 0).toLocaleString()}
            </Text>

            <Pressable onPress={acceptOffer} disabled={busy} style={[styles.btn, { marginTop: 16 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>ACCEPT</Text>}
            </Pressable>
            <Pressable onPress={declineOffer} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* DELIVERY MODAL */}
      <Modal visible={showDeliver} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete Delivery</Text>

            <Text style={styles.label}>ACTUAL WEIGHT (KG)</Text>
            <TextInput
              value={deliverWeight}
              onChangeText={setDeliverWeight}
              keyboardType="numeric"
              style={styles.input}
              placeholder={String(activeJob?.quantity_kg || '')}
              placeholderTextColor="#666"
            />

            {deliverWeight !== '' && Number(deliverWeight) < Number(activeJob?.quantity_kg || 0) && (
              <>
                <Text style={styles.label}>LOSS REASON</Text>
                <TextInput
                  value={deliverLossReason}
                  onChangeText={setDeliverLossReason}
                  style={styles.input}
                  placeholderTextColor="#666"
                />
              </>
            )}

            <Text style={styles.label}>PROOF OF DELIVERY *</Text>
            <Pressable onPress={() => pickPhoto(setDeliverPhoto)} style={styles.photoBtn}>
              {deliverPhoto ? (
                <Image source={{ uri: deliverPhoto }} style={styles.photo} />
              ) : (
                <Text style={styles.photoBtnText}>📸 TAKE PHOTO</Text>
              )}
            </Pressable>

            <Pressable onPress={submitDelivery} disabled={busy} style={[styles.btn, { marginTop: 16 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>CONFIRM DELIVERY</Text>}
            </Pressable>
            <Pressable onPress={() => setShowDeliver(false)} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* EXPENSE MODAL */}
      <Modal visible={showExpense} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Expense</Text>

            <Text style={styles.label}>TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {['Fuel', 'Tolls', 'Police', 'Repairs'].map(t => (
                <Pressable
                  key={t}
                  onPress={() => setExpenseType(t)}
                  style={[styles.chip, expenseType === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, expenseType === t && { color: '#000' }]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>AMOUNT (₦)</Text>
            <TextInput
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>RECEIPT PHOTO</Text>
            <Pressable onPress={() => pickPhoto(setExpensePhoto)} style={styles.photoBtn}>
              {expensePhoto ? (
                <Image source={{ uri: expensePhoto }} style={styles.photo} />
              ) : (
                <Text style={styles.photoBtnText}>📸 TAKE PHOTO</Text>
              )}
            </Pressable>

            <Pressable onPress={submitExpense} disabled={busy} style={[styles.btn, { marginTop: 16 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>SAVE EXPENSE</Text>}
            </Pressable>
            <Pressable onPress={() => setShowExpense(false)} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: p.obsidian },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, gap: 12 },
  title: { fontSize: 24, fontWeight: '900', color: p.text },
  muted: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  body: { fontSize: 14, color: p.text, marginTop: 4 },
  toggle: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  toggleText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  tabBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabBtnActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabText: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  scroll: { padding: 20, paddingBottom: 60 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobCard: { backgroundColor: p.surface, padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: p.border },
  jobCode: { fontSize: 16, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  jobLine: { fontSize: 13, color: p.textMuted, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: p.neon },
  pillText: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  emptyCard: { backgroundColor: p.surface, padding: 32, borderRadius: 16, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  historyCard: { backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  amount: { fontSize: 14, fontWeight: '900', color: p.neon },
  walletCard: { backgroundColor: p.neonSoft || 'rgba(0,255,136,0.08)', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: p.neon, marginBottom: 24 },
  walletLabel: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  walletValue: { fontSize: 40, fontWeight: '900', color: p.text, marginVertical: 8 },
  btn: { backgroundColor: p.neon, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  btnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  btnGhost: { marginTop: 12, alignItems: 'center' },
  btnGhostText: { color: '#888', fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#222', padding: 20, borderRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.obsidian, padding: 14, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 15 },
  photoBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#ffb300', borderStyle: 'dashed', alignItems: 'center', backgroundColor: 'rgba(255,179,0,0.1)' },
  photo: { width: '100%', height: 100, borderRadius: 8 },
  photoBtnText: { color: '#ffb300', fontWeight: '800' },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
  chipActive: { backgroundColor: '#ffb300' },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

function DriverAgreementGate({ onAccepted }: { onAccepted: () => void }) {
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const [agreed, setAgreed] = useState(false);
  const [sig, setSig] = useState('');
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!sig.trim()) return Alert.alert('Signature required');
    setBusy(true);
    try {
      const { error } = await supabase.from('driver_profiles').update({
        agreement_signed_at: new Date().toISOString(),
        agreement_version: DRIVER_AGREEMENT.version,
        agreement_signature: sig.trim(),
      }).eq('user_id', user.id);
      if (error) throw error;
      onAccepted();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 60 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: palette.text }}>Driver Agreement</Text>
        <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 4 }}>Read and accept to continue.</Text>
        <View style={{ backgroundColor: palette.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.border, marginTop: 20 }}>
          <Text style={{ fontSize: 11, color: palette.text, lineHeight: 18 }}>{DRIVER_AGREEMENT.body}</Text>
        </View>
        <Pressable onPress={() => setAgreed(a => !a)} style={{ flexDirection: 'row', gap: 12, marginTop: 20, alignItems: 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: agreed ? palette.neon : palette.border, backgroundColor: agreed ? palette.neon : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            {agreed ? <Text style={{ color: '#000', fontSize: 16, fontWeight: '900' }}>✓</Text> : null}
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: palette.text, lineHeight: 20 }}>I have read and accept the Driver Agreement.</Text>
        </Pressable>
        <Text style={{ fontSize: 10, fontWeight: '800', color: palette.textMuted, marginTop: 16, marginBottom: 6 }}>E-SIGNATURE *</Text>
        <TextInput value={sig} onChangeText={setSig} style={{ padding: 14, borderRadius: 12, backgroundColor: palette.surface, color: palette.text, borderWidth: 1, borderColor: palette.border, fontSize: 15 }} placeholder="Full legal name" placeholderTextColor={palette.textDim} />
        <Pressable onPress={accept} disabled={!agreed || busy} style={{ backgroundColor: palette.neon, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, opacity: (agreed && !busy) ? 1 : 0.4 }}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={{ fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 }}>ACCEPT & CONTINUE</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}
