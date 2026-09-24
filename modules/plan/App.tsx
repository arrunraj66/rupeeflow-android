import { SectionTabs } from '../../shared/SectionTabs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { DayflowProvider, priorities, useDayflow } from './src/context/DayflowContext';
import { Card, EmptyState, IconButton, ScreenTitle } from './src/components/Primitives';
import { colors, shadow } from './src/theme';
import { Alarm, Priority, Task, Track } from './src/types';
import { formatDay, formatTime, pad } from './src/lib/date';
import { addTaskToGoogleCalendar, integrations, openIntegration, shareTask } from './src/lib/integrations';
import { useMusicPlayer } from './src/hooks/useMusicPlayer';
import { AlarmHistoryItem, AlarmPreferences, clearAlarmHistory, getAlarmHistory, getAlarmPreferences, openWakeAlarmSettings, setAlarmPreferences, skipNextAlarm, testWakeAlarm } from './src/lib/notifications';

type Tab = 'Today' | 'Tasks' | 'Alarms' | 'Music' | 'Connect';
const tabs: { name: Tab; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'Today', icon: 'grid-outline', active: 'grid' },
  { name: 'Tasks', icon: 'checkbox-outline', active: 'checkbox' },
  { name: 'Alarms', icon: 'alarm-outline', active: 'alarm' },
  { name: 'Music', icon: 'headset-outline', active: 'headset' },
  { name: 'Connect', icon: 'apps-outline', active: 'apps' },
];

export default function App() {
  return (
    <DayflowProvider>
      <DayflowApp />
    </DayflowProvider>
  );
}

function DayflowApp() {
  const [tab, setTab] = useState<Tab>('Today');
  const [taskModal, setTaskModal] = useState(false);
  const [alarmModal, setAlarmModal] = useState(false);
  const player = useMusicPlayer();

  return (
    <View style={styles.safe}>
      <View style={styles.shell}>
        <BottomNav selected={tab} onSelect={setTab} />
        <View style={styles.content}>
          {tab === 'Today' && <TodayScreen onAdd={() => setTaskModal(true)} />}
          {tab === 'Tasks' && <TasksScreen onAdd={() => setTaskModal(true)} />}
          {tab === 'Alarms' && <AlarmsScreen onAdd={() => setAlarmModal(true)} />}
          {tab === 'Music' && <MusicScreen player={player} />}
          {tab === 'Connect' && <ConnectScreen />}
        </View>
        {player.current && tab !== 'Music' && <MiniPlayer player={player} onOpen={() => setTab('Music')} />}
      </View>
      <TaskModal visible={taskModal} onClose={() => setTaskModal(false)} />
      <AlarmModal visible={alarmModal} onClose={() => setAlarmModal(false)} />
    </View>
  );
}

function BottomNav({ selected, onSelect }: { selected: Tab; onSelect(tab: Tab): void }) {
  return <SectionTabs selected={selected} onSelect={onSelect} items={tabs.map(t => ({name:t.name, icon:t.icon}))} />;
}

function Page({ children }: React.PropsWithChildren) {
  return <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

function TodayScreen({ onAdd }: { onAdd(): void }) {
  const { tasks } = useDayflow();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const open = tasks.filter((task) => !task.completed).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  const today = open.filter((task) => new Date(task.dueAt).toDateString() === now.toDateString());
  const completed = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? completed / tasks.length : 0;

  return (
    <Page>
      <ScreenTitle eyebrow={now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} title={greeting} action={<IconButton icon="add" dark onPress={onAdd} />} />
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroKicker}>YOUR DAY AT A GLANCE</Text>
        <Text style={styles.heroNumber}>{today.length}</Text>
        <Text style={styles.heroText}>{today.length === 1 ? 'thing needs your attention today' : 'things need your attention today'}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
        <Text style={styles.heroProgress}>{completed} of {tasks.length} tasks complete</Text>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Next up</Text>
        <Text style={styles.sectionMeta}>{open.length ? formatDay(open[0]!.dueAt) : 'All clear'}</Text>
      </View>
      {open.length ? <FeaturedTask task={open[0]!} /> : <Card><EmptyState icon="sparkles-outline" title="Your day is open" body="Add a task and Dayflow will keep time for you." /></Card>}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Today’s rhythm</Text>
        <Text style={styles.sectionMeta}>{today.length} scheduled</Text>
      </View>
      <Card style={styles.timelineCard}>
        {today.length ? today.map((task, index) => <TimelineTask key={task.id} task={task} last={index === today.length - 1} />) : <EmptyState icon="leaf-outline" title="No more plans today" body="A little breathing room looks good on you." />}
      </Card>
    </Page>
  );
}

function FeaturedTask({ task }: { task: Task }) {
  const { toggleTask } = useDayflow();
  return (
    <Card style={styles.featureCard}>
      <View style={styles.featureIcon}><Ionicons name="arrow-forward" size={22} color={colors.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTime}>{formatTime(task.dueAt)} · {task.priority} priority</Text>
        <Text style={styles.featureTitle}>{task.title}</Text>
        {!!task.notes && <Text numberOfLines={2} style={styles.featureNotes}>{task.notes}</Text>}
      </View>
      <Pressable onPress={() => void toggleTask(task.id)} style={styles.doneButton}><Ionicons name="checkmark" size={20} color={colors.cream} /></Pressable>
    </Card>
  );
}

function TimelineTask({ task, last }: { task: Task; last: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineTime}>{formatTime(task.dueAt)}</Text>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot} />
        {!last && <View style={styles.timelineLine} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 22 }}>
        <Text style={styles.timelineTitle}>{task.title}</Text>
        <Text style={styles.timelineNotes} numberOfLines={1}>{task.notes || task.priority + ' priority'}</Text>
      </View>
    </View>
  );
}

function TasksScreen({ onAdd }: { onAdd(): void }) {
  const { tasks, toggleTask, removeTask } = useDayflow();
  const sorted = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || +new Date(a.dueAt) - +new Date(b.dueAt));
  return (
    <Page>
      <ScreenTitle eyebrow="Plan with intention" title="Tasks" action={<IconButton icon="add" dark onPress={onAdd} />} />
      <View style={styles.filterRow}>
        <View style={[styles.filterPill, styles.filterPillActive]}><Text style={styles.filterTextActive}>All · {tasks.length}</Text></View>
        <View style={styles.filterPill}><Text style={styles.filterText}>Open · {tasks.filter((t) => !t.completed).length}</Text></View>
        <View style={styles.filterPill}><Text style={styles.filterText}>Done · {tasks.filter((t) => t.completed).length}</Text></View>
      </View>
      {sorted.length ? sorted.map((task) => (
        <Pressable key={task.id} onLongPress={() => Alert.alert('Delete task?', task.title, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeTask(task.id) }])}>
          <Card style={[styles.taskCard, task.completed && styles.taskCardDone]}>
            <Pressable onPress={() => void toggleTask(task.id)} style={[styles.taskCheck, task.completed && styles.taskCheckDone]}>
              {task.completed && <Ionicons name="checkmark" size={17} color={colors.paper} />}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, task.completed && styles.strike]}>{task.title}</Text>
              <Text style={styles.taskMeta}>{formatDay(task.dueAt)} · {formatTime(task.dueAt)}</Text>
            </View>
            <View style={[styles.priorityDot, { backgroundColor: task.priority === 'High' ? colors.orange : task.priority === 'Medium' ? colors.blue : colors.lime }]} />
            <Pressable onPress={() => void shareTask(task)} hitSlop={10}><Ionicons name="share-outline" size={20} color={colors.muted} /></Pressable>
          </Card>
        </Pressable>
      )) : <EmptyState icon="checkbox-outline" title="Nothing on your list" body="Capture your first task, choose a time, and we’ll remind you." />}
      {tasks.length > 0 && <Text style={styles.hint}>Tip: hold a task to delete it</Text>}
    </Page>
  );
}

function AlarmsScreen({ onAdd }: { onAdd(): void }) {
  const { alarms, toggleAlarm, removeAlarm } = useDayflow();
  const [alarmPro, setAlarmPro] = useState(true);
  const [proOpen, setProOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(()=>{const read=()=>void AsyncStorage.getItem('@arun-one/settings/v2').then(raw=>setAlarmPro(raw?JSON.parse(raw).features?.alarmPro!==false:true)).catch(()=>undefined);read();const sub=DeviceEventEmitter.addListener('one:settings-changed',value=>setAlarmPro(value?.features?.alarmPro!==false));return()=>sub.remove();},[]);
  const testAlarm = async () => {
    try {
      await testWakeAlarm();
      Alert.alert('Test alarm set', 'Lock your phone now. Arun One will ring in 5 seconds.');
    } catch (error) {
      Alert.alert('Alarm needs access', error instanceof Error ? error.message : 'Open alarm access and try again.');
    }
  };
  const toggle = async (id: string) => {
    try { await toggleAlarm(id); }
    catch (error) { Alert.alert('Could not change alarm', error instanceof Error ? error.message : 'Check alarm access and try again.'); }
  };
  return (
    <Page>
      <ScreenTitle eyebrow="Wake up on purpose" title="Alarms" action={<IconButton icon="add" dark onPress={onAdd} />} />
      <View style={styles.alarmIntro}>
        <Ionicons name="alarm" size={23} color={colors.green} />
        <Text style={styles.alarmIntroText}>Rings like a regular alarm: wakes the screen, loops sound and vibration, and stays active until you Stop or Snooze.</Text>
      </View>
      {Platform.OS === 'android' && alarmPro && <View style={styles.alarmActions}>
        <Pressable accessibilityRole="button" onPress={() => void testAlarm()} style={styles.alarmAction}><Ionicons name="flask-outline" size={17} color={colors.ink} /><Text style={styles.alarmActionText}>Test in 5 sec</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void openWakeAlarmSettings('exact')} style={styles.alarmAction}><Ionicons name="settings-outline" size={17} color={colors.ink} /><Text style={styles.alarmActionText}>Alarm access</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void openWakeAlarmSettings('fullScreen')} style={styles.alarmAction}><Ionicons name="phone-portrait-outline" size={17} color={colors.ink} /><Text style={styles.alarmActionText}>Full screen</Text></Pressable>
      </View>}
      {Platform.OS === 'android' && <View style={styles.alarmActions}>
        <Pressable accessibilityRole="button" onPress={() => setProOpen(true)} style={styles.alarmAction}><Ionicons name="options-outline" size={17} color={colors.ink} /><Text style={styles.alarmActionText}>Alarm style</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setHistoryOpen(true)} style={styles.alarmAction}><Ionicons name="time-outline" size={17} color={colors.ink} /><Text style={styles.alarmActionText}>History</Text></Pressable>
      </View>}
      {alarms.length ? alarms.map((alarm) => (
        <Pressable key={alarm.id} onLongPress={() => Alert.alert('Delete alarm?', alarm.label, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeAlarm(alarm.id) }])}>
          <Card style={[styles.alarmCard, !alarm.enabled && styles.alarmDisabled]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alarmTime}>{pad(alarm.hour)}:{pad(alarm.minute)}</Text>
              <Text style={styles.alarmLabel}>{alarm.label}</Text>
              <Text style={styles.alarmDays}>{formatAlarmDays(alarm)}</Text>
            </View>
            <View style={{alignItems:'flex-end',gap:9}}><Switch value={alarm.enabled} onValueChange={() => void toggle(alarm.id)} trackColor={{ false: '#DADCD7', true: colors.greenSoft }} thumbColor={alarm.enabled ? colors.green : '#FFFFFF'} />{alarmPro&&alarm.enabled&&alarm.days.length>0&&<Pressable onPress={()=>void skipNextAlarm(alarm.id).then(at=>Alert.alert('Next alarm skipped',`The following occurrence is ${new Date(at).toLocaleString()}.`)).catch(e=>Alert.alert('Could not skip',String(e)))}><Text style={styles.skipText}>Skip next</Text></Pressable>}</View>
          </Card>
        </Pressable>
      )) : <EmptyState icon="alarm-outline" title="No alarms yet" body="Set one-time or repeating alarms for the moments that matter." />}
      {alarms.length > 0 && <Text style={styles.hint}>Tip: hold an alarm to delete it</Text>}
      {alarmPro&&<><AlarmProModal visible={proOpen} close={()=>setProOpen(false)}/><AlarmHistoryModal visible={historyOpen} close={()=>setHistoryOpen(false)}/></>}
    </Page>
  );
}

function AlarmProModal({visible,close}:{visible:boolean;close():void}){
  const [prefs,setPrefs]=useState<AlarmPreferences>({gradual:true,vibrate:true,voice:false,maxMinutes:20});
  useEffect(()=>{if(visible)void getAlarmPreferences().then(setPrefs);},[visible]);
  const setting=(label:string,detail:string,key:'gradual'|'vibrate'|'voice')=><View style={styles.proSetting}><View style={{flex:1}}><Text style={styles.proLabel}>{label}</Text><Text style={styles.proDetail}>{detail}</Text></View><Switch value={prefs[key]} onValueChange={value=>setPrefs({...prefs,[key]:value})}/></View>;
  return <Sheet visible={visible} onClose={close} title="Alarm style" subtitle="Professional wake-up controls.">{setting('Gradual volume','Rises from 12% to full volume over 32 seconds','gradual')}{setting('Vibration','Repeating wake-up vibration pattern','vibrate')}{setting('Speak alarm label','Reads the alarm name when ringing','voice')}<Field label="Maximum ringing time"><View style={styles.optionRow}>{[10,20,30,60].map(value=><Option key={value} label={`${value} min`} active={prefs.maxMinutes===value} onPress={()=>setPrefs({...prefs,maxMinutes:value})}/>)}</View></Field><PrimaryButton label="Save alarm style" icon="checkmark" onPress={()=>void setAlarmPreferences(prefs).then(close).catch(e=>Alert.alert('Could not save',String(e)))}/></Sheet>;
}
function AlarmHistoryModal({visible,close}:{visible:boolean;close():void}){
  const [items,setItems]=useState<AlarmHistoryItem[]>([]);useEffect(()=>{if(visible)void getAlarmHistory().then(setItems);},[visible]);
  return <Sheet visible={visible} onClose={close} title="Alarm history" subtitle="Rings, stops and snoozes stay on this phone.">{items.length?items.slice(0,20).map((item,index)=><View key={`${item.at}-${index}`} style={styles.historyRow}><View style={{flex:1}}><Text style={styles.proLabel}>{item.label}</Text><Text style={styles.proDetail}>{new Date(item.at).toLocaleString()}</Text></View><Text style={styles.historyEvent}>{item.event}</Text></View>):<Text style={styles.historyEmpty}>No alarm activity recorded yet.</Text>} {!!items.length&&<Pressable onPress={()=>void clearAlarmHistory().then(()=>setItems([]))}><Text style={styles.clearHistory}>Clear history</Text></Pressable>}</Sheet>;
}

function formatAlarmDays(alarm: Alarm) {
  if (alarm.days.length === 0) return 'Next occurrence';
  if (alarm.days.length === 7) return 'Every day';
  if (alarm.days.join(',') === '1,2,3,4,5') return 'Weekdays';
  return alarm.days.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(' · ');
}

type Player = ReturnType<typeof useMusicPlayer>;

function MusicScreen({ player }: { player: Player }) {
  const { tracks, addTrack, removeTrack } = useDayflow();
  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const library = `${FileSystem.documentDirectory}music`;
    const safeName = `${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    await FileSystem.makeDirectoryAsync(library, { intermediates: true });
    const uri = `${library}/${safeName}`;
    await FileSystem.copyAsync({ from: asset.uri, to: uri });
    addTrack({ title: asset.name.replace(/\.[^.]+$/, ''), artist: 'On this phone', uri });
  };
  return (
    <Page>
      <ScreenTitle eyebrow="Soundtrack your focus" title="Music" action={<IconButton icon="add" dark onPress={() => void pickAudio()} />} />
      <View style={styles.playerCard}>
        <View style={styles.albumArt}>
          <View style={styles.vinyl}><View style={styles.vinylCenter} /></View>
          <Ionicons name="musical-note" size={34} color={colors.cream} />
        </View>
        <Text style={styles.nowPlaying}>{player.current ? 'NOW PLAYING' : 'YOUR FOCUS PLAYER'}</Text>
        <Text style={styles.trackTitle}>{player.current?.title || 'Choose a track'}</Text>
        <Text style={styles.trackArtist}>{player.current?.artist || 'Import music from your phone'}</Text>
        <Pressable style={styles.seekTrack} onPress={(event) => void player.seek(event.nativeEvent.locationX / 280)}>
          <View style={[styles.seekFill, { width: `${player.progress * 100}%` }]} />
        </Pressable>
        <View style={styles.playerControls}>
          <Ionicons name="play-skip-back" size={22} color="rgba(255,255,255,.55)" />
          <Pressable style={styles.playButton} onPress={() => void player.toggle()}>
            <Ionicons name={player.playing ? 'pause' : 'play'} size={27} color={colors.green} style={!player.playing && { marginLeft: 3 }} />
          </Pressable>
          <Ionicons name="play-skip-forward" size={22} color="rgba(255,255,255,.55)" />
        </View>
        <Text style={styles.backgroundNote}><Ionicons name="phone-portrait-outline" size={12} /> Keeps playing when the screen locks</Text>
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>On this phone</Text>
        <Text style={styles.sectionMeta}>{tracks.length} tracks</Text>
      </View>
      {tracks.length ? tracks.map((track) => (
        <TrackRow key={track.id} track={track} active={player.current?.id === track.id} playing={player.playing} onPlay={() => void player.play(track)} onRemove={() => removeTrack(track.id)} />
      )) : <Card><EmptyState icon="musical-notes-outline" title="Bring your own music" body="Tap + to choose an audio file. Your queue stays private on this device." /></Card>}
    </Page>
  );
}

function TrackRow({ track, active, playing, onPlay, onRemove }: { track: Track; active: boolean; playing: boolean; onPlay(): void; onRemove(): void }) {
  return (
    <Pressable onPress={onPlay} onLongPress={() => Alert.alert('Remove track?', track.title, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: onRemove }])}>
      <Card style={styles.trackRow}>
        <View style={[styles.trackIcon, active && styles.trackIconActive]}><Ionicons name={active && playing ? 'volume-high' : 'musical-note'} size={18} color={active ? colors.paper : colors.green} /></View>
        <View style={{ flex: 1 }}><Text style={styles.trackRowTitle}>{track.title}</Text><Text style={styles.trackRowArtist}>{track.artist}</Text></View>
        <Ionicons name={active && playing ? 'pause' : 'play'} size={20} color={colors.ink} />
      </Card>
    </Pressable>
  );
}

function MiniPlayer({ player, onOpen }: { player: Player; onOpen(): void }) {
  return (
    <Pressable onPress={onOpen} style={styles.miniPlayer}>
      <View style={styles.miniIcon}><Ionicons name="musical-note" size={16} color={colors.paper} /></View>
      <Text numberOfLines={1} style={styles.miniTitle}>{player.current?.title}</Text>
      <Pressable onPress={() => void player.toggle()} style={styles.miniPlay}><Ionicons name={player.playing ? 'pause' : 'play'} size={19} color={colors.ink} /></Pressable>
    </Pressable>
  );
}

function ConnectScreen() {
  const { tasks } = useDayflow();
  const nextTask = tasks.filter((task) => !task.completed).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))[0];
  return (
    <Page>
      <ScreenTitle eyebrow="Your apps, one flow" title="Connect" />
      <Card style={styles.connectHero}>
        <View style={styles.connectHeroIcon}><Ionicons name="git-network-outline" size={30} color={colors.green} /></View>
        <Text style={styles.connectTitle}>Works with the apps you already use</Text>
        <Text style={styles.connectBody}>Open supported apps directly, share any task through your phone, or send your next task to Google Calendar.</Text>
        {nextTask && <Pressable style={styles.calendarButton} onPress={() => void addTaskToGoogleCalendar(nextTask)}><Ionicons name="calendar-outline" size={18} color={colors.paper} /><Text style={styles.calendarButtonText}>Add next task to calendar</Text></Pressable>}
      </Card>
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Quick connections</Text><Text style={styles.sectionMeta}>Deep links</Text></View>
      <View style={styles.integrationGrid}>
        {integrations.map((item) => (
          <Pressable key={item.id} onPress={() => void openIntegration(item.url)} style={styles.integrationCard}>
            <View style={[styles.integrationIcon, { backgroundColor: `${item.color}18` }]}><Ionicons name={item.icon} size={24} color={item.color} /></View>
            <Text style={styles.integrationName}>{item.name}</Text>
            <Ionicons name="arrow-up-outline" size={16} color={colors.muted} style={{ transform: [{ rotate: '45deg' }] }} />
          </Pressable>
        ))}
      </View>
      <View style={styles.privacyRow}><Ionicons name="shield-checkmark-outline" size={20} color={colors.green} /><Text style={styles.privacyText}>Tasks, alarms, and your music library stay on your device.</Text></View>
    </Page>
  );
}

function TaskModal({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const { addTask } = useDayflow();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<Priority>('Medium');

  const submit = async () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!title.trim() || !match) return Alert.alert('Check the details', 'Add a title and use time format HH:MM.');
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return Alert.alert('Check the time', 'Use a valid 24-hour time.');
    const due = new Date();
    due.setDate(due.getDate() + dayOffset);
    due.setHours(hour, minute, 0, 0);
    await addTask({ title: title.trim(), notes: notes.trim(), dueAt: due.toISOString(), priority });
    setTitle(''); setNotes(''); setDayOffset(0); onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New task" subtitle="Give it a place in your day.">
      <Field label="What needs doing?"><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Call the dentist" placeholderTextColor="#A0A59F" style={styles.input} autoFocus /></Field>
      <Field label="A little context (optional)"><TextInput value={notes} onChangeText={setNotes} placeholder="Notes, address, a reminder…" placeholderTextColor="#A0A59F" style={[styles.input, styles.notesInput]} multiline /></Field>
      <Field label="When">
        <View style={styles.optionRow}>{['Today', 'Tomorrow', 'In 2 days'].map((label, index) => <Option key={label} label={label} active={dayOffset === index} onPress={() => setDayOffset(index)} />)}</View>
        <TextInput value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="09:00" style={[styles.input, { marginTop: 10 }]} />
      </Field>
      <Field label="Priority"><View style={styles.optionRow}>{priorities.map((item) => <Option key={item} label={item} active={priority === item} onPress={() => setPriority(item)} />)}</View></Field>
      <PrimaryButton label="Schedule task" icon="arrow-forward" onPress={() => void submit()} />
    </Sheet>
  );
}

function AlarmModal({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const { addAlarm } = useDayflow();
  const [label, setLabel] = useState('Morning alarm');
  const [time, setTime] = useState('07:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const submit = async () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match) return Alert.alert('Check the time', 'Use time format HH:MM.');
    const hour = Number(match[1]); const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return Alert.alert('Check the time', 'Use a valid 24-hour time.');
    try {
      await addAlarm({ label: label.trim() || 'Wake-up alarm', hour, minute, days: [...days].sort() });
      onClose();
    } catch (error) {
      Alert.alert('Alarm needs access', error instanceof Error ? error.message : 'Allow Alarms & reminders, then try again.');
    }
  };
  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  return (
    <Sheet visible={visible} onClose={onClose} title="New alarm" subtitle="We’ll make sure you notice.">
      <Field label="Alarm time"><TextInput value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" style={[styles.input, styles.timeInput]} /></Field>
      <Field label="Label"><TextInput value={label} onChangeText={setLabel} placeholder="Morning alarm" style={styles.input} /></Field>
      <Field label="Repeat (leave empty for one time)">
        <View style={styles.daysRow}>{dayNames.map((name, day) => <Pressable key={day} onPress={() => toggleDay(day)} style={[styles.dayCircle, days.includes(day) && styles.dayCircleActive]}><Text style={[styles.dayText, days.includes(day) && styles.dayTextActive]}>{name}</Text></Pressable>)}</View>
      </Field>
      <PrimaryButton label="Set alarm" icon="alarm-outline" onPress={() => void submit()} />
    </Sheet>
  );
}

function Sheet({ visible, onClose, title, subtitle, children }: React.PropsWithChildren<{ visible: boolean; onClose(): void; title: string; subtitle: string }>) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View style={{ flex: 1 }}><Text style={styles.sheetTitle}>{title}</Text><Text style={styles.sheetSubtitle}>{subtitle}</Text></View><IconButton icon="close" onPress={onClose} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function Option({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  return <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}><Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text></Pressable>;
}

function PrimaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress(): void }) {
  return <Pressable onPress={onPress} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{label}</Text><Ionicons name={icon} size={19} color={colors.paper} /></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  shell: { flex: 1 }, content: { flex: 1 },
  page: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 26 : 12, paddingBottom: 32 },
  nav: { height: 74, paddingTop: 9, paddingBottom: 7, flexDirection: 'row', backgroundColor: colors.paper, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { color: '#8B928D', fontSize: 10, fontWeight: '600' }, navLabelActive: { color: colors.green, fontWeight: '800' },
  hero: { overflow: 'hidden', borderRadius: 28, backgroundColor: '#162A49', padding: 23, marginBottom: 26, ...shadow },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#4965DB', right: -55, top: -75, opacity: .65 },
  heroKicker: { color: colors.lime, fontSize: 11, letterSpacing: 1.7, fontWeight: '800' },
  heroNumber: { color: colors.ink, fontSize: 56, lineHeight: 65, fontWeight: '800', letterSpacing: -2 },
  heroText: { color: 'rgba(255,255,255,.82)', fontSize: 15, marginBottom: 22 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.lime, borderRadius: 3 },
  heroProgress: { color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 8, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 5, marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -.3 }, sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  featureCard: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 27, padding: 16 },
  featureIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  featureTime: { color: colors.green, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 3 },
  featureTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, featureNotes: { color: colors.muted, fontSize: 12, marginTop: 3 },
  doneButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  timelineCard: { paddingBottom: 20 }, timelineRow: { flexDirection: 'row' },
  timelineTime: { width: 69, color: colors.muted, fontSize: 12, fontWeight: '700', paddingTop: 1 },
  timelineRail: { width: 20, alignItems: 'center' }, timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, marginTop: 4, zIndex: 2 },
  timelineLine: { position: 'absolute', top: 12, bottom: -4, width: 1, backgroundColor: colors.line },
  timelineTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, timelineNotes: { color: colors.muted, fontSize: 12, marginTop: 3 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 }, filterPill: { backgroundColor: colors.paper, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18 },
  filterPillActive: { backgroundColor: colors.green }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, filterTextActive: { color: '#080E1D', fontSize: 12, fontWeight: '800' },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 11, padding: 16 }, taskCardDone: { opacity: .58 },
  taskCheck: { width: 25, height: 25, borderRadius: 8, borderWidth: 1.5, borderColor: '#BBC1BC', alignItems: 'center', justifyContent: 'center' }, taskCheckDone: { backgroundColor: colors.green, borderColor: colors.green },
  taskTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, taskMeta: { color: colors.muted, fontSize: 12, marginTop: 3 }, strike: { textDecorationLine: 'line-through' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 }, hint: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: 10 },
  alarmIntro: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 18, padding: 15, marginBottom: 18 },
  alarmIntroText: { flex: 1, color: colors.green, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  alarmActions: { flexDirection: 'row', gap: 7, marginTop: -7, marginBottom: 18 },
  alarmAction: { flex: 1, minHeight: 48, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4 },
  alarmActionText: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  skipText: { color: colors.green, fontSize: 10, fontWeight: '900' },
  proSetting: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  proLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' }, proDetail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  historyRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }, historyEvent: { color: colors.green, fontSize: 10, fontWeight: '900' }, historyEmpty: { color: colors.muted, textAlign: 'center', paddingVertical: 35 }, clearHistory: { color: colors.orange, textAlign: 'center', fontWeight: '900', padding: 16 },
  alarmCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 13, paddingVertical: 20 }, alarmDisabled: { opacity: .5 },
  alarmTime: { color: colors.ink, fontSize: 36, fontWeight: '500', letterSpacing: -1.5 }, alarmLabel: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 3 }, alarmDays: { color: colors.muted, fontSize: 11, marginTop: 4 },
  playerCard: { alignItems: 'center', backgroundColor: '#162A49', borderRadius: 30, padding: 24, overflow: 'hidden', marginBottom: 28, ...shadow },
  albumArt: { width: 155, height: 155, borderRadius: 78, backgroundColor: '#163948', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  vinyl: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 22, borderColor: 'rgba(0,0,0,.13)' }, vinylCenter: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: colors.orange, left: 27, top: 27 },
  nowPlaying: { color: colors.lime, fontSize: 10, letterSpacing: 1.8, fontWeight: '800' }, trackTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 6 }, trackArtist: { color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 4 },
  seekTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.17)', overflow: 'hidden', marginTop: 25 }, seekFill: { height: 5, borderRadius: 3, backgroundColor: colors.lime },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 34, marginTop: 19 }, playButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backgroundNote: { color: 'rgba(255,255,255,.47)', fontSize: 10, marginTop: 18 },
  trackRow: { flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 10, padding: 14 }, trackIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, trackIconActive: { backgroundColor: colors.green },
  trackRowTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, trackRowArtist: { color: colors.muted, fontSize: 11, marginTop: 3 },
  miniPlayer: { marginHorizontal: 12, marginBottom: 8, borderRadius: 17, height: 54, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10 },
  miniIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green }, miniTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' }, miniPlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  connectHero: { alignItems: 'center', padding: 25, marginBottom: 27 }, connectHeroIcon: { width: 65, height: 65, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  connectTitle: { color: colors.ink, fontSize: 21, lineHeight: 27, textAlign: 'center', fontWeight: '800' }, connectBody: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  calendarButton: { marginTop: 18, borderRadius: 15, backgroundColor: colors.green, paddingVertical: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }, calendarButtonText: { color: '#080E1D', fontWeight: '800', fontSize: 12 },
  integrationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, integrationCard: { width: '48%', minHeight: 132, backgroundColor: colors.paper, borderRadius: 22, padding: 16, ...shadow }, integrationIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, integrationName: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  privacyRow: { marginTop: 25, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 }, privacyText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,20,15,.34)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '91%', minHeight: 320, backgroundColor: colors.cream, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: Platform.OS === 'ios' ? 35 : 22 },
  sheetHandle: { width: 42, height: 4, backgroundColor: '#CFD2CC', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 21 }, sheetTitle: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -.8 }, sheetSubtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  field: { marginBottom: 18 }, fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 15, minHeight: 51, paddingHorizontal: 15, color: colors.ink, fontSize: 15 }, notesInput: { minHeight: 78, paddingTop: 14, textAlignVertical: 'top' }, timeInput: { fontSize: 34, height: 68, textAlign: 'center', fontWeight: '600', letterSpacing: 1 },
  optionRow: { flexDirection: 'row', gap: 8 }, option: { flex: 1, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, alignItems: 'center' }, optionActive: { backgroundColor: colors.green, borderColor: colors.green }, optionText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, optionTextActive: { color: '#080E1D' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' }, dayCircle: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, dayCircleActive: { backgroundColor: colors.green, borderColor: colors.green }, dayText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, dayTextActive: { color: '#080E1D' },
  primaryButton: { backgroundColor: colors.green, borderRadius: 17, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2 }, primaryButtonText: { color: '#080E1D', fontSize: 14, fontWeight: '800' },
});
