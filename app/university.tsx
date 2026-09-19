import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, typography, spacing, radius } from '../src/theme';

interface Lesson { title: string; body: string; }
interface Course { id: string; title: string; emoji: string; lessons: Lesson[]; }

const COURSES: Course[] = [
  {
    id: 'maize', title: 'Maize Agronomist', emoji: '🌽',
    lessons: [
      { title: 'Choosing the right variety', body: 'Match the maize variety to your rainfall zone. For the southern rainforest, use late‑maturing varieties (100–120 days). For the northern savannah, use early‑maturing varieties (80–90 days) that escape drought. Always buy certified seed from a licensed agro‑dealer — not from the open market.' },
      { title: 'Land preparation', body: 'Maize needs deep, well‑drained loamy soil. Plough to 20–30 cm depth. Add 4–6 tonnes of compost or poultry manure per hectare two weeks before planting. Avoid planting on sloped land without ridges — erosion will wash away your seed.' },
      { title: 'Spacing and planting density', body: 'For grain maize: 75 cm between rows, 25 cm within rows = about 53,000 plants per hectare. Plant 2 seeds per hole, thin to 1 after 10 days. Depth: 3–4 cm in moist soil, deeper in dry soil.' },
      { title: 'Fertilizer application', body: 'Basal: NPK 15‑15‑15 at 4 bags per hectare (200 kg) at planting. Top dressing: Urea 2 bags per hectare (100 kg) at 4–6 weeks, or when maize is knee‑high. Split urea in two applications if rain is erratic.' },
      { title: 'Weed control', body: 'Weed early — the first 6 weeks are critical. Use pre‑emergence herbicide (Atrazine + S‑metolachlor) at planting. Follow with hand weeding at 4 and 8 weeks if needed. Never let weeds go to seed.' },
      { title: 'Pest management', body: 'Scout weekly. Fall armyworm appears first on young leaves — look for small holes and moist sawdust‑like frass. Apply Emamectin benzoate 1.9% EC at 400 ml/ha. For stem borers, use neem oil or Bacillus thuringiensis.' },
      { title: 'Harvesting and storage', body: 'Harvest when husks are dry and kernels dented (black layer at the base). Dry to 13% moisture before storage — use a moisture meter. Store in PICS bags or with Actellic dust. Poor storage loses 20–30% of grain.' },
    ],
  },
  {
    id: 'rice', title: 'Rice Farming Basics', emoji: '🌾',
    lessons: [
      { title: 'Choosing a rice system', body: 'Upland rice needs 800 mm+ rainfall, planted on flat land with no standing water. Lowland rice is transplanting into bunded fields — higher yield but more labour. Irrigation rice gives the highest yield and is best for commercial farming.' },
      { title: 'Nursery management', body: 'Prepare a nursery bed 1 m wide, 10 m long. Sow pre‑germinated seed at 50 g/m². Keep moist — never flooded. Transplant 21‑day‑old seedlings. Handle roots gently; damaged roots mean delayed establishment.' },
      { title: 'Field preparation', body: 'Puddle the soil 2 weeks before transplanting. Level the field — a 5 cm water depth difference across the field causes uneven growth and ripening. Construct bunds 20 cm high to hold water.' },
      { title: 'Transplanting and spacing', body: 'Use 20 cm × 20 cm spacing for good tillering. Plant 2–3 seedlings per hill. Transplant in the cool of the morning or evening. Water depth at transplant: 2–3 cm — just enough to keep soil soft.' },
      { title: 'Water management', body: 'Maintain 2–5 cm water during tillering. Drain briefly at maximum tillering to encourage strong root systems. Refill to 5 cm during flowering — this is when water stress causes the greatest yield loss.' },
      { title: 'Fertilizer schedule', body: 'Basal: NPK 20‑10‑10 at 250 kg/ha at transplanting. Top dress: Urea 100 kg/ha at 3 weeks, and again at 6 weeks. Apply on drained soil, then re‑flood after 24 hours.' },
    ],
  },
  {
    id: 'soil', title: 'Soil Science', emoji: '🌱',
    lessons: [
      { title: 'Soil texture and structure', body: 'Soil is a mix of sand (large particles), silt (medium), and clay (small). Loam — a balanced mix — is the best for most crops. Structure refers to how particles clump into aggregates. Good structure = good drainage + good water holding.' },
      { title: 'Soil pH and nutrient availability', body: 'Most crops prefer pH 6.0–7.0. Below 5.5, phosphorus locks up and aluminium becomes toxic. Above 7.5, iron and zinc become unavailable. Test your soil before adding lime or gypsum.' },
      { title: 'Organic matter — the engine of soil', body: 'Add 4–6 tonnes per hectare of compost or manure each year. Organic matter holds 10× its weight in water, feeds soil biology, and slowly releases nutrients. Soil with 4% organic matter yields 30–50% more than soil with 1%.' },
      { title: 'The three macronutrients', body: 'Nitrogen (N) drives leaf growth. Phosphorus (P) drives roots, flowering and seed set. Potassium (K) drives fruit quality, drought tolerance, and disease resistance. Deficiencies show in leaves — know the signs.' },
      { title: 'Reading deficiency symptoms', body: 'N deficiency: pale yellow older leaves first. P deficiency: purple/dark green leaves, stunted plants. K deficiency: scorched leaf edges on older leaves. Mg: yellow between veins. Fe: yellow young leaves. Zn: short internodes.' },
      { title: 'Conservation practices', body: 'Never burn crop residue — it destroys organic matter. Keep soil covered with mulch or cover crops. Practise minimum tillage. Contour ridges on slopes. Rotate cereals with legumes to break pest cycles and fix nitrogen.' },
    ],
  },
  {
    id: 'pest', title: 'Pest Management', emoji: '🐛',
    lessons: [
      { title: 'Integrated Pest Management (IPM)', body: 'IPM combines cultural, biological, and chemical control. Scout weekly. Act only when the pest population crosses the economic threshold. Save chemicals as the last resort — not the first.' },
      { title: 'Fall Armyworm (FAW)', body: 'FAW attacks maize, sorghum, and rice. Scout at 3 and 6 weeks after planting. Look for windowpane damage on young leaves and moist sawdust frass. Spray in the evening with Emamectin benzoate, Chlorantraniliprole, or Spinetoram.' },
      { title: 'Stem borers', body: 'Stem borers drill into rice and maize stems, causing "dead heart" in young plants and "white head" at flowering. Release Trichogramma wasps (biological control) every week. Or apply Cartap hydrochloride granules in leaf whorls.' },
      { title: 'Aphids and whiteflies', body: 'These sap‑sucking pests transmit viruses. Use yellow sticky traps to monitor. Spray neem oil (5 ml/L) at first sight. For severe infestations use Imidacloprid — but rotate with another class to prevent resistance.' },
      { title: 'Safe pesticide use', body: 'Always read the label. Wear gloves, boots, and a mask. Spray in the evening — no wind, and bees are less active. Never eat or drink while spraying. Wash clothes separately. Store locked away from food and children.' },
      { title: 'Cultural controls that work', body: 'Push‑pull: interplant maize with Desmodium (repels stem borers) and border with Napier grass (traps them). Rotate crops. Destroy crop residue. Plant early to escape peak pest season. Use resistant varieties where available.' },
    ],
  },
];

export default function University() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [progress, setProgress] = useState<Record<string, string[]>>({});
  const [active, setActive] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('gaia.university.progress');
      if (raw) setProgress(JSON.parse(raw));
    })();
  }, []);

  const markComplete = async (courseId: string, lessonTitle: string) => {
    const next = { ...progress };
    const arr = next[courseId] || [];
    if (!arr.includes(lessonTitle)) arr.push(lessonTitle);
    next[courseId] = arr;
    setProgress(next);
    await AsyncStorage.setItem('gaia.university.progress', JSON.stringify(next));
  };

  const pctFor = (c: Course) => Math.round(((progress[c.id] || []).length / c.lessons.length) * 100);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>GAIA UNIVERSITY</Text>
        <Text style={styles.title}>Learn farming</Text>
        <Text style={styles.subtitle}>Free practical courses for African farmers.</Text>

        {COURSES.map((c) => {
          const pct = pctFor(c);
          return (
            <Pressable key={c.id} onPress={() => setActive(c)} style={styles.courseCard}>
              <Text style={styles.courseEmoji}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{c.title}</Text>
                <Text style={styles.courseModules}>{c.lessons.length} lessons · {pct}% complete</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Course lesson list */}
      <Modal visible={!!active && !lesson} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>COURSE</Text>
            <Text style={styles.modalTitle}>{active?.emoji}  {active?.title}</Text>
            <ScrollView>
              {active?.lessons.map((l, i) => {
                const done = (progress[active.id] || []).includes(l.title);
                return (
                  <Pressable key={i} onPress={() => setLesson(l)} style={styles.lessonRow}>
                    <Text style={[styles.lessonIndex, done && { color: palette.neon }]}>
                      {done ? '✓' : String(i + 1)}
                    </Text>
                    <Text style={styles.lessonTitle}>{l.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setActive(null)} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Lesson content */}
      <Modal visible={!!lesson} transparent animationType="slide" onRequestClose={() => setLesson(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>LESSON</Text>
            <Text style={styles.modalTitle}>{lesson?.title}</Text>
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={styles.lessonBody}>{lesson?.body}</Text>
            </ScrollView>
            <Pressable
              onPress={async () => {
                if (active && lesson) await markComplete(active.id, lesson.title);
                setLesson(null);
              }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeTxt}>MARK COMPLETE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 6 },
  subtitle: { fontSize: 14, color: p.textMuted, marginTop: 4, marginBottom: 22 },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  courseEmoji: { fontSize: 34 },
  courseTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  courseModules: { fontSize: 11, color: p.textMuted, marginTop: 2, marginBottom: 8 },
  barBg: { height: 4, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: p.neon },
  chevron: { fontSize: 24, color: p.textDim },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: '85%', borderTopWidth: 1, borderColor: p.borderHi },
  modalKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6, marginBottom: 16 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: p.border },
  lessonIndex: { fontSize: 14, fontWeight: '900', color: p.textDim, width: 24 },
  lessonTitle: { fontSize: 14, color: p.text, fontWeight: '600', flex: 1 },
  lessonBody: { fontSize: 15, lineHeight: 24, color: '#ddd' },
  closeBtn: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  closeTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
