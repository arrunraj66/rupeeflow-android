import { SectionTabs } from '../../shared/SectionTabs';
// Five-tab Android app; proper insets keep content clear of the iQOO status and navigation bars.
import React, { useState } from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from './src/useLedger';
import { C, S } from './src/ui';
import { CalendarScreen, EntryDetail, InboxScreen, InsightsScreen, PlanScreen, ProfileScreen } from './src/screens';
const tabs = [ ['Plan','wallet-outline'], ['Calendar','calendar-outline'], ['Insights','pie-chart-outline'], ['Inbox','mail-outline'], ['Profile','person-outline'] ] as const;
export default function App() { return <Shell />; }
function Shell() {
  const c = useLedger();
  const [tab, setTab] = useState('Plan');
  const [selected, setSelected] = useState<string>();
  return <ImageBackground source={require('../../assets/finance-background.png')} imageStyle={{ opacity: c.state.profile.opacity }} style={{ flex: 1, backgroundColor: '#070C19' }}>
    <View style={{ flex: 1 }}>
      <SectionTabs selected={tab} onSelect={setTab} items={tabs.map(([name,icon])=>({name,icon}))} />
      {!!c.error && <Text accessibilityRole="alert" style={{ padding: 12, color: C.red, backgroundColor: '#231325' }}>{c.error}</Text>}
      <View style={{ flex: 1 }}>
        {!c.ready ? <Text style={[S.text, { padding: 24 }]}>{c.error ? 'Your saved data was left untouched. Close and reopen to retry.' : 'Opening your private ledger…'}</Text> : <>
          {tab === 'Plan' && <PlanScreen controller={c} />}
          {tab === 'Calendar' && <CalendarScreen controller={c} onEntry={e => setSelected(e.id)} />}
          {tab === 'Insights' && <InsightsScreen controller={c} />}
          {tab === 'Inbox' && <InboxScreen controller={c} onEntry={e => setSelected(e.id)} />}
          {tab === 'Profile' && <ProfileScreen controller={c} />}
        </>}
      </View>

      <EntryDetail entry={c.state.entries.find(e => e.id === selected)} c={c} close={() => setSelected(undefined)} />
    </View>
  </ImageBackground>;
}
