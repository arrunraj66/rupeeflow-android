import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Plan from './modules/plan/App';
import Media from './modules/media/App';
import Money from './modules/money/App';

type Space='Plan'|'Media'|'Money';
const spaces: {name:Space; icon:keyof typeof Ionicons.glyphMap; detail:string}[]=[
  {name:'Plan',icon:'planet-outline',detail:'Tasks & time'},
  {name:'Media',icon:'headset-outline',detail:'Music & video'},
  {name:'Money',icon:'wallet-outline',detail:'Finance & insights'},
];
export default function App(){
  const [space,setSpace]=useState<Space>('Plan');
  const [opened,setOpened]=useState<Space[]>(['Plan','Money']);
  const [help,setHelp]=useState(false);
  const select=(name:Space)=>{setOpened(old=>old.includes(name)?old:[...old,name]);setSpace(name);};
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><StatusBar style="light" />
    <SafeAreaView style={s.safe}>
      <View style={s.frame}>
        <View style={s.header}>
          <View style={s.mark}><Ionicons name="layers-outline" size={24} color="#65DEEB" /></View>
          <View style={{flex:1}}><Text style={s.brand}>ARUN <Text style={{color:'#65DEEB'}}>ONE</Text></Text><Text style={s.tag}>YOUR PERSONAL SPACE</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Setup and data transfer help" onPress={()=>setHelp(true)} style={s.help}><Ionicons name="information-circle-outline" size={24} color="#B9AAFF" /></Pressable>
        </View>
        <View style={s.content}>
          {/* Keep mounted: switching spaces must not stop music or discard forms. */}
          {spaces.map(({name})=>opened.includes(name)&&<View key={name} style={[s.space,space!==name&&s.hidden]} accessibilityElementsHidden={space!==name} importantForAccessibility={space===name?'auto':'no-hide-descendants'}>
            {name==='Plan'?<Plan/>:name==='Media'?<Media/>:<Money/>}
          </View>)}
        </View>
        <View style={s.nav}>{spaces.map(item=><Pressable key={item.name} onPress={()=>select(item.name)} accessibilityRole="tab" accessibilityState={{selected:space===item.name}} style={[s.navItem,space===item.name&&s.navActive]}>
          <Ionicons name={item.icon} size={22} color={space===item.name?'#65DEEB':'#899CB9'} />
          <Text style={[s.navTitle,space===item.name&&{color:'#EDF3FF'}]}>{item.name}</Text>
          <Text style={s.navDetail}>{item.detail}</Text>
        </Pressable>)}</View>
      </View>
      <Modal visible={help} animationType="slide" onRequestClose={()=>setHelp(false)}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.helpPage}>
        <Text style={s.helpTitle}>Welcome to Arun One</Text>
        <Text style={s.copy}>Three familiar tools, one personal space. Use the bottom bar to switch spaces and the tabs above each screen to find every feature.</Text>
        <Text style={s.helpHeading}>Bring your finances</Text><Text style={s.copy}>In your existing RupeeFlow app, export a JSON backup from Profile. Open Money → Profile here and restore that backup. Your original app stays separate. Re-enable SMS and notification access in Money → Inbox.</Text>
        <Text style={s.helpHeading}>Tasks and media</Text><Text style={s.copy}>Android keeps each app’s private data separate. Re-enter existing Dayflow tasks and alarms; there is no automatic import from its old installation. Open Media to rescan your phone’s music and videos. Pulse favourites, listening history and sound preferences start fresh.</Text>
        <Text style={s.helpHeading}>Permissions on your phone</Text><Text style={s.copy}>Allow notifications and Alarms & reminders for scheduled reminders. For reliable delivery on iQOO, check the app’s background activity and autostart settings. SMS, payment notifications and media access remain separate choices.</Text>
        <Text style={s.helpHeading}>Sound and privacy</Text><Text style={s.copy}>Music continues when you switch spaces. Starting an imported track in Plan pauses Media, and starting Media pauses Plan. Bluetooth routing, equalizer effects and Picture in Picture depend on your Android device. Financial records stay on your phone unless you export them.</Text>
        <Pressable style={s.done} onPress={()=>setHelp(false)} accessibilityRole="button"><Text style={s.doneText}>Explore your space</Text></Pressable>
      </ScrollView></SafeAreaView></Modal>
    </SafeAreaView>
  </SafeAreaProvider>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#080E1D'},frame:{flex:1,width:'100%',maxWidth:1000,alignSelf:'center'},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:12,gap:12,borderBottomWidth:1,borderBottomColor:'#22324B'},mark:{width:42,height:42,borderRadius:14,backgroundColor:'#152C40',borderWidth:1,borderColor:'#30566C',alignItems:'center',justifyContent:'center'},brand:{color:'#EDF3FF',fontSize:19,fontWeight:'800',letterSpacing:2.4},tag:{color:'#899CB9',fontSize:9,letterSpacing:2,marginTop:4},help:{width:44,height:44,alignItems:'center',justifyContent:'center'},content:{flex:1},space:{flex:1},hidden:{display:'none'},nav:{flexDirection:'row',padding:8,gap:8,borderTopWidth:1,borderTopColor:'#22324B',backgroundColor:'#0B1325'},navItem:{flex:1,alignItems:'center',justifyContent:'center',minHeight:73,paddingVertical:8,borderRadius:18,borderWidth:1,borderColor:'transparent',gap:3},navActive:{backgroundColor:'#172C43',borderColor:'#345B75'},navTitle:{color:'#A5B3CB',fontSize:13,fontWeight:'800'},navDetail:{color:'#899CB9',fontSize:9},helpPage:{padding:24,paddingBottom:40},helpTitle:{fontSize:30,color:'#EDF3FF',fontWeight:'800',marginBottom:18},helpHeading:{fontSize:18,color:'#65DEEB',fontWeight:'700',marginTop:24,marginBottom:8},copy:{fontSize:15,lineHeight:24,color:'#B8C7DE'},done:{backgroundColor:'#65DEEB',padding:17,borderRadius:16,marginTop:30,alignItems:'center'},doneText:{fontSize:16,fontWeight:'800',color:'#080E1D'}
});
