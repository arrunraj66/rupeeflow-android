// Shared glass surfaces, fields, and press feedback. System insets are handled by the app shell.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
export const C = { ink: '#F4F7FF', muted: '#A9B6CF', cyan: '#5DEBFF', green: '#63EFB1', red: '#FF7B99', violet: '#B7A0FF', border: '#344461' };
export function Card({ children }: React.PropsWithChildren) { return <View style={S.card}>{children}</View>; }
export function Page({ children }: React.PropsWithChildren) { return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={S.page}>{children}</ScrollView>; }
export function Heading({ title, sub }: { title: string; sub: string }) { return <View style={{ marginBottom: 20 }}><Text style={S.eyebrow}>{sub}</Text><Text style={S.title}>{title}</Text></View>; }
export function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [S.button, { opacity: disabled ? .4 : 1, backgroundColor: pressed ? '#385C80' : '#19354F', transform: [{ scale: pressed ? .97 : 1 }] }]}><Text style={S.buttonText}>{label}</Text></Pressable>;
}
export function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={{ marginVertical: 8 }}><Text style={S.label}>{label}</Text><TextInput {...props} placeholderTextColor="#7788A6" style={[S.input, props.multiline && { minHeight: 120, textAlignVertical: 'top' }]} /></View>;
}
export const S = StyleSheet.create({
  page: { padding: 18, paddingBottom: 36 }, card: { backgroundColor: 'rgba(19,28,49,0.88)', borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 18, marginBottom: 14 },
  title: { color: C.ink, fontSize: 29, fontWeight: '800' }, eyebrow: { color: C.cyan, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 },
  h: { color: C.ink, fontSize: 17, fontWeight: '700', marginBottom: 7 }, text: { color: C.ink, fontSize: 14, lineHeight: 21 }, muted: { color: C.muted, fontSize: 12, lineHeight: 19 },
  money: { color: C.ink, fontSize: 32, fontWeight: '800', marginVertical: 6 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  button: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: '#477690', marginTop: 10, minHeight: 45 }, buttonText: { color: C.cyan, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  label: { color: C.muted, fontSize: 12, marginBottom: 6 }, input: { color: C.ink, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 13, backgroundColor: '#0B1426', fontSize: 15 },
  section: { color: C.ink, fontSize: 18, fontWeight: '700', marginVertical: 14 }, separator: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  nav: { flexDirection: 'row', backgroundColor: '#101A2F', borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 5, marginHorizontal: 12 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 59, borderRadius: 16, gap: 4 }, navLabel: { fontSize: 10, fontWeight: '700' },
  shade: { flex: 1, justifyContent: 'center', backgroundColor: '#000B', padding: 16 }, sheet: { backgroundColor: '#101A2F', borderRadius: 25, padding: 20, maxHeight: '92%' },
  pill: { padding: 9, borderWidth: 1, borderColor: C.border, borderRadius: 12 },
});
