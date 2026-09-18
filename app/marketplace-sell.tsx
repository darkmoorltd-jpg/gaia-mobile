import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Image, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  createListing, uploadListingImage, isVerifiedSeller,
  CATEGORIES, UNITS,
} from '../src/utils/marketplace';

const { width } = Dimensions.get('window');
const PICK_W = (width - 60) / 3;

export default function SellForm() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [verified, setVerified] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Maize');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('per ton');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const ok = await isVerifiedSeller(user.id);
      setVerified(ok);
      if (!ok) router.replace('/marketplace-verify-gate' as any);
    })();
  }, [user]);

  const pickPhoto = async () => {
    if (photos.length >= 6) {
      Alert.alert('Max 6 photos');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled) setPhotos([...photos, res.assets[0].uri]);
  };

  const removePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const publish = async () => {
    if (!user) return;
    if (!title.trim() || !price || !quantity) {
      Alert.alert('Missing fields', 'Title, price, and quantity are required');
      return;
    }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const p of photos) {
        const u = await uploadListingImage(user.id, p);
        if (u) urls.push(u);
      }
      const { id, error } = await createListing(user.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        price: Number(price),
        unit,
        quantity: Number(quantity),
        location: location.trim(),
        images: urls,
        delivery_method: 'both',
        delivery_fee: 2500,
      });
      if (error || !id) {
        Alert.alert('Failed', error || 'Could not publish');
      } else {
        Alert.alert('Published', 'Your listing is live');
        router.replace('/marketplace-store' as any);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unknown error');
    }
    setBusy(false);
  };

  if (verified === null) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>New listing</Text>

        <Text style={styles.label}>PHOTOS (max 6)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {photos.map((p, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image source={{ uri: p }} style={styles.photo} />
                <Pressable onPress={() => removePhoto(i)} style={styles.removeBtn}>
                  <Text style={styles.removeTxt}>x</Text>
                </Pressable>
              </View>
            ))}
            {photos.length < 6 ? (
              <Pressable onPress={pickPhoto} style={styles.addPhoto}>
                <Text style={styles.addPhotoTxt}>+</Text>
                <Text style={styles.addPhotoSub}>Add photo</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>

        <Text style={styles.label}>TITLE *</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Yellow Maize Grade A"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CATEGORIES.filter((c) => c !== 'All').map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[styles.chipTxt, category === c && styles.chipTxtActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Quality, harvest date, storage conditions…"
          placeholderTextColor={palette.textDim}
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
        />

        <Text style={styles.label}>PRICE (N) *</Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="45000"
          keyboardType="number-pad"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>UNIT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {UNITS.map((u) => (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.chip, unit === u && styles.chipActive]}
              >
                <Text style={[styles.chipTxt, unit === u && styles.chipTxtActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>QUANTITY AVAILABLE *</Text>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          placeholder="250"
          keyboardType="number-pad"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>LOCATION</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Kaduna, Nigeria"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Pressable onPress={publish} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>PUBLISH LISTING</Text>}
        </Pressable>

        <Text style={styles.note}>You earn 95% of sale price · GAIA takes 5% platform fee</Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: p.text, fontSize: 15, marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipTxt: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  chipTxtActive: { color: p.obsidian },
  photo: { width: PICK_W, height: PICK_W, borderRadius: 12 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: p.danger, alignItems: 'center', justifyContent: 'center',
  },
  removeTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  addPhoto: {
    width: PICK_W, height: PICK_W, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addPhotoTxt: { fontSize: 30, color: p.neon, fontWeight: '300' },
  addPhotoSub: { fontSize: 10, color: p.textMuted, marginTop: 4 },
  cta: {
    marginTop: 24, paddingVertical: 18, borderRadius: 14,
    backgroundColor: p.neon, alignItems: 'center',
  },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  note: { fontSize: 11, color: p.textDim, textAlign: 'center', marginTop: 12 },
});
