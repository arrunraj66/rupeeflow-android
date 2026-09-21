import { SectionTabs } from '../../shared/SectionTabs';
import { claimPlayback, registerPlayback } from '../../shared/playback';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, AppState, StatusBar, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync,
  useAudioPlayer, useAudioPlayerStatus, useAudioSampleListener,
} from 'expo-audio';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer, type SubtitleTrack } from 'expo-video';
import { MediaBrowser, SoundPanel } from './src/PlayerScreens';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';

type Tab = 'Home' | 'Music' | 'Video' | 'Online';
type MediaKind = 'audio' | 'video';
type SmartCategory = 'Melody' | 'Fast Beats' | 'Other';
type Track = { id: string; title: string; artist: string; uri: string; duration: number; kind: MediaKind; folder: string; category: SmartCategory };
type TrackStat = { plays: number; completed: number; lastPlayedAt: number };
type Stats = Record<string, TrackStat>;
type LibraryView = 'Songs' | 'Folders' | 'Listening';
type ThemeName = 'Midnight' | 'Aurora' | 'Sunset' | 'Ocean';
type AppTheme = { name: ThemeName; background: string; panel: string; accent: string; glow: string };

const C = { coral: '#65DEEB', cream: '#EDF3FF', ink: '#080E1D', olive: '#B9AAFF', surface: '#142038', muted: '#A5B3CB', line: '#293953', purple: '#a994ff', blue: '#72c9ff' };
const STATS_KEY = '@hush/listening-stats-v1';
const LIBRARY_KEY = '@hush/library-index-v2';
const THEME_KEY = '@pulse/theme-v1';
const HIDDEN_FOLDERS_KEY = '@pulse/hidden-folders-v1';
const SOUND_SETTINGS_KEY = '@pulse/sound-studio-v2';
const SUBTITLES_KEY = '@pulse/subtitles-enabled-v1';
const SHUFFLE_KEY = '@pulse/continuous-random-v1';
const SCAN_COOLDOWN_MS = 60 * 1000;
const THEMES: AppTheme[] = [
  { name: 'Midnight', background: '#090B12', panel: '#191D2A', accent: '#A994FF', glow: '#49358C' },
  { name: 'Aurora', background: '#07130F', panel: '#17261F', accent: '#A7F36B', glow: '#176B50' },
  { name: 'Sunset', background: '#1B0D12', panel: '#301A20', accent: '#FF8A5B', glow: '#8F2849' },
  { name: 'Ocean', background: '#06151E', panel: '#122936', accent: '#72C9FF', glow: '#07577D' },
];
const hiddenAudio = /whats?app|com[._ -]?whatsapp|wa[ _-]?(audio|voice|\d{4})|voice[ _-]?notes?|(?:^|[\\/])call(?:[\\/]|$)|recordings?[\\/]record[\\/]call|call[ _-]?(record(?:ing)?s?|rec)|callrecorder|recorded[ _-]?calls?|phone[ _-]?record(?:ing)?s?|automatic[ _-]?call[ _-]?recorder|[\\/]acr[\\/]/i;
const isHiddenAudio = (track: Track) => track.kind === 'audio' && hiddenAudio.test(`${track.folder}/${track.title}/${track.uri}`);
const fastBeatWords = /\b(dance|edm|dj|remix|party|workout|gym|rock|rap|hip[ -]?hop|beat|bass|fast|kuthu|dappankuthu|electro|techno|trance|drum)\b/i;
const melodyWords = /\b(melody|acoustic|romantic|love|soft|calm|chill|sleep|classical|instrumental|piano|violin|flute|sad|lo[ -]?fi|unplugged|ballad)\b/i;
function smartCategory(name: string, kind: MediaKind): SmartCategory {
  if (kind === 'video') return 'Other';
  if (fastBeatWords.test(name)) return 'Fast Beats';
  if (melodyWords.test(name)) return 'Melody';
  return 'Other';
}
const samples: Track[] = [
  { id: 'demo-audio', title: 'SoundHelix demo', artist: 'Direct MP3 sample', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: 0, kind: 'audio', folder: 'Online', category: 'Other' },
  { id: 'demo-video', title: 'Big Buck Bunny', artist: 'Open movie sample', uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 0, kind: 'video', folder: 'Online', category: 'Other' },
];
const initialTrack = samples[0]!;

export default function App() {
  return <PlayerApp />;
}

function PlayerApp() {
  const [tab, setTab] = useState<Tab>('Music');
  const [favourites, setFavourites] = useState<string[]>([]);
  const [soundOpen, setSoundOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeName, setThemeName] = useState<ThemeName>('Midnight');
  const [hiddenFolders, setHiddenFolders] = useState<string[]>([]);
  const [gains, setGains] = useState([0, 0, 0, 0, 0]);
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqStatus, setEqStatus] = useState('Start music to activate the equalizer');
  const [volume, setVolume] = useState(0.8);
  const [bassBoost, setBassBoost] = useState(0.2);
  const [clarity, setClarity] = useState(0.25);
  const [spatial, setSpatial] = useState(0);
  const [loudness, setLoudness] = useState(0.1);
  const [hearingProtect, setHearingProtect] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [meterReady, setMeterReady] = useState(false);
  const [meter, setMeter] = useState({ levels: [0, 0], spectrum: Array(18).fill(0) as number[] });
  const [soundPrefsLoaded, setSoundPrefsLoaded] = useState(false);
  const scanningRef = useRef(false);
  const lastScanRef = useRef(0);
  const [library, setLibrary] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>(samples);
  const [current, setCurrent] = useState<Track>(initialTrack);
  const [video, setVideo] = useState<Track | null>(null);
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [excluded, setExcluded] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [enhance, setEnhance] = useState(true);
  const [cleanup, setCleanup] = useState(false);
  const [enhanceInfo, setEnhanceInfo] = useState(false);
  const [stats, setStats] = useState<Stats>({});
  const loadedId = useRef<string | null>(null);
  const finishHandled = useRef(false);
  const audio = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(audio);
  useEffect(() => registerPlayback('media', () => { audio.pause(); setVideo(null); }), [audio]);
  useEffect(() => { if (status.playing) claimPlayback('media'); }, [status.playing]);

  useEffect(() => {
    // Do not claim exclusive audio focus: this lets YouTube or another media app
    // continue playing while iQOO Audio Redirect sends each app to its chosen output.
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' });
    void AsyncStorage.getItem('@hush/favourites').then(v => v && setFavourites(JSON.parse(v))).catch(() => undefined);
    void AsyncStorage.getItem(STATS_KEY).then((value) => value && setStats(JSON.parse(value))).catch(() => undefined);
    void AsyncStorage.getItem(THEME_KEY).then(value => value && setThemeName(value as ThemeName)).catch(() => undefined);
    void AsyncStorage.getItem(HIDDEN_FOLDERS_KEY).then(value => value && setHiddenFolders(JSON.parse(value))).catch(() => undefined);
    void AsyncStorage.getItem(SHUFFLE_KEY).then(value => value !== null && setShuffle(value === 'true')).catch(() => undefined);
    void AsyncStorage.getItem(SOUND_SETTINGS_KEY).then(value => {
      if (!value) return;
      const saved = JSON.parse(value) as Partial<{ gains: number[]; eqEnabled: boolean; volume: number; bassBoost: number; clarity: number; spatial: number; loudness: number; hearingProtect: boolean; playbackRate: number }>;
      if (Array.isArray(saved.gains) && saved.gains.length === 5) setGains(saved.gains);
      if (typeof saved.eqEnabled === 'boolean') setEqEnabled(saved.eqEnabled);
      if (typeof saved.volume === 'number') setVolume(saved.volume);
      if (typeof saved.bassBoost === 'number') setBassBoost(saved.bassBoost);
      if (typeof saved.clarity === 'number') setClarity(saved.clarity);
      if (typeof saved.spatial === 'number') setSpatial(saved.spatial);
      if (typeof saved.loudness === 'number') setLoudness(saved.loudness);
      if (typeof saved.hearingProtect === 'boolean') setHearingProtect(saved.hearingProtect);
      if (typeof saved.playbackRate === 'number') setPlaybackRate(saved.playbackRate);
    }).catch(() => undefined).finally(() => setSoundPrefsLoaded(true));
  }, []);
  useEffect(() => { audio.volume = volume; }, [audio, volume]);
  useEffect(() => { audio.setPlaybackRate(playbackRate); }, [audio, playbackRate]);
  useEffect(() => {
    if (!soundPrefsLoaded) return;
    void AsyncStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify({ gains, eqEnabled, volume, bassBoost, clarity, spatial, loudness, hearingProtect, playbackRate }));
  }, [bassBoost, clarity, eqEnabled, gains, hearingProtect, loudness, playbackRate, soundPrefsLoaded, spatial, volume]);
  useEffect(() => {
    const native = audio as typeof audio & { hushSetShuffle?: (enabled: boolean) => void };
    native.hushSetShuffle?.(shuffle);
  }, [audio, shuffle]);
  useEffect(() => {
    const apply = () => {
      try {
        const native = audio as typeof audio & { hushSoundStudio?: (g: number[], e: boolean, bass: number, clear: number, width: number, loud: number, protect: boolean) => string };
        setEqStatus(native.hushSoundStudio?.(gains, eqEnabled, bassBoost, clarity, spatial, loudness, hearingProtect) || 'Sound engine requires the updated Android APK');
      } catch { setEqStatus('Equalizer could not attach to this audio output'); }
    };
    apply();
    const timer = setInterval(apply, 1500);
    return () => clearInterval(timer);
  }, [audio, bassBoost, clarity, gains, eqEnabled, hearingProtect, loudness, spatial]);

  const openSoundStudio = useCallback(() => {
    setSoundOpen(true);
    void getRecordingPermissionsAsync().then(async permission => permission.granted ? permission : requestRecordingPermissionsAsync()).then(permission => setMeterReady(permission.granted)).catch(() => setMeterReady(false));
  }, []);
  const favourite = (id: string) => setFavourites(previous => {
    const next = previous.includes(id) ? previous.filter(v => v !== id) : [...previous, id];
    void AsyncStorage.setItem('@hush/favourites', JSON.stringify(next)).catch(() => Alert.alert('Storage error', 'Could not save favourites.'));
    return next;
  });
  const setShuffleMode = useCallback((enabled: boolean) => {
    setShuffle(enabled);
    void AsyncStorage.setItem(SHUFFLE_KEY, String(enabled));
  }, []);
  const selectTheme = (name: ThemeName) => { setThemeName(name); void AsyncStorage.setItem(THEME_KEY, name); };
  const hideFolder = (folder: string) => setHiddenFolders(previous => {
    const next = previous.includes(folder) ? previous : [...previous, folder];
    void AsyncStorage.setItem(HIDDEN_FOLDERS_KEY, JSON.stringify(next)); return next;
  });
  const showFolder = (folder: string) => setHiddenFolders(previous => {
    const next = previous.filter(name => name !== folder);
    void AsyncStorage.setItem(HIDDEN_FOLDERS_KEY, JSON.stringify(next)); return next;
  });

  const record = useCallback((id: string, completed: boolean) => {
    setStats((previous) => {
      const old = previous[id] || { plays: 0, completed: 0, lastPlayedAt: 0 };
      const next = { ...previous, [id]: { plays: old.plays + (completed ? 0 : 1), completed: old.completed + (completed ? 1 : 0), lastPlayedAt: completed ? old.lastPlayedAt : Date.now() } };
      void AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const playTrack = useCallback((track: Track, list = queue) => {
    claimPlayback('media');
    if (track.kind === 'video') { audio.pause(); setVideo(track); return; }
    const songs = list.filter(item => item.kind === 'audio');
    const playlist = songs.length ? songs : [track];
    const index = Math.max(0, playlist.findIndex(item => item.id === track.id));
    setVideo(null); setQueue(playlist); setCurrent(track); loadedId.current = track.id;
    const native = audio as typeof audio & { hushSetQueue?: (sources: { uri: string }[], index: number, shuffle: boolean) => void };
    if (native.hushSetQueue) native.hushSetQueue(playlist.map(item => ({ uri: item.uri })), index, shuffle);
    else { audio.replace(track.uri); audio.play(); }
    audio.setActiveForLockScreen(true, { title: track.title, artist: track.artist, albumTitle: track.folder }, { showSeekBackward: true, showSeekForward: true });
    record(track.id, false);
  }, [audio, queue, record, shuffle]);

  const remoteIndex = (status as typeof status & { currentMediaItemIndex?: number }).currentMediaItemIndex;
  useEffect(() => {
    if (remoteIndex === undefined || remoteIndex < 0 || remoteIndex >= queue.length) return;
    const remoteTrack = queue[remoteIndex];
    if (!remoteTrack || remoteTrack.id === current.id) return;
    setCurrent(remoteTrack); loadedId.current = remoteTrack.id;
    audio.updateLockScreenMetadata({ title: remoteTrack.title, artist: remoteTrack.artist, albumTitle: remoteTrack.folder });
    record(remoteTrack.id, false);
  }, [audio, current.id, queue, record, remoteIndex]);

  const playAdjacent = useCallback((step: number) => {
    const songs = queue.filter((item) => item.kind === 'audio');
    if (!songs.length) return;
    const currentIndex = Math.max(0, songs.findIndex((item) => item.id === current.id));
    let nextIndex = (currentIndex + step + songs.length) % songs.length;
    if (shuffle && songs.length > 1) {
      do { nextIndex = Math.floor(Math.random() * songs.length); } while (nextIndex === currentIndex);
    }
    playTrack(songs[nextIndex]!, queue);
  }, [current.id, playTrack, queue, shuffle]);

  const playRandom = useCallback(() => {
    const songs = queue.filter((item) => item.kind === 'audio');
    if (!songs.length) return;
    const choices = songs.filter((item) => item.id !== current.id);
    setShuffleMode(true);
    playTrack((choices.length ? choices : songs)[Math.floor(Math.random() * (choices.length || songs.length))]!, queue);
  }, [current.id, playTrack, queue, setShuffleMode]);

  useEffect(() => {
    if (!status.didJustFinish) { finishHandled.current = false; return; }
    if (finishHandled.current) return;
    finishHandled.current = true;
    record(current.id, true); playAdjacent(1);
  }, [status.didJustFinish, current.id, playAdjacent, record]);
  const toggle = () => { if (!status.playing) claimPlayback('media'); return status.playing ? audio.pause() : (loadedId.current === current.id && status.isLoaded ? audio.play() : playTrack(current)); };

  const scanLibrary = useCallback(async (force = false) => {
    if (scanningRef.current) return;
    if (!force && Date.now() - lastScanRef.current < SCAN_COOLDOWN_MS) return;
    scanningRef.current = true; setScanning(true);
    try {
      // Read audio/video separately: denying one must not block the other.
      const allowedKinds: MediaKind[] = [];
      const albumNames = new Map<string, string>();
      for (const kind of ['audio', 'video'] as const) {
        const permission = await MediaLibrary.requestPermissionsAsync(false, [kind]);
        if (!permission.granted && permission.accessPrivileges !== 'limited') continue;
        allowedKinds.push(kind);
      }
      if (allowedKinds.length) {
        const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
        albums.forEach(album => albumNames.set(album.id, album.title));
      }
      const scanKind = async (kind: MediaKind) => {
        const found: Track[] = [];
        let after: string | undefined;
        do {
          const page = await MediaLibrary.getAssetsAsync({ first: 1000, after, mediaType: kind, sortBy: [[MediaLibrary.SortBy.modificationTime, false]] });
          for (const asset of page.assets) {
            let path = asset.uri;
            try { path = decodeURIComponent(path); } catch {}
            const folderPath = path.startsWith('file:') ? path.slice(0, path.lastIndexOf('/')) : '';
            const folder = (asset.albumId && albumNames.get(asset.albumId)) || folderPath.split('/').pop() || 'Device media';
            const title = cleanFilename(asset.filename);
            found.push({ id: asset.id, title, artist: folder, uri: asset.uri, duration: asset.duration, kind, folder, category: smartCategory(`${title} ${folder}`, kind) });
          }
          if (!page.hasNextPage || page.endCursor === after) break;
          after = page.endCursor;
        } while (true);
        return found;
      };
      const all = (await Promise.all(allowedKinds.map(scanKind))).flat();
      if (!allowedKinds.length) Alert.alert('Media access needed', 'Allow Music and audio or Photos and videos in Android Settings → Apps → Pulse Player → Permissions.');
      const clean = all.filter(track => !isHiddenAudio(track));
      setExcluded(all.length - clean.length); setLibrary(clean);
      lastScanRef.current = Date.now();
      void AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify({ tracks: clean, excluded: all.length - clean.length, scannedAt: lastScanRef.current }));
      // Keep the currently selected queue while refreshing the library.
      setQueue(previous => loadedId.current ? previous : clean.length ? clean : samples);
    } catch (error) { Alert.alert('Media scan failed', String(error)); }
    finally { scanningRef.current = false; setScanning(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LIBRARY_KEY).then(value => {
      if (!active || !value) return;
      const cached = JSON.parse(value) as { tracks?: Track[]; excluded?: number; scannedAt?: number };
      if (!Array.isArray(cached.tracks)) return;
      const normalized = cached.tracks.map(track => ({ ...track, category: track.category || smartCategory(`${track.title} ${track.folder}`, track.kind) }));
      const tracks = normalized.filter(track => !isHiddenAudio(track));
      const removedFromCache = normalized.length - tracks.length;
      setLibrary(tracks); setExcluded((cached.excluded || 0) + removedFromCache); lastScanRef.current = cached.scannedAt || 0;
      if (removedFromCache) void AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify({ tracks, excluded: (cached.excluded || 0) + removedFromCache, scannedAt: cached.scannedAt || 0 }));
      setQueue(previous => loadedId.current ? previous : tracks.length ? tracks : samples);
    }).catch(() => undefined).finally(() => { if (active) void scanLibrary(false); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void scanLibrary(false); });
    const media = MediaLibrary.addListener(() => { void scanLibrary(true); });
    return () => { active = false; subscription.remove(); media.remove(); };
  }, [scanLibrary]);

  const visibleLibrary = useMemo(() => library.filter(track => !hiddenFolders.includes(track.folder)), [library, hiddenFolders]);
  const audioLibrary = useMemo(() => visibleLibrary.filter((track) => track.kind === 'audio'), [visibleLibrary]);
  const frequent = useMemo(() => [...audioLibrary].filter((track) => stats[track.id]?.completed).sort((a, b) => (stats[b.id]?.completed || 0) - (stats[a.id]?.completed || 0)).slice(0, 5), [audioLibrary, stats]);
  const least = useMemo(() => [...audioLibrary].sort((a, b) => (stats[a.id]?.plays || 0) - (stats[b.id]?.plays || 0)).slice(0, 5), [audioLibrary, stats]);
  const filtered = useMemo(() => { const q = search.toLowerCase().trim(); return q ? visibleLibrary.filter((track) => `${track.title} ${track.folder}`.toLowerCase().includes(q)) : visibleLibrary; }, [visibleLibrary, search]);
  const theme = THEMES.find(item => item.name === themeName) || THEMES[0]!;

  return <View style={[styles.safe, { backgroundColor: theme.background }]}>
    <View style={[styles.shell, { backgroundColor: theme.background }]}>
      <View pointerEvents="none" style={[styles.ambientOne, { backgroundColor: theme.glow }]} /><View pointerEvents="none" style={[styles.ambientTwo, { backgroundColor: theme.accent }]} />
      <View style={[styles.topbar, { borderBottomColor: theme.panel }]}><View><Text style={styles.brand}>Media studio</Text><Text style={[styles.tagline, { color: theme.accent }]}>MUSIC / VIDEO / SOUND</Text></View><View style={styles.topActions}><Pressable style={[styles.roundButton, { backgroundColor: theme.panel }]} onPress={() => setSettingsOpen(true)}><Ionicons name="color-palette-outline" size={22} color={theme.accent} /></Pressable><Pressable style={[styles.roundButton, { backgroundColor: theme.panel }]} onPress={openSoundStudio}><Ionicons name="options-outline" size={22} color={C.cream} /></Pressable></View></View>
      <BottomNav tab={tab} setTab={setTab} />
      <View style={styles.body}>
        {tab === 'Home' && <HomeScreen current={current} playing={status.playing} currentTime={status.currentTime} duration={status.duration || current.duration} buffering={status.isBuffering} shuffle={shuffle} setShuffle={setShuffleMode} enhance={enhance} cleanup={cleanup} setEnhance={setEnhance} setCleanup={setCleanup} onToggle={toggle} onPrevious={() => playAdjacent(-1)} onNext={() => playAdjacent(1)} onRandom={playRandom} onSeek={(ratio) => void audio.seekTo((status.duration || current.duration || 0) * ratio)} frequent={frequent} least={least} stats={stats} onPlay={(track) => playTrack(track, audioLibrary)} />}
        {(tab === 'Music' || tab === 'Video') && <MediaBrowser kind={tab === 'Music' ? 'audio' : 'video'} items={visibleLibrary} stats={stats} favourites={favourites} onFavourite={favourite} onPlay={playTrack} scanning={scanning} onScan={() => void scanLibrary(true)} excluded={excluded + library.length - visibleLibrary.length} shuffle={shuffle} onShuffle={() => setShuffleMode(!shuffle)} onRandom={(songs) => { const choices = songs.filter(song => song.id !== current.id); const pool = choices.length ? choices : songs; if (pool.length) { setShuffleMode(true); playTrack(pool[Math.floor(Math.random() * pool.length)]!, songs); } }} onHideFolder={hideFolder} dedicatedFolder="Pulse Player" theme={theme} />}
        {tab === 'Online' && <OnlineScreen onPlay={(track) => playTrack(track, [track])} />}
      </View>
      <MiniPlayer current={current} playing={status.playing} shuffle={shuffle} onPress={() => setTab('Home')} onToggle={toggle} onNext={() => playAdjacent(1)} />
    </View>
    <Modal visible={!!video} animationType="slide" onRequestClose={() => setVideo(null)}><SafeAreaProvider>{video && <VideoPlayerScreen track={video} onClose={() => setVideo(null)} />}</SafeAreaProvider></Modal>
    {meterReady && soundOpen && <AudioMeterBridge player={audio} onMeter={setMeter} />}
    <SoundPanel visible={soundOpen} onClose={() => setSoundOpen(false)} gains={gains} setGains={setGains} enabled={eqEnabled} setEnabled={setEqEnabled} status={eqStatus} volume={volume} setVolume={setVolume} bassBoost={bassBoost} setBassBoost={setBassBoost} clarity={clarity} setClarity={setClarity} spatial={spatial} setSpatial={setSpatial} loudness={loudness} setLoudness={setLoudness} hearingProtect={hearingProtect} setHearingProtect={setHearingProtect} playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} levels={meter.levels} spectrum={meter.spectrum} meterReady={meterReady} playing={status.playing} theme={theme} />
    <ThemePanel visible={settingsOpen} onClose={() => setSettingsOpen(false)} theme={themeName} onTheme={selectTheme} hiddenFolders={hiddenFolders} onShowFolder={showFolder} />
    <EnhancementModal visible={enhanceInfo} enhance={enhance} cleanup={cleanup} setEnhance={setEnhance} setCleanup={setCleanup} onClose={() => setEnhanceInfo(false)} />
  </View>;
}

function AudioMeterBridge({ player, onMeter }: { player: ReturnType<typeof useAudioPlayer>; onMeter(value: { levels: number[]; spectrum: number[] }): void }) {
  const lastUpdate = useRef(0);
  useEffect(() => () => player.setAudioSamplingEnabled(false), [player]);
  useAudioSampleListener(player, (sample) => {
    const now = Date.now();
    if (now - lastUpdate.current < 65) return;
    lastUpdate.current = now;
    const channels = sample.channels.map(channel => channel.frames);
    const measure = (frames: number[]) => {
      if (!frames.length) return 0;
      let sum = 0;
      for (let i = 0; i < frames.length; i += 4) sum += frames[i]! * frames[i]!;
      return Math.min(1, Math.sqrt(sum / Math.max(1, Math.ceil(frames.length / 4))) * 2.2);
    };
    const left = measure(channels[0] || []);
    const right = measure(channels[1] || channels[0] || []);
    const frames = channels[0] || [];
    const bars = Array.from({ length: 18 }, (_, index) => {
      const start = Math.floor(index * frames.length / 18);
      const end = Math.floor((index + 1) * frames.length / 18);
      return measure(frames.slice(start, end));
    });
    onMeter({ levels: [left, right], spectrum: bars });
  });
  return null;
}

function HomeScreen(p: { current: Track; playing: boolean; currentTime: number; duration: number; buffering: boolean; shuffle: boolean; setShuffle(v: boolean): void; enhance: boolean; cleanup: boolean; setEnhance(v: boolean): void; setCleanup(v: boolean): void; onToggle(): void; onPrevious(): void; onNext(): void; onRandom(): void; onSeek(v: number): void; frequent: Track[]; least: Track[]; stats: Stats; onPlay(t: Track): void }) {
  const progress = p.duration ? Math.min(p.currentTime / p.duration, 1) : 0;
  return <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
    <View style={styles.heroTop}><View><Text style={styles.eyebrow}>NOW PLAYING</Text><Text style={styles.heroGreeting}>Make room{`\n`}for the music.</Text></View><View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{p.playing ? 'PLAYING' : 'READY'}</Text></View></View>
    <View style={styles.artwork}><View style={styles.sun} /><View style={styles.waveOne} /><View style={styles.waveTwo} /><View style={styles.artRing}><Ionicons name="musical-notes" size={48} color={C.ink} /></View><View style={styles.cleanBadge}><Ionicons name="sparkles" size={13} color={C.ink} /><Text style={styles.cleanText}>{'PULSE AUDIO'}</Text></View></View>
    <Text style={styles.trackTitle} numberOfLines={1}>{p.current.title}</Text><Text style={styles.artist}>{p.current.artist}</Text>
    <Pressable style={styles.progressTouch} onPress={(e) => p.onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / 320)))}><View style={styles.progress}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /><View style={[styles.progressKnob, { left: `${progress * 100}%` }]} /></View></Pressable>
    <View style={styles.timeRow}><Text style={styles.time}>{formatTime(p.currentTime)}</Text><Text style={styles.time}>{p.buffering ? 'BUFFERING' : formatTime(p.duration)}</Text></View>
    <View style={styles.controls}><Pressable accessibilityLabel={p.shuffle ? 'Stop continuous random play' : 'Enable shuffle'} style={[styles.smallControl, p.shuffle && styles.activeControl]} onPress={() => p.setShuffle(!p.shuffle)}><Ionicons name="shuffle" size={21} color={p.shuffle ? C.ink : C.cream} /></Pressable><Pressable onPress={p.onPrevious}><Ionicons name="play-skip-back" size={25} color={C.cream} /></Pressable><Pressable style={styles.play} onPress={p.onToggle}><Ionicons name={p.playing ? 'pause' : 'play'} size={34} color={C.ink} /></Pressable><Pressable onPress={p.onNext}><Ionicons name="play-skip-forward" size={25} color={C.cream} /></Pressable><Pressable accessibilityLabel="Start continuous random play" style={[styles.smallControl,p.shuffle&&styles.activeControl]} onPress={p.onRandom}><Ionicons name="dice-outline" size={21} color={p.shuffle?C.ink:C.olive} /></Pressable></View>
    <View style={styles.soundCard}><Text style={styles.soundTitle}>Your sound, your way</Text><Text style={styles.artist}>Open the top-right sliders for bass, treble, equalizer and volume.</Text></View>
    <ListeningSection title="Frequently finished" empty="Finish songs and your favourites will collect here." items={p.frequent} stats={p.stats} onPlay={p.onPlay} accent={C.purple} />
    <ListeningSection title="Least listened" empty="Your least-played songs will appear after scanning." items={p.least} stats={p.stats} onPlay={p.onPlay} accent={C.blue} />
  </ScrollView>;
}

function LibraryScreen({ items, allItems, stats, search, setSearch, scanning, excluded, onScan, onPlay }: { items: Track[]; allItems: Track[]; stats: Stats; search: string; setSearch(v: string): void; scanning: boolean; excluded: number; onScan(): void; onPlay(t: Track, list?: Track[]): void }) {
  const [view, setView] = useState<LibraryView>('Folders');
  const [folder, setFolder] = useState<string | null>(null);
  const folders = useMemo(() => Object.entries(allItems.reduce<Record<string, Track[]>>((groups, track) => { (groups[track.folder] ||= []).push(track); return groups; }, {})).sort((a, b) => a[0].localeCompare(b[0])), [allItems]);
  const frequent = [...allItems].filter((t) => t.kind === 'audio' && stats[t.id]?.completed).sort((a, b) => (stats[b.id]?.completed || 0) - (stats[a.id]?.completed || 0));
  const least = [...allItems].filter((t) => t.kind === 'audio').sort((a, b) => (stats[a.id]?.plays || 0) - (stats[b.id]?.plays || 0));
  const folderTracks = folder ? folders.find(([name]) => name === folder)?.[1] || [] : [];
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.libraryHeader}><View><Text style={styles.bigTitle}>Your library</Text><Text style={styles.lead}>{allItems.length} clean files · {folders.length} folders</Text></View><Pressable style={styles.scanIcon} onPress={onScan}>{scanning ? <ActivityIndicator color={C.ink} /> : <Ionicons name="refresh" size={21} color={C.ink} />}</Pressable></View>
    <View style={styles.search}><Ionicons name="search" size={19} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search songs, videos, folders" placeholderTextColor="#77776f" style={styles.searchInput} /></View>
    {excluded > 0 && <View style={styles.filterNotice}><Ionicons name="eye-off-outline" size={17} color={C.olive} /><Text style={styles.filterText}>{excluded} WhatsApp/call-recording file{excluded === 1 ? '' : 's'} hidden</Text></View>}
    <View style={styles.tabs}>{(['Songs', 'Folders', 'Listening'] as LibraryView[]).map((name) => <Pressable key={name} style={[styles.tab, view === name && styles.tabActive]} onPress={() => { setView(name); setFolder(null); }}><Text style={[styles.tabText, view === name && styles.tabTextActive]}>{name}</Text></Pressable>)}</View>
    {view === 'Songs' && <>{items.length ? items.map((track) => <MediaRow key={track.id} track={track} stat={stats[track.id]} onPress={() => onPlay(track, items)} />) : <EmptyState />}</>}
    {view === 'Folders' && <>{folder ? <><Pressable style={styles.backFolder} onPress={() => setFolder(null)}><Ionicons name="arrow-back" size={18} color={C.coral} /><Text style={styles.backText}>All folders</Text></Pressable><SectionTitle title={folder} action={`${folderTracks.length} FILES`} />{folderTracks.map((track) => <MediaRow key={track.id} track={track} stat={stats[track.id]} onPress={() => onPlay(track, folderTracks)} />)}</> : <View style={styles.folderGrid}>{folders.map(([name, tracks], index) => <Pressable key={name} style={styles.folderCard} onPress={() => setFolder(name)}><View style={[styles.folderIcon, { backgroundColor: folderColor(index) }]}><Ionicons name="folder" size={28} color={C.ink} /></View><Text style={styles.folderName} numberOfLines={1}>{name}</Text><Text style={styles.folderCount}>{tracks.length} item{tracks.length === 1 ? '' : 's'}</Text></Pressable>)}</View>}</>}
    {view === 'Listening' && <><ListeningSection title="Frequently finished" empty="No fully listened songs yet." items={frequent.slice(0, 12)} stats={stats} onPlay={(track) => onPlay(track, frequent)} accent={C.purple} /><ListeningSection title="Least listened" empty="No songs found." items={least.slice(0, 12)} stats={stats} onPlay={(track) => onPlay(track, least)} accent={C.blue} /></>}
  </ScrollView>;
}

function ListeningSection({ title, empty, items, stats, onPlay, accent }: { title: string; empty: string; items: Track[]; stats: Stats; onPlay(t: Track): void; accent: string }) {
  return <><SectionTitle title={title} action={items.length ? `${items.length} SONGS` : 'BUILDING'} />{items.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>{items.map((track, index) => <Pressable key={track.id} style={styles.shelfCard} onPress={() => onPlay(track)}><View style={[styles.shelfArt, { backgroundColor: index % 2 ? accent : C.coral }]}><View style={styles.shelfDisc}><Ionicons name="musical-note" size={23} color={C.cream} /></View></View><Text style={styles.shelfTitle} numberOfLines={1}>{track.title}</Text><Text style={styles.shelfMeta}>{stats[track.id]?.completed || 0} finished · {stats[track.id]?.plays || 0} plays</Text></Pressable>)}</ScrollView> : <View style={styles.emptyStrip}><Ionicons name="stats-chart-outline" size={22} color={accent} /><Text style={styles.emptyStripText}>{empty}</Text></View>}</>;
}

function OnlineScreen({ onPlay }: { onPlay(track: Track): void }) {
  const [url, setUrl] = useState(''); const [title, setTitle] = useState('Online media'); const [kind, setKind] = useState<MediaKind>('audio');
  const submit = () => { const value = url.trim(); if (!/^https?:\/\//i.test(value)) return Alert.alert('Use a direct URL', 'Paste an http:// or https:// link to an authorized media file or stream.'); onPlay({ id: `online-${Date.now()}`, title: title.trim() || 'Online media', artist: 'Direct online source', uri: value, duration: 0, kind, folder: 'Online', category: 'Other' }); };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.onlineHero}><Ionicons name="globe-outline" size={38} color={C.ink} /><Text style={styles.onlineHeroTitle}>Open stream</Text><Text style={styles.onlineHeroText}>Private, direct and distraction-free.</Text></View><View style={styles.onlineCard}><Text style={styles.label}>MEDIA TYPE</Text><View style={styles.segment}>{(['audio', 'video'] as MediaKind[]).map((value) => <Pressable key={value} onPress={() => setKind(value)} style={[styles.segmentItem, kind === value && styles.segmentActive]}><Ionicons name={value === 'audio' ? 'musical-note' : 'videocam'} size={18} color={kind === value ? C.ink : C.cream} /><Text style={[styles.segmentText, kind === value && { color: C.ink }]}>{value}</Text></Pressable>)}</View><Text style={styles.label}>TITLE</Text><TextInput value={title} onChangeText={setTitle} style={styles.input} /><Text style={styles.label}>DIRECT URL</Text><TextInput value={url} onChangeText={setUrl} style={[styles.input, { minHeight: 78 }]} multiline autoCapitalize="none" autoCorrect={false} placeholder="https://example.com/song.mp3" placeholderTextColor={C.muted} /><Pressable style={styles.primaryButton} onPress={submit}><Ionicons name="play" size={20} color={C.ink} /><Text style={styles.primaryText}>Play now</Text></Pressable></View><View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={24} color={C.olive} /><Text style={styles.noticeText}>Pulse Player has no ads. It does not bypass ads, DRM, or access controls on third-party platforms.</Text></View><SectionTitle title="Try a sample" action="DIRECT MEDIA" />{samples.map((track) => <MediaRow key={track.id} track={track} onPress={() => onPlay(track)} />)}</ScrollView></KeyboardAvoidingView>;
}

function VideoPlayerScreen({ track, onClose }: { track: Track; onClose(): void }) {
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const player = useVideoPlayer({ uri: track.uri, metadata: { title: track.title, artist: track.artist } }, (p) => { p.staysActiveInBackground = true; p.showNowPlayingNotification = true; p.audioMixingMode = 'mixWithOthers'; p.play(); });
  useEffect(() => { void AsyncStorage.getItem(SUBTITLES_KEY).then(value => value !== null && setSubtitlesOn(value === 'true')); }, []);
  useEffect(() => {
    const update = (tracks = player.availableSubtitleTracks) => setSubtitleTracks([...tracks]);
    update();
    const subscription = player.addListener('availableSubtitleTracksChange', event => update(event.availableSubtitleTracks));
    return () => subscription.remove();
  }, [player]);
  useEffect(() => {
    player.subtitleTrack = subtitlesOn && subtitleTracks.length ? subtitleTracks[0]! : null;
  }, [player, subtitleTracks, subtitlesOn]);
  const toggleSubtitles = () => {
    if (!subtitleTracks.length) return Alert.alert('No subtitle track found', 'This video does not contain embedded subtitles. For automatic speech-to-text, enable Live Caption in your iQOO sound or accessibility settings.');
    const next = !subtitlesOn; setSubtitlesOn(next); void AsyncStorage.setItem(SUBTITLES_KEY, String(next));
  };
  const selectedSubtitle = player.subtitleTrack;
  return <SafeAreaView style={styles.videoScreen}><View style={styles.videoHeader}><Pressable style={styles.roundButton} onPress={onClose}><Ionicons name="chevron-down" size={24} color={C.cream} /></Pressable><View style={{flex:1}}><Text numberOfLines={1} style={styles.videoTitle}>{track.title}</Text><Text style={styles.artist}>{track.folder}</Text></View></View><VideoView player={player} style={styles.video} nativeControls contentFit="contain" allowsPictureInPicture startsPictureInPictureAutomatically /><View style={styles.subtitleDock}><Pressable onPress={toggleSubtitles} style={[styles.subtitleButton, subtitlesOn && subtitleTracks.length > 0 && styles.subtitleButtonActive]}><Ionicons name="logo-closed-captioning" size={21} color={subtitlesOn && subtitleTracks.length ? C.ink : C.cream} /><View><Text style={[styles.subtitleButtonText, subtitlesOn && subtitleTracks.length > 0 && {color:C.ink}]}>{subtitleTracks.length ? `Subtitles ${subtitlesOn ? 'ON' : 'OFF'}` : 'No embedded subtitles'}</Text>{selectedSubtitle && <Text style={styles.subtitleLanguage}>{selectedSubtitle.label || selectedSubtitle.language || 'Automatic track'}</Text>}</View></Pressable><Text style={styles.subtitleHelp}>{subtitleTracks.length ? `${subtitleTracks.length} caption track${subtitleTracks.length === 1 ? '' : 's'} detected automatically` : 'Use iQOO Live Caption to generate captions from speech'}</Text></View></SafeAreaView>;
}

function MediaRow({ track, stat, active, onPress }: { track: Track; stat?: TrackStat; active?: boolean; onPress(): void }) { return <Pressable style={[styles.mediaRow, active && styles.mediaActive]} onPress={onPress}><View style={[styles.mediaIcon, track.kind === 'video' && { backgroundColor: '#323a2b' }]}><Ionicons name={track.kind === 'video' ? 'videocam' : 'musical-note'} size={19} color={track.kind === 'video' ? C.olive : C.coral} /></View><View style={{ flex: 1 }}><Text style={styles.mediaTitle} numberOfLines={1}>{track.title}</Text><Text style={styles.mediaMeta} numberOfLines={1}>{track.folder}{track.duration ? ` · ${formatTime(track.duration)}` : ''}{stat ? ` · ${stat.plays} plays` : ''}</Text></View><Ionicons name={active ? 'volume-high' : 'play'} size={18} color={active ? C.coral : C.muted} /></Pressable>; }
function MiniPlayer({ current, playing, shuffle, onPress, onToggle, onNext }: { current: Track; playing: boolean; shuffle: boolean; onPress(): void; onToggle(): void; onNext(): void }) { return <Pressable style={styles.mini} onPress={onPress}><View style={styles.miniArt}><Ionicons name="musical-notes" size={19} color={C.ink} /></View><View style={{ flex: 1 }}><Text style={styles.miniTitle} numberOfLines={1}>{current.title}</Text><Text style={styles.miniMeta}>{shuffle ? 'SHUFFLE · ' : ''}{current.folder}</Text></View><Pressable style={styles.miniButton} onPress={onToggle}><Ionicons name={playing ? 'pause' : 'play'} size={21} color={C.cream} /></Pressable><Pressable style={styles.miniButton} onPress={onNext}><Ionicons name="play-skip-forward" size={18} color={C.cream} /></Pressable></Pressable>; }
function BottomNav({ tab, setTab }: { tab: Tab; setTab(t: Tab): void }) {
 return <SectionTabs selected={tab} onSelect={setTab} items={[{name:'Home',icon:'radio-outline'}, {name:'Music',icon:'musical-notes-outline'}, {name:'Video',icon:'videocam-outline'}, {name:'Online',icon:'globe-outline'}]} />;
}

function EnhanceRow({ icon, title, subtitle, value, onChange }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; value: boolean; onChange(v: boolean): void }) { return <View style={styles.enhanceRow}><View style={styles.enhanceIcon}><Ionicons name={icon} size={19} color={C.olive} /></View><View style={{ flex: 1 }}><Text style={styles.enhanceTitle}>{title}</Text><Text style={styles.enhanceSub}>{subtitle}</Text></View><Switch value={value} onValueChange={onChange} thumbColor={value ? C.cream : '#777'} trackColor={{ false: '#484942', true: C.coral }} /></View>; }
function EnhancementModal({ visible, enhance, cleanup, setEnhance, setCleanup, onClose }: { visible: boolean; enhance: boolean; cleanup: boolean; setEnhance(v: boolean): void; setCleanup(v: boolean): void; onClose(): void }) { return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable style={styles.modalShade} onPress={onClose}><Pressable style={styles.modalCard}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>Sound profile</Text><Text style={styles.modalCopy}>Clarity lift applies conservative loudness. True real-time denoising still requires compatible native/device DSP.</Text><EnhanceRow icon="sparkles" title="Clarity lift" subtitle="Balanced presence" value={enhance} onChange={setEnhance} /><View style={styles.divider} /><EnhanceRow icon="shield-checkmark" title="Software cleanup" subtitle="Preferred DSP profile" value={cleanup} onChange={setCleanup} /><Pressable style={styles.primaryButton} onPress={onClose}><Text style={styles.primaryText}>Done</Text></Pressable></Pressable></Pressable></Modal>; }
function ThemePanel({ visible, onClose, theme, onTheme, hiddenFolders, onShowFolder }: { visible: boolean; onClose(): void; theme: ThemeName; onTheme(name: ThemeName): void; hiddenFolders: string[]; onShowFolder(folder: string): void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.settingsCard}><View style={styles.settingsHeader}><View><Text style={styles.modalTitle}>Appearance & privacy</Text><Text style={styles.modalCopy}>Choose a background and manage hidden audio folders.</Text></View><Pressable style={styles.roundButton} onPress={onClose}><Ionicons name="close" size={22} color={C.cream} /></Pressable></View><Text style={styles.settingsLabel}>APP THEME</Text><View style={styles.themeGrid}>{THEMES.map(item => <Pressable key={item.name} onPress={() => onTheme(item.name)} style={[styles.themeChoice, { backgroundColor: item.background, borderColor: theme === item.name ? item.accent : item.panel }]}><View style={[styles.themeSwatch, { backgroundColor: item.accent }]} /><Text style={styles.themeName}>{item.name}</Text>{theme === item.name && <Ionicons name="checkmark-circle" size={18} color={item.accent} />}</Pressable>)}</View><Text style={styles.settingsLabel}>HIDDEN AUDIO FOLDERS</Text>{hiddenFolders.length ? hiddenFolders.map(folder => <View key={folder} style={styles.hiddenRow}><Ionicons name="folder" size={19} color={C.muted} /><Text style={styles.hiddenName} numberOfLines={1}>{folder}</Text><Pressable onPress={() => onShowFolder(folder)}><Text style={styles.unhide}>Unhide</Text></Pressable></View>) : <Text style={styles.modalCopy}>No manually hidden folders. WhatsApp Audio and iQOO Recordings/Record/Call are always excluded.</Text>}<Pressable style={styles.primaryButton} onPress={onClose}><Text style={styles.primaryText}>Done</Text></Pressable></View></View></Modal>;
}
function SectionTitle({ title, action }: { title: string; action: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionAction}>{action}</Text></View>; }
function EmptyState() { return <View style={styles.empty}><Ionicons name="folder-open-outline" size={39} color={C.olive} /><Text style={styles.emptyTitle}>No clean media found</Text><Text style={styles.emptyCopy}>WhatsApp audio and call recordings are automatically excluded.</Text></View>; }
function cleanFilename(v: string) { return v.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled'; }
function formatTime(v: number) { if (!Number.isFinite(v) || v <= 0) return '0:00'; return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`; }
function folderColor(index: number) { return [C.coral, C.olive, C.purple, C.blue][index % 4]!; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ink }, shell: { flex: 1, backgroundColor: C.ink, overflow: 'hidden' }, body: { flex: 1 }, page: { padding: 20, paddingBottom: 32 }, ambientOne: { position: 'absolute', width: 330, height: 330, borderRadius: 180, opacity: .22, right: -155, top: 90 }, ambientTwo: { position: 'absolute', width: 240, height: 240, borderRadius: 130, opacity: .08, left: -120, bottom: 100 },
  topbar: { height: 74, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#292b25' }, topActions: { flexDirection: 'row', gap: 9 }, brand: { color: C.cream, fontSize: 25, fontWeight: '900', letterSpacing: 5 }, tagline: { color: C.coral, fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: -1 }, roundButton: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#2b2d27', alignItems: 'center', justifyContent: 'center' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }, eyebrow: { color: C.olive, fontWeight: '900', fontSize: 9, letterSpacing: 2.3 }, heroGreeting: { color: C.cream, fontSize: 30, lineHeight: 31, fontWeight: '900', letterSpacing: -1.1, marginTop: 7 }, livePill: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: C.surface, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.coral }, liveText: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  artwork: { height: 228, borderRadius: 34, backgroundColor: C.coral, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#ff8c71' }, sun: { position: 'absolute', width: 145, height: 145, borderRadius: 80, backgroundColor: C.cream, top: 22, right: 27 }, waveOne: { position: 'absolute', width: 340, height: 190, borderRadius: 170, borderWidth: 29, borderColor: '#d94f34', left: -140, bottom: -93 }, waveTwo: { position: 'absolute', width: 270, height: 160, borderRadius: 150, borderWidth: 22, borderColor: C.olive, right: -110, bottom: -85 }, artRing: { width: 94, height: 94, borderRadius: 50, backgroundColor: 'rgba(244,234,216,.32)', borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }, cleanBadge: { position: 'absolute', left: 15, top: 15, backgroundColor: C.cream, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', gap: 5, alignItems: 'center' }, cleanText: { color: C.ink, fontWeight: '900', fontSize: 8, letterSpacing: 1 },
  trackTitle: { color: C.cream, fontSize: 26, fontWeight: '900', letterSpacing: -.7 }, artist: { color: C.muted, fontSize: 12, marginTop: 4 }, progressTouch: { height: 28, justifyContent: 'center', marginTop: 15 }, progress: { height: 5, backgroundColor: '#41433b', borderRadius: 4 }, progressFill: { height: 5, backgroundColor: C.coral, borderRadius: 4 }, progressKnob: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: C.cream, marginLeft: -5, top: -3 }, timeRow: { flexDirection: 'row', justifyContent: 'space-between' }, time: { color: C.muted, fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] }, controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 17 }, play: { width: 66, height: 66, borderRadius: 34, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }, smallControl: { width: 39, height: 39, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }, activeControl: { backgroundColor: C.olive },
  soundCard: { backgroundColor: C.surface, borderRadius: 25, padding: 16, borderWidth: 1, borderColor: '#30332b' }, soundHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }, soundTitle: { color: C.cream, fontSize: 17, fontWeight: '900' }, soundStatus: { color: C.olive, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, enhanceRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, enhanceIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#34372a', alignItems: 'center', justifyContent: 'center' }, enhanceTitle: { color: C.cream, fontSize: 13, fontWeight: '800' }, enhanceSub: { color: C.muted, fontSize: 9, marginTop: 2 }, divider: { height: 1, backgroundColor: C.line, marginVertical: 13 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 27, marginBottom: 11 }, sectionTitle: { color: C.cream, fontSize: 18, fontWeight: '900' }, sectionAction: { color: C.coral, fontSize: 8, letterSpacing: 1.1, fontWeight: '900' }, shelf: { gap: 12, paddingRight: 8 }, shelfCard: { width: 135 }, shelfArt: { height: 124, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, shelfDisc: { width: 67, height: 67, borderRadius: 34, backgroundColor: C.ink, borderWidth: 10, borderColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' }, shelfTitle: { color: C.cream, fontSize: 12, fontWeight: '800', marginTop: 8 }, shelfMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, emptyStrip: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: C.surface }, emptyStripText: { color: C.muted, flex: 1, fontSize: 10, lineHeight: 15 },
  libraryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, bigTitle: { color: C.cream, fontSize: 32, fontWeight: '900', letterSpacing: -1 }, lead: { color: C.muted, fontSize: 11, marginTop: 5, marginBottom: 17 }, scanIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: C.olive, alignItems: 'center', justifyContent: 'center' }, search: { height: 51, borderRadius: 17, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 9 }, searchInput: { flex: 1, color: C.cream, fontSize: 13 }, filterNotice: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10, paddingHorizontal: 4 }, filterText: { color: C.muted, fontSize: 9 }, tabs: { flexDirection: 'row', backgroundColor: C.surface, padding: 5, borderRadius: 18, marginTop: 17, marginBottom: 16 }, tab: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13 }, tabActive: { backgroundColor: C.coral }, tabText: { color: C.muted, fontSize: 11, fontWeight: '800' }, tabTextActive: { color: C.ink },
  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, folderCard: { width: '48%', borderRadius: 22, padding: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: '#30332b' }, folderIcon: { height: 84, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 11 }, folderName: { color: C.cream, fontSize: 13, fontWeight: '900' }, folderCount: { color: C.muted, fontSize: 9, marginTop: 3 }, backFolder: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 }, backText: { color: C.coral, fontSize: 11, fontWeight: '900' },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 9, borderRadius: 17, marginBottom: 3 }, mediaActive: { backgroundColor: '#2f2d27' }, mediaIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: '#3a2b26', alignItems: 'center', justifyContent: 'center' }, mediaTitle: { color: C.cream, fontSize: 13, fontWeight: '800' }, mediaMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, empty: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 24, padding: 28 }, emptyTitle: { color: C.cream, fontSize: 15, fontWeight: '900', marginTop: 11 }, emptyCopy: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 5 },
  onlineHero: { height: 165, backgroundColor: C.olive, borderRadius: 29, padding: 21, justifyContent: 'flex-end', marginBottom: 14 }, onlineHeroTitle: { color: C.ink, fontSize: 25, fontWeight: '900', marginTop: 9 }, onlineHeroText: { color: '#464936', fontSize: 11, marginTop: 3 }, onlineCard: { backgroundColor: C.surface, borderRadius: 25, padding: 17 }, label: { color: C.olive, fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 8, marginBottom: 8 }, segment: { flexDirection: 'row', gap: 8 }, segmentItem: { flex: 1, height: 43, borderRadius: 14, backgroundColor: '#192940', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, segmentActive: { backgroundColor: C.coral }, segmentText: { color: C.cream, fontWeight: '800', fontSize: 11, textTransform: 'capitalize' }, input: { color: C.cream, backgroundColor: '#192940', borderRadius: 15, paddingHorizontal: 13, paddingVertical: 12, fontSize: 12, textAlignVertical: 'top' }, primaryButton: { minHeight: 49, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 16 }, primaryText: { color: C.ink, fontWeight: '900', fontSize: 13 }, notice: { flexDirection: 'row', gap: 11, backgroundColor: '#25291f', borderRadius: 18, padding: 14, marginTop: 12 }, noticeText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  mini: { minHeight: 67, marginHorizontal: 9, paddingHorizontal: 9, backgroundColor: '#142038', borderRadius: 20, flexDirection: 'row', gap: 9, alignItems: 'center', borderWidth: 1, borderColor: '#293953' }, miniArt: { width: 47, height: 47, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }, miniTitle: { color: C.cream, fontSize: 12, fontWeight: '900' }, miniMeta: { color: C.olive, fontSize: 8, marginTop: 3, fontWeight: '800' }, miniButton: { width: 35, height: 40, alignItems: 'center', justifyContent: 'center' }, nav: { height: 69, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2d2f29', marginTop: 6 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, navIcon: { width: 35, height: 29, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconActive: { backgroundColor: C.coral }, navText: { color: C.muted, fontSize: 8, fontWeight: '800' },
  videoScreen: { flex: 1, backgroundColor: '#080906', justifyContent: 'center' }, videoHeader: { position: 'absolute', zIndex: 2, left: 16, right: 16, top: 20, flexDirection: 'row', gap: 12, alignItems: 'center' }, videoTitle: { color: C.cream, fontWeight: '900', fontSize: 15 }, video: { width: '100%', aspectRatio: 16 / 9 }, subtitleDock: { marginTop: 17, paddingHorizontal: 18, alignItems: 'center' }, subtitleButton: { minWidth: 210, minHeight: 53, borderRadius: 18, borderWidth: 1, borderColor: '#3D433D', backgroundColor: '#20231F', paddingHorizontal: 16, flexDirection: 'row', gap: 11, alignItems: 'center', justifyContent: 'center' }, subtitleButtonActive: { backgroundColor: C.olive, borderColor: C.olive }, subtitleButtonText: { color: C.cream, fontSize: 12, fontWeight: '900' }, subtitleLanguage: { color: '#4E533E', fontSize: 8, fontWeight: '800', marginTop: 2 }, subtitleHelp: { color: C.muted, fontSize: 9, marginTop: 8, textAlign: 'center' }, modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34 }, modalHandle: { alignSelf: 'center', width: 45, height: 4, borderRadius: 3, backgroundColor: '#5a5a52', marginBottom: 18 }, modalTitle: { color: C.cream, fontSize: 24, fontWeight: '900' }, modalCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7, marginBottom: 20 }, settingsCard: { backgroundColor: '#101A30', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34 }, settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, settingsLabel: { color: C.olive, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 18, marginBottom: 10 }, themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, themeChoice: { width: '48%', height: 68, borderRadius: 18, borderWidth: 2, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, themeSwatch: { width: 18, height: 36, borderRadius: 9 }, themeName: { color: C.cream, fontSize: 12, fontWeight: '900', flex: 1 }, hiddenRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: C.line }, hiddenName: { color: C.cream, flex: 1, fontSize: 12, fontWeight: '700' }, unhide: { color: C.olive, fontWeight: '900', fontSize: 11 },
});
