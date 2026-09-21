import React, { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme';

export function ScreenTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function IconButton({ icon, onPress, dark = false, size = 20 }: { icon: keyof typeof Ionicons.glyphMap; onPress(): void; dark?: boolean; size?: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.iconButton, dark && styles.iconButtonDark]}>
      <Ionicons name={icon} size={size} color={dark ? '#080E1D' : colors.ink} />
    </Pressable>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={colors.green} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '800', letterSpacing: -1.1 },
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: 18, ...shadow },
  iconButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  iconButtonDark: { backgroundColor: colors.green },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 28 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 17, marginBottom: 5 },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
