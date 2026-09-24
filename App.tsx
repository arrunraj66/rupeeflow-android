import React, { Component, ErrorInfo, PropsWithChildren, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Plan from './modules/plan/App';
import Media from './modules/media/App';
import Money from './modules/money/App';
import { HomeScreen, LockGate, MoreScreen, OneProvider } from './one/OneHub';

type Space='Home'|'Plan'|'Media'|'Money'|'More';
const spaces: {name:Space; icon:keyof typeof Ionicons.glyphMap; detail:string}[]=[
  {name:'Home',icon:'grid-outline',detail:'Your day'},
  {name:'Plan',icon:'planet-outline',detail:'Tasks & time'},
  {name:'Media',icon:'headset-outline',detail:'Music & video'},
  {name:'Money',icon:'wallet-outline',detail:'Finance & insights'},
  {name:'More',icon:'options-outline',detail:'Tools & privacy'},
];
export default function App(){
  return <RootErrorBoundary><OneProvider><LockGate><MainShell/></LockGate></OneProvider></RootErrorBoundary>;
}
class RootErrorBoundary extends Component<PropsWithChildren,{failed:boolean;message:string}> {
  state={failed:false,message:''};
  static getDerivedStateFromError(error:Error){return {failed:true,message:error.message||'Unexpected startup error'};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('Arun One recovered from a UI error',error,info.componentStack);}
  render(){if(this.state.failed)return <View style={s.recovery}><Ionicons name="shield-checkmark-outline" size={56} color="#65DEEB"/><Text style={s.recoveryTitle}>Arun One protected your data</Text><Text style={s.recoveryCopy}>A screen could not open safely. Your Plan, Media and Money data has not been deleted.</Text><Pressable style={s.done} onPress={()=>this.setState({failed:false,message:''})}><Text style={s.doneText}>Try opening again</Text></Pressable><Text selectable style={s.recoveryCode}>{this.state.message}</Text></View>;return this.props.children;}
}
function MainShell(){
  const [space,setSpace]=useState<Space>('Home');
  // Keep native capture and OEM permission probes out of the critical startup path.
  const [opened,setOpened]=useState<Space[]>(['Home']);
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
          {/* Spaces mount on first use, then stay mounted so playback/forms persist. */}
          {spaces.map(({name})=>opened.includes(name)&&<View key={name} style={[s.space,space!==name&&s.hidden]} accessibilityElementsHidden={space!==name} importantForAccessibility={space===name?'auto':'no-hide-descendants'}>
            {name==='Home'?<HomeScreen select={select}/>:name==='Plan'?<Plan/>:name==='Media'?<Media/>:name==='Money'?<Money/>:<MoreScreen/>}
          </View>)}
        </View>
        <View style={s.nav}>{spaces.map(item=><Pressable key={item.name} onPress={()=>select(item.name)} accessibilityRole="tab" accessibilityState={{selected:space===item.name}} style={[s.navItem,space===item.name&&s.navActive]}>
          <Ionicons name={item.icon} size={22} color={space===item.name?'#65DEEB':'#899CB9'} />
          <Text style={[s.navTitle,space===item.name&&{color:'#EDF3FF'}]}>{item.name}</Text>
          <Text style={s.navDetail}>{item.detail}</Text>
        </Pressable>)}</View>
      </View>
      <Modal visible={help} animationType="slide" onRequestClose={()=>setHelp(false)}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.helpPage}>
        <Text style={s.helpTitle}>Welcome to Arun One 2.0</Text>
        <Text style={s.copy}>Plan, Media and Money now meet in one dashboard. Home gives you search, quick actions, summaries and the private offline Arun Assistant. More contains permissions, privacy, backups, automation and Feature Lab.</Text>
        <Text style={s.helpHeading}>Bring your finances</Text><Text style={s.copy}>In your existing RupeeFlow app, export a JSON backup from Profile. Open Money → Profile here and restore that backup. Your original app stays separate. Re-enable SMS and notification access in Money → Inbox.</Text>
        <Text style={s.helpHeading}>Tasks and media</Text><Text style={s.copy}>Android keeps each app’s private data separate. Re-enter existing Dayflow tasks and alarms; there is no automatic import from its old installation. Open Media to rescan your phone’s music and videos. Pulse favourites, listening history and sound preferences start fresh.</Text>
        <Text style={s.helpHeading}>Permissions on your phone</Text><Text style={s.copy}>Open More → Permission & reliability. It checks notifications, exact alarms, full-screen alarms, phone security and battery access, with direct Fix buttons. For reliable delivery on iQOO, also enable Arun One Autostart.</Text>
        <Text style={s.helpHeading}>Try or remove preview features</Text><Text style={s.copy}>Open More → Feature Lab. Every 2.0 area has its own switch. Turning a feature off hides it without deleting your existing data.</Text>
        <Text style={s.helpHeading}>Sound and privacy</Text><Text style={s.copy}>Music continues when you switch spaces. Starting an imported track in Plan pauses Media, and starting Media pauses Plan. Bluetooth routing, equalizer effects and Picture in Picture depend on your Android device. Financial records stay on your phone unless you export them.</Text>
        <Pressable style={s.done} onPress={()=>setHelp(false)} accessibilityRole="button"><Text style={s.doneText}>Explore Arun One 2.0</Text></Pressable>
      </ScrollView></SafeAreaView></Modal>
    </SafeAreaView>
  </SafeAreaProvider>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#080E1D'},frame:{flex:1,width:'100%',maxWidth:1000,alignSelf:'center'},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:12,gap:12,borderBottomWidth:1,borderBottomColor:'#22324B'},mark:{width:42,height:42,borderRadius:14,backgroundColor:'#152C40',borderWidth:1,borderColor:'#30566C',alignItems:'center',justifyContent:'center'},brand:{color:'#EDF3FF',fontSize:19,fontWeight:'800',letterSpacing:2.4},tag:{color:'#899CB9',fontSize:9,letterSpacing:2,marginTop:4},help:{width:44,height:44,alignItems:'center',justifyContent:'center'},content:{flex:1},space:{flex:1},hidden:{display:'none'},nav:{flexDirection:'row',padding:8,gap:8,borderTopWidth:1,borderTopColor:'#22324B',backgroundColor:'#0B1325'},navItem:{flex:1,alignItems:'center',justifyContent:'center',minHeight:73,paddingVertical:8,borderRadius:18,borderWidth:1,borderColor:'transparent',gap:3},navActive:{backgroundColor:'#172C43',borderColor:'#345B75'},navTitle:{color:'#A5B3CB',fontSize:13,fontWeight:'800'},navDetail:{color:'#899CB9',fontSize:9},helpPage:{padding:24,paddingBottom:40},helpTitle:{fontSize:30,color:'#EDF3FF',fontWeight:'800',marginBottom:18},helpHeading:{fontSize:18,color:'#65DEEB',fontWeight:'700',marginTop:24,marginBottom:8},copy:{fontSize:15,lineHeight:24,color:'#B8C7DE'},done:{backgroundColor:'#65DEEB',padding:17,borderRadius:16,marginTop:30,alignItems:'center'},doneText:{fontSize:16,fontWeight:'800',color:'#080E1D'},recovery:{flex:1,backgroundColor:'#080E1D',alignItems:'center',justifyContent:'center',padding:30},recoveryTitle:{color:'#EDF3FF',fontSize:24,fontWeight:'900',marginTop:20,textAlign:'center'},recoveryCopy:{color:'#A5B3CB',fontSize:14,lineHeight:22,textAlign:'center',marginTop:10},recoveryCode:{color:'#64748D',fontSize:10,marginTop:20,textAlign:'center'}
});
