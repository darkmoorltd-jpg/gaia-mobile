import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { useTheme } from '../theme';
import { WIDGET_REGISTRY, Widget } from '../utils/dashboardLayout';
import { tap as hapticTap } from '../utils/haptics';

interface Props {
  visible: boolean;
  layout: Widget[];
  onToggle: (id: string, enabled: boolean) => void;
  onClose: () => void;
}

export default function WidgetLibraryModal({ visible, layout, onToggle, onClose }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const getEnabled = (id: string) => !!layout.find((w) => w.id === id)?.enabled;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.sheet}>
          <Pressable onPress={onClose} style={{ alignSelf: 'flex-start' }}>
            <Text style={styles.close}>DONE</Text>
          </Pressable>
          <Text style={styles.title}>Widget Library</Text>
          <Text style={styles.sub}>Turn widgets on or off. Reorder with the arrows on the dashboard.</Text>

          <ScrollView style={{ maxHeight: '75%' }} showsVerticalScrollIndicator={false}>
            {WIDGET_REGISTRY.map((w) => {
              const on = getEnabled(w.id);
              return (
                <Pressable
                  key={w.id}
                  onPress={() => { hapticTap(); onToggle(w.id, !on); }}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <Text style={styles.icon}>{w.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{w.title}</Text>
                    <Text style={styles.rowDesc} numberOfLines={2}>{w.description}</Text>
                  </View>
                  <Switch
                    value={on}
                    onValueChange={(v) => { hapticTap(); onToggle(w.id, v); }}
                    trackColor={{ false: palette.border, true: 'rgba(0,255,136,0.4)' }}
                    thumbColor={on ? palette.neon : palette.textDim}
                  />
                </Pressable>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: p.abyss,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 22, maxHeight: '88%',
  },
  close: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  title: { fontSize: 22, fontWeight: '900', color: p.text, marginTop: 6 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: p.surface, borderRadius: 14,
    marginBottom: 8, borderWidth: 1, borderColor: p.border,
  },
  rowOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.06)' },
  icon: { fontSize: 26 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  rowDesc: { fontSize: 11, color: p.textMuted, marginTop: 2 },
});
