import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { tap as hapticTap } from '../utils/haptics';
import { WIDGET_REGISTRY } from '../utils/dashboardLayout';

interface Props {
  id: string;
  editing: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

export default function DashboardWidget({
  id, editing, canUp, canDown, onUp, onDown, onRemove, children,
}: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const def = WIDGET_REGISTRY.find((w) => w.id === id);
  const title = def?.title ?? id;
  const icon = def?.icon ?? '\u25CB';

  if (!children) return null;

  if (!editing) {
    return <View style={styles.wrap}>{children}</View>;
  }

  return (
    <View style={styles.editWrap}>
      <View style={styles.editBar}>
        <Text style={styles.editIcon}>{icon}</Text>
        <Text style={styles.editTitle} numberOfLines={1}>{title}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => { hapticTap(); onUp(); }}
          disabled={!canUp}
          style={[styles.iconBtn, !canUp && { opacity: 0.25 }]}
        >
          <Text style={styles.iconText}>{'\u2191'}</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticTap(); onDown(); }}
          disabled={!canDown}
          style={[styles.iconBtn, !canDown && { opacity: 0.25 }]}
        >
          <Text style={styles.iconText}>{'\u2193'}</Text>
        </Pressable>
        <Pressable
          onPress={() => { hapticTap(); onRemove(); }}
          style={[styles.iconBtn, styles.removeBtn]}
        >
          <Text style={[styles.iconText, { color: '#fff' }]}>X</Text>
        </Pressable>
      </View>
      <View style={styles.editBody} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  wrap: { marginBottom: 12 },
  editWrap: {
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: p.neon,
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,136,0.03)',
    overflow: 'hidden',
  },
  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,255,136,0.12)',
    gap: 8,
  },
  editIcon: { fontSize: 16 },
  editTitle: { fontSize: 12, fontWeight: '800', color: p.neon, letterSpacing: 0.5 },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  removeBtn: { backgroundColor: 'rgba(255,60,90,0.7)' },
  iconText: { fontSize: 15, fontWeight: '900', color: p.neon },
  editBody: { padding: 10, opacity: 0.85 },
});
