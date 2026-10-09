import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert,
  ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

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
const LANGUAGES = ['English','Hausa','Yoruba','Igbo','Pidgin English'];

interface MenuItem { label: string; route: string; badge?: string; }
interface Section { title: string; icon: string; items: MenuItem[]; }

const SECTIONS: Section[] = [
  { title: 'SCANS & AI', icon: 'AI', items: [
    { label: 'Voice Agronomist', route: '/voice' },
    { label: 'Video Scan', route: '/video-scan' },
    { label: 'Scan History', route: '/history' },
    { label: 'Early Warning', route: '/early-warning' },
  ]},
  { title: 'FARM TOOLS', icon: 'FM', items: [
    { label: 'Farm Mapping', route: '/farm-mapping' },
    { label: 'Agro Tools', route: '/agro-tools' },
    { label: 'Farm Journal', route: '/journal' },
    { label: 'Satellite Monitor', route: '/satellite' },
  ]},
  { title: 'MONEY & BUSINESS', icon: '$$', items: [
    { label: 'Wallet', route: '/wallet' },
    { label: 'Payment History', route: '/payment-history' },
    { label: 'Savings Groups', route: '/savings-groups' },
    { label: 'Rewards & Referral', route: '/rewards' },
    { label: 'Affiliate Program', route: '/affiliate' },
    { label: 'B2B Dashboard', route: '/b2b-dashboard' },
  ]},
  { title: 'COMMUNITY', icon: 'CM', items: [
    { label: 'Marketplace', route: '/marketplace' },
    { label: 'University', route: '/university' },
    { label: 'Chat', route: '/chat' },
    { label: 'Notifications', route: '/notifications' },
  ]},
  { title: 'ACCOUNT', icon: 'AC', items: [
    { label: 'Verification', route: '/verification' },
    { label: 'Badges', route: '/badges' },
    { label: 'Farming Calendar', route: '/calendar' },
    { label: 'Blocked Users', route: '/blocked-users' },
  ]},
  { title: 'SUPPORT', icon: 'SP', items: [
    { label: 'Help and Support', route: '/help' },
    { label: 'Settings', route: '/settings' },
  ]},
];

export default function Profile() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user, scansRemaining, plan, signOut } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [kycVerifiedAt, setKycVerifiedAt] = useState<string | null>(null);
  const [kyc, setKyc] = useState<any>(null);

  // Editable form state
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((prev) => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: verif } = await supabase
        .from('farmer_verifications')
        .select('full_name,bvn,nin,crop,farm_size,status,id_status,selfie_status,name_match_verified_at,created_at,id_photo_url,id_image_url,selfie_url,state,lga,address,phone')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const p = prof || {};
      setKyc(verif || null);
      setKycStatus((verif?.status || p.verification_status || 'pending').toLowerCase());
      setKycVerifiedAt(verif?.name_match_verified_at || null);
      setAvatar(p.avatar_url || null);

      setF({
        first_name: p.first_name || verif?.full_name?.split(' ')[0] || '',
        middle_name: p.middle_name || '',
        last_name: p.last_name || (verif?.full_name?.split(' ').slice(1).join(' ') || ''),
        phone: p.phone || verif?.phone || '',
        whatsapp: p.whatsapp || p.phone || '',
        gender: p.gender || '',
        date_of_birth: p.date_of_birth || '',
        marital_status: p.marital_status || '',
        country: p.country || 'Nigeria',
        state: p.state || verif?.state || '',
        lga: p.lga || verif?.lga || '',
        city: p.city || '',
        street_address: p.street_address || verif?.address || '',
        landmark: p.landmark || '',
        postal_code: p.postal_code || '',
        farm_state: p.farm_state || verif?.state || '',
        farm_lga: p.farm_lga || verif?.lga || '',
        farm_address: p.farm_address || '',
        farm_size_acres: p.farm_size_acres != null ? String(p.farm_size_acres) : (verif?.farm_size || ''),
        farming_type: p.farming_type || '',
        years_experience: p.years_experience != null ? String(p.years_experience) : '',
        primary_crops: p.primary_crops || verif?.crop || '',
        secondary_crops: p.secondary_crops || '',
        account_name: p.account_name || '',
        account_number: p.account_number || '',
        bank_name: p.bank_name || '',
        emergency_contact_name: p.emergency_contact_name || '',
        emergency_contact_phone: p.emergency_contact_phone || '',
        emergency_relationship: p.emergency_relationship || '',
        social_twitter: p.social_twitter || '',
        social_instagram: p.social_instagram || '',
        social_facebook: p.social_facebook || '',
        social_linkedin: p.social_linkedin || '',
        social_tiktok: p.social_tiktok || '',
        preferred_language: p.preferred_language || 'English',
        notify_sms: p.notify_sms !== false,
        notify_whatsapp: p.notify_whatsapp !== false,
        notify_weather: p.notify_weather !== false,
        notify_disease: p.notify_disease !== false,
        notify_payment: p.notify_payment !== false,
        bvn: p.bvn || verif?.bvn || '',
        nin: p.nin || verif?.nin || '',
      });
    } catch (e) {
      console.log('profile load error', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: true, aspect: [1, 1],
    });
    if (res.canceled || !user) return;
    setAvatarBusy(true);
    try {
      const asset = res.assets[0];
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no session');
      const path = user.id + '/avatar_' + Date.now() + '.jpg';
      const url = SUPABASE_URL + '/storage/v1/object/avatars/' + path;
      const r = await FileSystem.uploadAsync(url, asset.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
      });
      if (r.status < 200 || r.status >= 300) throw new Error('upload ' + r.status);
      const publicUrl = SUPABASE_URL + '/storage/v1/object/public/avatars/' + path;
      const upd = await supabase.from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select('avatar_url');
      console.log('[avatar] DB write:', upd);
      if (upd.error) {
        Alert.alert('DB write failed', upd.error.message);
      } else if (!upd.data || upd.data.length === 0) {
        Alert.alert('DB row not updated', 'RLS is likely blocking this write.');
      }
      setAvatar(publicUrl);
      Alert.alert('Updated', 'Profile picture changed.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Try again');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    Alert.alert('Remove photo?', 'Your profile picture will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setAvatarBusy(true);
        try {
          if (avatar) {
            const mk = '/avatars/';
            const idx = avatar.indexOf(mk);
            if (idx >= 0) {
              const storagePath = avatar.slice(idx + mk.length).split('?')[0];
              try {
                const sess = await supabase.auth.getSession();
                const tok = sess.data.session ? sess.data.session.access_token : null;
                if (tok) {
                  await fetch(SUPABASE_URL + '/storage/v1/object/avatars/' + storagePath, {
                    method: 'DELETE',
                    headers: { Authorization: 'Bearer ' + tok },
                  });
                }
              } catch (err) {}
            }
          }
          await supabase.from('user_profiles')
            .update({ avatar_url: null, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
          setAvatar(null);
        } catch (e) {
          Alert.alert('Failed', e && e.message ? e.message : 'Try again');
        } finally {
          setAvatarBusy(false);
        }
      }},
    ]);
  };

  const onAvatarTap = () => {
    if (!avatar) { changeAvatar(); return; }
    Alert.alert('Profile picture', 'What would you like to do?', [
      { text: 'View', onPress: () => setViewerOpen(true) },
      { text: 'Change', onPress: changeAvatar },
      { text: 'Remove', style: 'destructive', onPress: removeAvatar },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!user) return;
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
      const payload: any = {
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
        country: f.country || 'Nigeria',
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
      const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      Alert.alert('Saved', 'Profile updated.');
      setEditMode(false);
      load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  const verified = kycStatus === 'approved';
  const pending = kycStatus === 'pending' || kycStatus === 'pending_payment' || kycStatus === 'pending_review';
  const rejected = kycStatus === 'documents_rejected' || kycStatus === 'rejected';
  const verifColor = verified ? palette.neon : rejected ? palette.danger : palette.warning;
  const verifLabel = verified ? 'VERIFIED' : rejected ? 'ACTION NEEDED' : 'VERIFICATION PENDING';

  const displayName = ((f.first_name || '') + ' ' + (f.last_name || '')).trim() || (user?.email?.split('@')[0] || 'Farmer');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable onPress={onAvatarTap} style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              {avatarBusy ? (
                <ActivityIndicator color={palette.obsidian} size='small' />
              ) : (
                <Text style={styles.avatarEditText}>+</Text>
              )}
            </View>
          </Pressable>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          <View style={[styles.badge, { borderColor: verifColor, backgroundColor: verifColor + '22' }]}>
            <View style={[styles.badgeDot, { backgroundColor: verifColor }]} />
            <Text style={[styles.badgeTxt, { color: verifColor }]}>{verifLabel}</Text>
          </View>

          {!verified ? (
            <Pressable onPress={() => router.push('/verification' as any)} style={[styles.verifyBtn, { borderColor: verifColor }]}>
              <Text style={[styles.verifyBtnTxt, { color: verifColor }]}>
                {rejected ? 'FIX DOCUMENTS' : pending ? 'VIEW STATUS' : 'VERIFY NOW'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statVal}>{scansRemaining}</Text><Text style={styles.statLbl}>SCANS</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>{plan[0].toUpperCase()}</Text><Text style={styles.statLbl}>PLAN</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>{verified ? '✓' : '—'}</Text><Text style={styles.statLbl}>KYC</Text></View>
        </View>

        {/* Edit / Save toggle */}
        <View style={styles.modeBar}>
          {!editMode ? (
            <Pressable onPress={() => setEditMode(true)} style={styles.modeBtn}>
              <Text style={styles.modeBtnTxt}>EDIT PROFILE</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => { setEditMode(false); load(); }} style={[styles.modeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }]}>
                <Text style={[styles.modeBtnTxt, { color: palette.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={save} disabled={saving} style={[styles.modeBtn, { backgroundColor: palette.neon, marginLeft: 10 }]}>
                <Text style={styles.modeBtnTxt}>{saving ? 'SAVING...' : 'SAVE'}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* VERIFICATION card */}
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

        {/* PERSONAL */}
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

        {/* ADDRESS */}
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

        {/* FARM */}
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

        {/* BANK */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BANK</Text>
          <Field styles={styles} palette={palette} label='Account name' field='account_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Account number' field='account_number' f={f} set={set} edit={editMode} keyboard='number-pad' />
          <Picker styles={styles} palette={palette} label='Bank name' field='bank_name' options={BANKS} f={f} set={set} edit={editMode} />
        </View>

        {/* EMERGENCY */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EMERGENCY CONTACT</Text>
          <Field styles={styles} palette={palette} label='Contact name' field='emergency_contact_name' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Contact phone' field='emergency_contact_phone' f={f} set={set} edit={editMode} keyboard='phone-pad' />
          <Field styles={styles} palette={palette} label='Relationship' field='emergency_relationship' f={f} set={set} edit={editMode} />
        </View>

        {/* SOCIAL */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SOCIAL</Text>
          <Field styles={styles} palette={palette} label='Twitter / X' field='social_twitter' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Instagram' field='social_instagram' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='Facebook' field='social_facebook' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='LinkedIn' field='social_linkedin' f={f} set={set} edit={editMode} />
          <Field styles={styles} palette={palette} label='TikTok' field='social_tiktok' f={f} set={set} edit={editMode} />
        </View>

        {/* NOTIFICATIONS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>NOTIFICATIONS</Text>
          <Toggle styles={styles} label='SMS' field='notify_sms' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='WhatsApp' field='notify_whatsapp' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='Weather alerts' field='notify_weather' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='Disease alerts' field='notify_disease' f={f} set={set} edit={editMode} />
          <Toggle styles={styles} label='Payment alerts' field='notify_payment' f={f} set={set} edit={editMode} />
        </View>

        {/* MENU */}
        {SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}><Text style={styles.sectionIcon}>{section.icon}</Text></View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.sectionItems}>
              {section.items.map((item, ii) => (
                <Pressable
                  key={ii}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [styles.item, ii === section.items.length - 1 && styles.itemLast, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin' as any)} style={styles.adminItem}>
            <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
            <Text style={styles.adminChevron}>›</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => signOut()} style={styles.logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={styles.version}>GAIA Mobile v1.0.0</Text>
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

function mask11(v?: string) {
  if (!v) return '—';
  const s = String(v);
  if (s.length <= 4) return '•'.repeat(s.length);
  return '•'.repeat(s.length - 4) + s.slice(-4);
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return '—'; }
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

function Picker({ styles, palette, label, field, options, f, set, edit }: any) {
  const current = String(f[field] ?? '');
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {edit ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {options.map((opt: string, i: number) => {
            const val = opt;
            const on = current === val;
            return (
              <Pressable
                key={i}
                onPress={() => set(field, val)}
                style={[styles.pill, on && styles.pillOn]}
              >
                <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>{val || 'None'}</Text>
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

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap: { width: 110, height: 110, position: 'relative' },
  avatarImg: { width: 110, height: 110, borderRadius: 55 },
  avatarFallback: { width: 110, height: 110, borderRadius: 55, backgroundColor: palette.neonSoft, borderWidth: 2, borderColor: palette.borderHi, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 44, fontWeight: '900', color: palette.neon },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: palette.neon, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.obsidian },
  avatarEditText: { fontSize: 20, fontWeight: '900', color: palette.obsidian, lineHeight: 22 },
  name: { fontSize: 24, fontWeight: '900', color: palette.text, marginTop: spacing.md, textTransform: 'capitalize', letterSpacing: -0.5 },
  email: { fontSize: 14, color: palette.textMuted, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  verifyBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  verifyBtnTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', color: palette.neon },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: palette.textMuted, marginTop: 4 },
  modeBar: { flexDirection: 'row', marginBottom: spacing.lg },
  modeBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: palette.neon, alignItems: 'center' },
  modeBtnTxt: { fontSize: 12, fontWeight: '900', color: palette.obsidian, letterSpacing: 1.2 },
  card: { marginBottom: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cardTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: palette.textMuted, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontSize: 12, color: palette.textMuted, flex: 1, marginRight: 12 },
  rowValue: { fontSize: 13, fontWeight: '800', color: palette.text, textAlign: 'right', flex: 1 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: palette.textMuted, marginBottom: 6 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: palette.text, paddingVertical: 4 },
  fieldInput: { backgroundColor: palette.obsidian, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: palette.text, fontSize: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.obsidian },
  pillOn: { borderColor: palette.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  pillTxt: { fontSize: 11, fontWeight: '700', color: palette.textDim },
  pillTxtOn: { color: palette.neon },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  toggleRowOn: { backgroundColor: 'rgba(0,255,136,0.06)' },
  toggleBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: palette.borderHi, alignItems: 'center', justifyContent: 'center' },
  toggleBoxOn: { backgroundColor: palette.neon, borderColor: palette.neon },
  toggleMark: { color: palette.obsidian, fontWeight: '900', fontSize: 13 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: palette.text },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.neonSoft, borderWidth: 1, borderColor: palette.borderHi, alignItems: 'center', justifyContent: 'center' },
  sectionIcon: { fontSize: 9, fontWeight: '900', color: palette.neon, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8, color: palette.textMuted },
  sectionItems: { borderRadius: radius.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border },
  itemLast: { borderBottomWidth: 0 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: palette.text },
  itemChevron: { fontSize: 20, color: palette.textDim },
  adminItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderRadius: radius.md, backgroundColor: 'rgba(255,60,90,0.08)', borderWidth: 1.5, borderColor: palette.danger, marginBottom: spacing.lg },
  adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: palette.danger },
  adminChevron: { fontSize: 22, color: palette.danger },
  logout: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: palette.danger, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '800', color: palette.danger },
  version: { fontSize: 10, color: palette.textDim, textAlign: 'center', marginTop: spacing.xl, letterSpacing: 1 },
});
