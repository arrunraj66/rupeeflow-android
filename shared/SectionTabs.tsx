import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function SectionTabs<T extends string>({items, selected, onSelect}: {
  items: {name:T; icon:keyof typeof Ionicons.glyphMap}[]; selected:T; onSelect:(name:T)=>void;
}) {
  return <View style={s.wrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
    {items.map(item => <Pressable key={item.name} accessibilityRole="tab" accessibilityState={{selected:item.name===selected}}
      onPress={()=>onSelect(item.name)} style={[s.tab, item.name===selected && s.active]}>
      <Ionicons name={item.icon} size={16} color={item.name===selected?'#65DEEB':'#A5B3CB'} />
      <Text style={[s.label,item.name===selected && {color:'#EDF3FF'}]}>{item.name}</Text>
    </Pressable>)}
  </ScrollView></View>;
}
const s=StyleSheet.create({wrap:{backgroundColor:'#080E1D',borderBottomWidth:1,borderBottomColor:'#22324B'},row:{paddingHorizontal:16,paddingVertical:10,gap:8},tab:{minHeight:44,paddingHorizontal:14,borderRadius:14,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'transparent'},active:{backgroundColor:'#172D42',borderColor:'#355E73'},label:{color:'#A5B3CB',fontSize:12,fontWeight:'700'}});
