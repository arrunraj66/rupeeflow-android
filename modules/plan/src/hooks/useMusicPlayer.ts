import { claimPlayback, registerPlayback } from '../../../../shared/playback';
import { useEffect, useRef, useState } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Track } from '../types';

export function useMusicPlayer() {
  const sound = useRef<Audio.Sound | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1);

  const pending = useRef(0);
  useEffect(() => {
    const unregister = registerPlayback('plan', async () => {
      pending.current++;
      await sound.current?.pauseAsync();
    });
    return () => { unregister(); pending.current++; void sound.current?.unloadAsync(); };
  }, []);

  const activate = async () => {
    claimPlayback('plan');
    await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true,
      shouldDuckAndroid: false });
  };

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPlaying(status.isPlaying);
    setPosition(status.positionMillis);
    setDuration(status.durationMillis || 1);
    if (status.didJustFinish) setPlaying(false);
  };

  const play = async (track: Track) => {
    const request = ++pending.current;
    await activate();
    if (request !== pending.current) return;
    if (current?.id === track.id && sound.current) {
      await sound.current.playAsync();
      return;
    }
    const previous = sound.current; sound.current = null;
    await previous?.unloadAsync();
    const result = await Audio.Sound.createAsync({ uri: track.uri }, { shouldPlay: false }, onStatus);
    if (request !== pending.current) { await result.sound.unloadAsync(); return; }
    sound.current = result.sound;
    setCurrent(track);
    await result.sound.playAsync();
  };

  const toggle = async () => {
    if (!sound.current) return;
    if (playing) await sound.current.pauseAsync();
    else { await activate(); await sound.current.playAsync(); }
  };

  const seek = async (ratio: number) => sound.current?.setPositionAsync(Math.max(0, Math.min(1, ratio)) * duration);

  return { current, playing, position, duration, progress: position / duration, play, toggle, seek };
}
