// app/(tabs)/profile.tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert,
  ActivityIndicator, TextInput, Modal, RefreshControl, Platform, Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { useSettings } from '../../src/store/settings';
import { ALL_COUNTRIES } from '../../src/data/countries';
import { countryFlag } from '../../src/store/locale';
import { FarmScoreCard } from '../../src/components/ScanExtras';
import { supabase } from '../../src/api/supabase';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../src/store/locale';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const SUPABASE_URL = 'https://pxvtvuwlpzwlkdoxjrep.supabase.co';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
];
const GENDERS = ['', 'Male', 'Female'];
const MARITAL = ['', 'Single', 'Married', 'Divorced', 'Widowed'];
const FARM_TYPES = ['', 'Smallholder (< 1 acre)', 'Medium (1-10 acres)', 'Commercial (10-50 acres)', 'Industrial (50+ acres)'];
const BANKS = ['','Access Bank','GTBank','Zenith Bank','UBA','First Bank','Kuda','Opay','Palmpay','Moniepoint','Sterling Bank','Union Bank','Fidelity Bank','Wema Bank','Jaiz Bank','Other'];

interface MenuItem { label: string; route: string; flag?: string; }
interface Section { title: string; icon: string; items: MenuItem[]; }

function getSections(t: any): Section[] {
  return [
  { title: t('profile.sections.scansAi'), icon: 'AI', items: [
    { label: t('profile.items.voiceAgronomist'), route: '/voice', flag: 'voice' },
    { label: t('profile.items.videoScan'), route: '/video-scan', flag: 'video' },
    { label: t('profile.items.scanHistory'), route: '/history' },
    { label: t('profile.items.earlyWarning'), route: '/early-warning' },
  ]},
  { title: t('profile.sections.farmTools'), icon: 'FM', items: [
    { label: t('profile.items.farmMapping'), route: '/farm-mapping' },
    { label: 'Agro Tools', route: '/agro-tools' },
    { label: t('profile.items.farmJournal'), route: '/journal' },
    { label: t('profile.items.satelliteMonitor'), route: '/satellite', flag: 'satellite' },
  ]},
  { title: t('profile.sections.moneyBusiness'), icon: '$$', items: [
    { label: t('profile.items.wallet'), route: '/wallet', flag: 'wallet' },
    { label: t('profile.items.paymentHistory'), route: '/payment-history' },
    { label: t('profile.items.loans'), route: '/loans', flag: 'loans' },
    { label: t('profile.items.savingsGroups'), route: '/savings-groups' },
    { label: t('profile.items.rewards'), route: '/rewards' },
    { label: t('profile.items.affiliate'), route: '/affiliate' },
    { label: t('profile.items.b2b'), route: '/b2b-dashboard' },
  ]},
  { title: t('profile.sections.community'), icon: 'CM', items: [
    { label: t('profile.items.marketplace'), route: '/marketplace', flag: 'marketplace' },
    { label: t('profile.items.university'), route: '/university', flag: 'university' },
    { label: t('profile.items.chat'), route: '/chat', flag: 'chat' },
    { label: t('profile.items.notifications'), route: '/notifications' },
  ]},
  { title: t('profile.sections.account'), icon: 'AC', items: [
    { label: 'Alerts & Follow-ups', route: '/alerts' },
    { label: 'Photo Timeline', route: '/photo-timeline' },
    { label: t('profile.items.verification'), route: '/verification' },
    { label: t('profile.items.badges'), route: '/badges', flag: 'badges' },
    { label: t('profile.items.farmingCalendar'), route: '/calendar', flag: 'calendar' },
    { label: t('profile.items.blockedUsers'), route: '/blocked-users' },
  ]},
  { title: t('profile.sections.support'), icon: 'SP', items: [
    { label: t('profile.items.helpSupport'), route: '/help' },
    { label: t('profile.items.settings'), route: '/settings' },
  ]},
];
}

function mask11(v?: string | null) {
  if (!v) return '—';
  const s = String(v);
  if (s.length <= 4) return '•'.repeat(s.length);
  return '•'.repeat(s.length - 4) + s.slice(-4);
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return '—'; }
}

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

export default function Profile() {
  const { t } = useTranslation();
  const SECTIONS = getSections(t);
  const router = useRouter();
  const palette = useTheme((s) => s.palette);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const user = useAuth((s) => s.user);
  const scansRemaining = useAuth((s) => s.scansRemaining);
  const plan = useAuth((s) => s.plan);
  const signOut = useAuth((s) => s.signOut);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const flags = useSettings((s) => s.flags);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [kycVerifiedAt, setKycVerifiedAt] = useState<string | null>(null);
  const [kyc, setKyc] = useState<any>(null);



  const [f, setF] = useState<Record<string, any>>({});
  const originalRef = useRef<Record<string, any>>({});

  const set = (k: string, v: any) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const [profRes, verifRes] = await Promise.allSettled([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('farmer_verifications')
          .select('full_name,bvn,nin,crop,farm_size,status,id_status,selfie_status,name_match_verified_at,created_at,id_photo_url,id_image_url,selfie_url,state,lga,address,phone')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const prof = profRes.status === 'fulfilled' ? (profRes.value.data || {}) : {};
      const verif = verifRes.status === 'fulfilled' ? verifRes.value.data : null;

      setKyc(verif || null);
      setKycStatus((verif?.status || prof.verification_status || 'pending').toLowerCase());
      setKycVerifiedAt(verif?.name_match_verified_at || null);
      setAvatar(prof.avatar_url || null);

      const next: Record<string, any> = {
        first_name: prof.first_name || verif?.full_name?.split(' ')[0] || '',
        middle_name: prof.middle_name || '',
        last_name: prof.last_name || (verif?.full_name?.split(' ').slice(1).join(' ') || ''),
        phone: prof.phone || verif?.phone || '',
        whatsapp: prof.whatsapp || prof.phone || '',
        gender: prof.gender || '',
        date_of_birth: prof.date_of_birth || '',
        marital_status: prof.marital_status || '',
        country: prof.country || useLocale.getState().country?.name || '',
        state: prof.state || verif?.state || '',
        lga: prof.lga || verif?.lga || '',
        city: prof.city || '',
        street_address: prof.street_address || verif?.address || '',
        landmark: prof.landmark || '',
        postal_code: prof.postal_code || '',
        farm_state: prof.farm_state || verif?.state || '',
        farm_lga: prof.farm_lga || verif?.lga || '',
        farm_address: prof.farm_address || '',
        farm_size_acres: prof.farm_size_acres != null ? String(prof.farm_size_acres) : (verif?.farm_size || ''),
        farming_type: prof.farming_type || '',
        years_experience: prof.years_experience != null ? String(prof.years_experience) : '',
        primary_crops: prof.primary_crops || verif?.crop || '',
        secondary_crops: prof.secondary_crops || '',
        account_name: prof.account_name || '',
        account_number: prof.account_number || '',
        bank_name: prof.bank_name || '',
        emergency_contact_name: prof.emergency_contact_name || '',
        emergency_contact_phone: prof.emergency_contact_phone || '',
        emergency_relationship: prof.emergency_relationship || '',
        social_twitter: prof.social_twitter || '',
        social_instagram: prof.social_instagram || '',
        social_facebook: prof.social_facebook || '',
        social_linkedin: prof.social_linkedin || '',
        social_tiktok: prof.social_tiktok || '',
        preferred_language: prof.preferred_language || 'English',
        notify_sms: prof.notify_sms !== false,
        notify_whatsapp: prof.notify_whatsapp !== false,
        notify_weather: prof.notify_weather !== false,
        notify_disease: prof.notify_disease !== false,
        notify_payment: prof.notify_payment !== false,
        bvn: prof.bvn || verif?.bvn || '',
        nin: prof.nin || verif?.nin || '',
      };
      setF(next);
      originalRef.current = { ...next };
      setDirty(false);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const cancelEdit = useCallback(() => {
    if (!dirty) {
      setEditMode(false);
      return;
    }
    Alert.alert('Discard changes?', 'Your edits will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setF({ ...originalRef.current });
          setDirty(false);
          setEditMode(false);
        },
      },
    ]);
  }, [dirty]);

  const uploadAvatar = async (asset: { uri: string; base64?: string | null }): Promise<string> => {
    if (!user) throw new Error('Not signed in');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Session expired');

    let uploadUri = asset.uri;
    const needsCopy =
      Platform.OS === 'ios' &&
      (uploadUri.startsWith('ph://') || uploadUri.startsWith('assets-library://'));

    if (needsCopy) {
      if (!asset.base64) throw new Error('Could not read selected image');
      uploadUri = (FileSystem.cacheDirectory || '') + 'avatar_src_' + Date.now() + '.jpg';
      await FileSystem.writeAsStringAsync(uploadUri, asset.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const path = `${user.id}/avatar_${Date.now()}.jpg`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/avatars/${path}`;

    const r = await FileSystem.uploadAsync(uploadUrl, uploadUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });

    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Upload failed (${r.status})`);
    }

    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
  };

  const changeAvatar = async () => {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo permission required', 'Enable Photos access in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });
    if (res.canceled) return;

    setAvatarBusy(true);
    try {
      const url = await uploadAvatar({
        uri: res.assets[0].uri,
        base64: res.assets[0].base64,
      });

      const upd = await supabase
        .from('user_profiles')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select('avatar_url');

      if (upd.error) {
        Alert.alert('Saved image, but profile row did not update', upd.error.message);
      } else if (!upd.data || upd.data.length === 0) {
        Alert.alert('Profile row not updated', 'RLS may be blocking this write.');
      }
      setAvatar(url);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Try again');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = () => {
    if (!user) return;
    Alert.alert('Remove photo?', 'Your profile picture will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true);
          try {
            if (avatar) {
              const marker = '/avatars/';
              const idx = avatar.indexOf(marker);
              if (idx >= 0) {
                const storagePath = avatar.slice(idx + marker.length).split('?')[0];
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (token) {
                  await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${storagePath}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                }
              }
            }
            await supabase
              .from('user_profiles')
              .update({ avatar_url: null, updated_at: new Date().toISOString() })
              .eq('user_id', user.id);
            setAvatar(null);
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Try again');
          } finally {
            setAvatarBusy(false);
          }
        },
      },
    ]);
  };

  const onAvatarTap = () => {
    if (!avatar) {
      changeAvatar();
      return;
    }
    Alert.alert('Profile picture', 'What would you like to do?', [
      { text: 'View', onPress: () => setViewerOpen(true) },
      { text: 'Change', onPress: changeAvatar },
      { text: 'Remove', style: 'destructive', onPress: removeAvatar },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!user) return;

    if (!(f.first_name || '').trim() || !(f.last_name || '').trim()) {
      Alert.alert('Name required', 'First and last name are needed.');
      return;
    }
    if (f.phone && !/^[+0-9\s\-()]{7,20}$/.test(String(f.phone))) {
      Alert.alert('Invalid phone', 'Enter a valid phone number.');
      return;
    }

    setSaving(true);
    try {
      const numeric = (v: any) => {
        const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
        return isNaN(n) ? null : n;
      };
      const intVal = (v: any) => {
        const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10);
        return isNaN(n) ? null : n;
      };

      const payload: Record<string, any> = {
        user_id: user.id,
        email: user.email,
        first_name: (f.first_name || '').trim(),
        middle_name: (f.middle_name || '').trim() || null,
        last_name: (f.last_name || '').trim(),
        phone: (f.phone || '').trim() || null,
        whatsapp: (f.whatsapp || '').trim() || null,
        gender: f.gender || null,
        date_of_birth: f.date_of_birth || null,
        marital_status: f.marital_status || null,
        country: f.country || useLocale.getState().country?.name || '',
      country_code: f.country_code || useLocale.getState().country?.code || '',
        state: f.state || null,
        lga: f.lga || null,
        city: f.city || null,
        street_address: f.street_address || null,
        landmark: f.landmark || null,
        postal_code: f.postal_code || null,
        farm_state: f.farm_state || null,
        farm_lga: f.farm_lga || null,
        farm_address: f.farm_address || null,
        farm_size_acres: numeric(f.farm_size_acres),
        farming_type: f.farming_type || null,
        years_experience: intVal(f.years_experience),
        primary_crops: f.primary_crops || null,
        secondary_crops: f.secondary_crops || null,
        account_name: f.account_name || null,
        account_number: f.account_number || null,
        bank_name: f.bank_name || null,
        emergency_contact_name: f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
        emergency_relationship: f.emergency_relationship || null,
        social_twitter: f.social_twitter || null,
        social_instagram: f.social_instagram || null,
        social_facebook: f.social_facebook || null,
        social_linkedin: f.social_linkedin || null,
        social_tiktok: f.social_tiktok || null,
        preferred_language: f.preferred_language || 'English',
        notify_sms: !!f.notify_sms,
        notify_whatsapp: !!f.notify_whatsapp,
        notify_weather: !!f.notify_weather,
        notify_disease: !!f.notify_disease,
        notify_payment: !!f.notify_payment,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      originalRef.current = { ...f };
      setDirty(false);
      setEditMode(false);
      Alert.alert('Saved', 'Profile updated.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Log out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch {}
          try { router.replace('/(auth)/login' as any); } catch {}
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  if (!user) return null;

  const verified = kycStatus === 'approved';
  const pending = kycStatus === 'pending' || kycStatus === 'pending_payment' || kycStatus === 'pending_review';
  const rejected = kycStatus === 'documents_rejected' || kycStatus === 'rejected';
  const verifColor = verified ? palette.neon : rejected ? palette.danger : palette.warning;
  const verifLabel = verified ? 'VERIFIED' : rejected ? 'ACTION NEEDED' : 'VERIFICATION PENDING';

  const displayName =
    ((f.first_name || '') + ' ' + (f.last_name || '')).trim() ||
    user?.email?.split('@')[0] ||
    'Farmer';

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((it) => {
      if (!it.flag) return true;
      if (!flags) return true;
      return flags[it.flag] !== false;
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.neon}
          />
        }
      >
        {loadError ? (
          <Pressable onPress={load} style={styles.errorBar}>
            <Text style={styles.errorTxt}>{loadError} · tap to retry</Text>
          </Pressable>
        ) : null}

        <View style={styles.hero}>
          <Pressable onPress={onAvatarTap} style={styles.avatarWrap} disabled={avatarBusy}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              {avatarBusy ? (
                <ActivityIndicator color={palette.obsidian} size="small" />
              ) : (
                <Text style={styles.avatarEditText}>+</Text>
              )}
            </View>
          </Pressable>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        {/* COUNTRY_CHIP_PROFILE */}
        {(() => {
          const locStore = useLocale.getState();
          const locCountry = locStore?.country;
          const fCountry = (f && f.country) ? String(f.country) : '';
          const fCode = (f && f.country_code) ? String(f.country_code) : '';
          const cName = fCountry || (locCountry?.name) || '';
          const explicitCode = fCode || (locCountry?.code) || '';
          if (!cName && !explicitCode) return null;

          let resolvedCode = explicitCode;
          let display = cName || explicitCode;
          let provider = locCountry?.payment_provider || 'paystack';

          if (!resolvedCode && cName) {
            const list = (typeof ALL_COUNTRIES !== 'undefined' && Array.isArray(ALL_COUNTRIES)) ? ALL_COUNTRIES : [];
            const info = list.find((c: any) => c.name && c.name.toLowerCase() === cName.toLowerCase());
            if (info) {
              resolvedCode = info.code;
              display = info.name;
              provider = info.payment_provider || 'paystack';
            }
          }

          const flag = resolvedCode ? countryFlag(resolvedCode) : '🌍';
          const pColors: any = { paystack: '#00C3F7', flutterwave: '#F5A623', stripe: '#635BFF' };

          return (
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 8,
                backgroundColor: 'rgba(0,255,136,0.08)',
                borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)',
              }}>
                <Text style={{ fontSize: 22 }}>{flag}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: palette.text }}>{display}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pColors[provider] || '#666' }} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: palette.textMuted }}>{provider}</Text>
              </View>
            </View>
          );
        })()}

          <View style={[styles.badge, { borderColor: verifColor, backgroundColor: verifColor + '22' }]}>
            <View style={[styles.badgeDot, { backgroundColor: verifColor }]} />
            <Text style={[styles.badgeTxt, { color: verifColor }]}>{verifLabel}</Text>
          </View>

          {!verified ? (
            <Pressable
              onPress={() => router.push('/verification' as any)}
              style={[styles.verifyBtn, { borderColor: verifColor }]}
            >
              <Text style={[styles.verifyBtnTxt, { color: verifColor }]}>
                {rejected ? 'FIX DOCUMENTS' : pending ? 'VIEW STATUS' : 'VERIFY NOW'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <FarmScoreCard onPress={() => router.push('/wallet' as any)} />

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{scansRemaining}</Text>
            <Text style={styles.statLbl}>SCANS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{String(plan || 'free').charAt(0).toUpperCase()}</Text>
            <Text style={styles.statLbl}>{t('profile.planLabel')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{verified ? '✓' : '—'}</Text>
            <Text style={styles.statLbl}>KYC</Text>
          </View>
        </View>

        <View style={styles.modeBar}>
          {!editMode ? (
            <Pressable onPress={() => setEditMode(true)} style={styles.modeBtn}>
              <Text style={styles.modeBtnTxt}>EDIT PROFILE</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={cancelEdit} style={[styles.modeBtn, styles.modeBtnGhost]}>
                <Text style={[styles.modeBtnTxt, { color: palette.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={saving || !dirty}
                style={[styles.modeBtn, { backgroundColor: palette.neon, marginLeft: 10 }, (saving || !dirty) && { opacity: 0.5 }]}
              >
                <Text style={styles.modeBtnTxt}>{saving ? 'SAVING…' : 'SAVE'}</Text>
              </Pressable>
            </>
          )}
        </View>

        {kyc ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>VERIFICATION</Text>
            <Row styles={styles} label='Status' value={kycStatus.toUpperCase()} valueColor={verifColor} />
            <Row styles={styles} label='Full name' value={kyc.full_name || '—'} />
            <Row styles={styles} label='BVN' value={mask11(kyc.bvn)} />
            <Row styles={styles} label='NIN' value={mask11(kyc.nin)} />
            <Row styles={styles} label='State' value={kyc.state || '—'} />
            <Row styles={styles} label='LGA' value={kyc.lga || '—'} />
            {kycVerifiedAt ? <Row styles={styles} label='Verified' value={fmtDate(kycVerifiedAt)} /> : null}
          </View>
        ) : null}

        {editMode ? (
          <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PERSONAL INFORMATION</Text>
          <Field styles={styles} palette={palette} label='First name' field='first_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Middle name' field='middle_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Last name' field='last_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Phone' field='phone' f={f} set={set} edit={editMode} keyboard='phone-pad' />
          <Field styles={styles} palette={palette} label='WhatsApp' field='whatsapp' f={f} set={set} edit={editMode} keyboard='phone-pad' />
          <Picker styles={styles} palette={palette} label='Gender' field='gender' options={GENDERS} f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Date of birth (YYYY-MM-DD)' field='date_of_birth' f={f} set={set} edit={editMode} />
          <Picker styles={styles} palette={palette} label='Marital status' field='marital_status' options={MARITAL} f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Preferred language' field='preferred_language' f={f} set={set} edit={editMode} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ADDRESS</Text>
          <Field styles={styles} palette={palette} label='Country' field='country' f={f} set={set} edit={editMode} />
          <Picker styles={styles} palette={palette} label='State' field='state' options={['', ...NIGERIAN_STATES]} f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='LGA' field='lga' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='City / Town' field='city' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Street address' field='street_address' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Landmark' field='landmark' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Postal code' field='postal_code' f={f} set={set} edit={editMode} keyboard='number-pad' />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>FARM</Text>
          <Picker styles={styles} palette={palette} label='Farm state' field='farm_state' options={['', ...NIGERIAN_STATES]} f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Farm LGA' field='farm_lga' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Farm address' field='farm_address' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Farm size (acres)' field='farm_size_acres' f={f} set={set} edit={editMode} keyboard='decimal-pad' />
          <Picker styles={styles} palette={palette} label='Farming type' field='farming_type' options={FARM_TYPES} f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Years of experience' field='years_experience' f={f} set={set} edit={editMode} keyboard='number-pad' />
          <Field styles={styles} palette={palette} label='Primary crops' field='primary_crops' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Secondary crops' field='secondary_crops' f={f} set={set} edit={editMode} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>BANK</Text>
          <Field styles={styles} palette={palette} label='Account name' field='account_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Account number' field='account_number' f={f} set={set} edit={editMode} keyboard='number-pad' />
          <Picker styles={styles} palette={palette} label='Bank name' field='bank_name' options={BANKS} f={f} set={set} edit={editMode} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>EMERGENCY CONTACT</Text>
          <Field styles={styles} palette={palette} label='Contact name' field='emergency_contact_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Contact phone' field='emergency_contact_phone' f={f} set={set} edit={editMode} keyboard='phone-pad' />
          <Field styles={styles} palette={palette} label='Relationship' field='emergency_relationship' f={f} set={set} edit={editMode} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>SOCIAL</Text>
          <Field styles={styles} palette={palette} label='Twitter / X' field='social_twitter' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Instagram' field='social_instagram' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Facebook' field='social_facebook' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='LinkedIn' field='social_linkedin' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='TikTok' field='social_tiktok' f={f} set={set} edit={editMode} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>NOTIFICATIONS</Text>
          <Toggle styles={styles} label='SMS' field='notify_sms' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='WhatsApp' field='notify_whatsapp' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='Weather alerts' field='notify_weather' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='Disease alerts' field='notify_disease' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='Payment alerts' field='notify_payment' f={f} set={set} edit={editMode} />
        </View>
          </>
        ) : null}

        {visibleSections.map((section, si) => (
          <View key={si} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Text style={styles.sectionIcon}>{section.icon}</Text>
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.sectionItems}>
              {section.items.map((item, ii) => (
                <Pressable
                  key={ii}
                  onPress={() => {
                    try { router.push(item.route as any); }
                    catch (e: any) { Alert.alert('Cannot open ' + item.label, String(e?.message || e)); }
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    ii === section.items.length - 1 && styles.itemLast,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {isAdmin ? (
          <Pressable
            onPress={() => router.push('/admin' as any)}
            style={({ pressed }) => [styles.adminItem, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.adminLabel}>{t('profile.adminConsole')}</Text>
            <Text style={styles.adminChevron}>›</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={handleSignOut} style={styles.logout}>
          <Text style={styles.logoutText}>{t('profile.logOut')}</Text>
        </Pressable>

        <Text style={styles.version}>GAIA Mobile v{APP_VERSION}</Text>
        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerBg}>
          <Pressable onPress={() => setViewerOpen(false)} style={styles.viewerClose}>
            <Text style={styles.viewerCloseTxt}>X</Text>
          </Pressable>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.viewerImg} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function Row({ styles, label, value, valueColor }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function Field({ styles, palette, label, field, f, set, edit, keyboard }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {edit ? (
        <TextInput
          value={String(f[field] ?? '')}
          onChangeText={(v) => set(field, v)}
          keyboardType={keyboard || 'default'}
          placeholder={label}
          placeholderTextColor={palette.textDim}
          style={styles.fieldInput}
        />
      ) : (
        <Text style={styles.fieldValue}>{f[field] ? String(f[field]) : '—'}</Text>
      )}
    </View>
  );
}

function Picker({ styles, label, field, options, f, set, edit }: any) {
  const current = String(f[field] ?? '');
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {edit ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
        >
          {options.map((opt: string, i: number) => {
            const on = current === opt;
            return (
              <Pressable
                key={i}
                onPress={() => set(field, opt)}
                style={[styles.pill, on && styles.pillOn]}
              >
                <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>
                  {opt || 'None'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.fieldValue}>{current || '—'}</Text>
      )}
    </View>
  );
}

function Toggle({ styles, label, field, f, set, edit }: any) {
  const on = !!f[field];
  return (
    <Pressable
      onPress={() => edit && set(field, !on)}
      disabled={!edit}
      style={[styles.toggleRow, on && styles.toggleRowOn]}
    >
      <View style={[styles.toggleBox, on && styles.toggleBoxOn]}>
        {on ? <Text style={styles.toggleMark}>✓</Text> : null}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },

  errorBar: {
    marginBottom: 12, padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)',
  },
  errorTxt: { fontSize: 11, color: p.danger, fontWeight: '700', textAlign: 'center' },

  hero: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap: { width: 110, height: 110, position: 'relative' },
  avatarImg: { width: 110, height: 110, borderRadius: 55 },
  avatarFallback: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: p.neonSoft, borderWidth: 2, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 44, fontWeight: '900', color: p.neon },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17,
    backgroundColor: p.neon, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: p.obsidian,
  },
  avatarEditText: { fontSize: 20, fontWeight: '900', color: p.obsidian, lineHeight: 22 },
  name: {
    fontSize: 24, fontWeight: '900', color: p.text,
    marginTop: spacing.md, textTransform: 'capitalize', letterSpacing: -0.5,
  },
  email: { fontSize: 14, color: p.textMuted, marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  verifyBtn: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
  },
  verifyBtnTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  stat: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },

  modeBar: { flexDirection: 'row', marginBottom: spacing.lg },
  modeBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: p.neon, alignItems: 'center',
  },
  modeBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border },
  modeBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1.2 },

  card: {
    marginBottom: spacing.lg, padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  cardTitle: {
    fontSize: 10, fontWeight: '900', letterSpacing: 1.8,
    color: p.textMuted, marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: { fontSize: 12, color: p.textMuted, flex: 1, marginRight: 12 },
  rowValue: { fontSize: 13, fontWeight: '800', color: p.text, textAlign: 'right', flex: 1 },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 6 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: p.text, paddingVertical: 4 },
  fieldInput: {
    backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: p.text, fontSize: 14,
  },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: p.border, backgroundColor: p.obsidian,
  },
  pillOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  pillTxt: { fontSize: 11, fontWeight: '700', color: p.textDim },
  pillTxtOn: { color: p.neon },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6,
  },
  toggleRowOn: { backgroundColor: 'rgba(0,255,136,0.06)' },
  toggleBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBoxOn: { backgroundColor: p.neon, borderColor: p.neon },
  toggleMark: { color: p.obsidian, fontWeight: '900', fontSize: 13 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: p.text },

  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionIcon: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted },
  sectionItems: {
    borderRadius: radius.lg, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: p.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: p.text },
  itemChevron: { fontSize: 20, color: p.textDim },

  adminItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: 'rgba(255,60,90,0.08)',
    borderWidth: 1.5, borderColor: p.danger, marginBottom: spacing.lg,
  },
  adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  adminChevron: { fontSize: 22, color: p.danger },

  logout: {
    padding: spacing.lg, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: p.danger, alignItems: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '800', color: p.danger },
  version: {
    fontSize: 10, color: p.textDim, textAlign: 'center',
    marginTop: spacing.xl, letterSpacing: 1,
  },

  viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: {
    position: 'absolute', top: 60, right: 24,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerCloseTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },
  viewerImg: { width: '90%', height: '70%' },
});