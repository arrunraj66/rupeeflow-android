// Version-guarded native extension; reapplied after npm install.
const fs = require('fs');
const path = require('path');
const root = path.dirname(require.resolve('expo-audio/package.json'));
if (require(path.join(root, 'package.json')).version !== '1.1.1') throw Error('Review HUSH audio patch for this expo-audio version');
const dir = path.join(root, 'android/src/main/java/expo/modules/audio');
const file = path.join(dir, 'AudioPlayer.kt');
let source = fs.readFileSync(file, 'utf8');
if (!source.includes('fun hushSoundStudio')) {
  if (source.includes('fun hushEqualizer')) {
    source = source.replace(/  private var hushEq:[\s\S]*?  fun hushRelease\(\) \{[^\n]*\}\n/, '');
  }
  source = source.replace('  val id = UUID.randomUUID().toString()', `
  private var hushEq: android.media.audiofx.Equalizer? = null
  private var hushBass: android.media.audiofx.BassBoost? = null
  private var hushWidth: android.media.audiofx.Virtualizer? = null
  private var hushLoudness: android.media.audiofx.LoudnessEnhancer? = null
  private var hushSession = -1
  fun hushSoundStudio(gains: List<Double>, enabled: Boolean, bass: Double, clarity: Double, width: Double, loudness: Double, protect: Boolean): String {
    val session = ref.audioSessionId
    if (session <= 0) return "Start music to activate the sound engine"
    return try {
      if (hushSession != session) {
        hushRelease()
        hushEq = try { android.media.audiofx.Equalizer(0, session) } catch (_: Exception) { null }
        hushBass = try { android.media.audiofx.BassBoost(0, session) } catch (_: Exception) { null }
        hushWidth = try { android.media.audiofx.Virtualizer(0, session) } catch (_: Exception) { null }
        hushLoudness = try { android.media.audiofx.LoudnessEnhancer(session) } catch (_: Exception) { null }
        hushSession = session
      }
      val eq = hushEq ?: return "Equalizer is not supported by this audio output"
      val range = eq.bandLevelRange
      val targets = doubleArrayOf(60.0, 230.0, 910.0, 3600.0, 14000.0)
      val clarityShape = doubleArrayOf(-0.3, -0.15, 0.45, 1.0, 0.55)
      for (i in 0 until eq.numberOfBands.toInt()) {
        val hz = eq.getCenterFreq(i.toShort()) / 1000.0
        val nearest = targets.indices.minByOrNull { kotlin.math.abs(kotlin.math.ln(hz / targets[it])) } ?: 0
        val clarityDb = clarity.coerceIn(0.0, 1.0) * clarityShape[nearest] * 3.5
        val db = (gains.getOrNull(nearest) ?: 0.0) + clarityDb
        eq.setBandLevel(i.toShort(), (db * 100).toInt().coerceIn(range[0].toInt(), range[1].toInt()).toShort())
      }
      eq.enabled = enabled
      hushBass?.setStrength((bass.coerceIn(0.0, 1.0) * 1000).toInt().toShort())
      hushBass?.enabled = bass > 0.01
      hushWidth?.setStrength((width.coerceIn(0.0, 1.0) * 1000).toInt().toShort())
      hushWidth?.enabled = width > 0.01
      val maxEq = gains.maxOrNull()?.coerceAtLeast(0.0) ?: 0.0
      val safeGain = if (protect) (450.0 - maxEq * 55.0).coerceAtLeast(0.0) else 700.0
      hushLoudness?.setTargetGain((loudness.coerceIn(0.0, 1.0) * safeGain).toInt())
      hushLoudness?.enabled = loudness > 0.01
      "DSP active · "+eq.numberOfBands+" EQ bands · safe gain "+(if (protect) "on" else "off")
    } catch (e: Exception) { "Sound engine unavailable on this output: "+e.javaClass.simpleName }
  }
  fun hushRelease() {
    hushEq?.release(); hushEq = null
    hushBass?.release(); hushBass = null
    hushWidth?.release(); hushWidth = null
    hushLoudness?.release(); hushLoudness = null
    hushSession = -1
  }
  val id = UUID.randomUUID().toString()`);
  fs.writeFileSync(file, source);
}
// Keep earlier generated patches forward-compatible when this script is rerun.
source = fs.readFileSync(file, 'utf8')
  .replace('hushEq = android.media.audiofx.Equalizer(0, session)', 'hushEq = try { android.media.audiofx.Equalizer(0, session) } catch (_: Exception) { null }')
  .replace('hushBass = android.media.audiofx.BassBoost(0, session)', 'hushBass = try { android.media.audiofx.BassBoost(0, session) } catch (_: Exception) { null }')
  .replace('hushWidth = android.media.audiofx.Virtualizer(0, session)', 'hushWidth = try { android.media.audiofx.Virtualizer(0, session) } catch (_: Exception) { null }')
  .replace('hushLoudness = android.media.audiofx.LoudnessEnhancer(session)', 'hushLoudness = try { android.media.audiofx.LoudnessEnhancer(session) } catch (_: Exception) { null }')
  .replace('val eq = hushEq!!', 'val eq = hushEq ?: return "Equalizer is not supported by this audio output"');
fs.writeFileSync(file, source);
if (!source.includes('"currentMediaItemIndex" to ref.currentMediaItemIndex')) {
  source = source.replace('"id" to id,', '"id" to id,\n      "currentMediaItemIndex" to ref.currentMediaItemIndex,');
  fs.writeFileSync(file, source);
}
const moduleFile = path.join(dir, 'AudioModule.kt');
source = fs.readFileSync(file, 'utf8');
if (!source.includes('      hushRelease()')) {
  source = source.replace('      ref.release()', '      hushRelease()\n      ref.release()');
  fs.writeFileSync(file, source);
}
let moduleSource = fs.readFileSync(moduleFile, 'utf8');
if (moduleSource.includes('Function("hushEqualizer")')) {
  moduleSource = moduleSource.replace(/      Function\("hushEqualizer"\)[\s\S]*?\n      \}\n(?=      Function\("remove"\))/, '');
}
if (!moduleSource.includes('Function("hushSoundStudio")')) {
  moduleSource = moduleSource.replace('      Function("remove") { player: AudioPlayer ->', `      Function("hushSoundStudio") { player: AudioPlayer, gains: List<Double>, enabled: Boolean, bass: Double, clarity: Double, width: Double, loudness: Double, protect: Boolean ->
        runOnMain { player.hushSoundStudio(gains, enabled, bass, clarity, width, loudness, protect) }
      }
      Function("remove") { player: AudioPlayer ->
        player.hushRelease()`);
  fs.writeFileSync(moduleFile, moduleSource);
}
if (!moduleSource.includes('Function("hushSetQueue")')) {
  moduleSource = moduleSource.replace('      Function("hushSoundStudio") { player: AudioPlayer, gains: List<Double>, enabled: Boolean, bass: Double, clarity: Double, width: Double, loudness: Double, protect: Boolean ->', `      Function("hushSetQueue") { player: AudioPlayer, sources: List<AudioSource>, index: Int, shuffle: Boolean ->
        runOnMain {
          val mediaSources = sources.mapNotNull { createMediaItem(it) }
          if (mediaSources.isNotEmpty()) {
            player.ref.setMediaSources(mediaSources, index.coerceIn(0, mediaSources.lastIndex), 0L)
            player.ref.shuffleModeEnabled = shuffle
            player.ref.prepare()
            if (!focusAcquired) requestAudioFocus()
            player.ref.play()
          }
        }
      }
      Function("hushSetShuffle") { player: AudioPlayer, enabled: Boolean ->
        runOnMain { player.ref.shuffleModeEnabled = enabled }
      }
      Function("hushSoundStudio") { player: AudioPlayer, gains: List<Double>, enabled: Boolean, bass: Double, clarity: Double, width: Double, loudness: Double, protect: Boolean ->`);
  fs.writeFileSync(moduleFile, moduleSource);
}
moduleSource = fs.readFileSync(moduleFile, 'utf8').replace('        player.hushRelease()\n        player.hushRelease()', '        player.hushRelease()');
fs.writeFileSync(moduleFile, moduleSource);
const callbackFile = path.join(dir, 'service/AudioMediaSessionCallback.kt');
let callbackSource = fs.readFileSync(callbackFile, 'utf8');
if (callbackSource.includes('// Remove track navigation commands')) {
  callbackSource = callbackSource.replace(`            // Remove track navigation commands
            .remove(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .remove(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .remove(Player.COMMAND_SEEK_TO_PREVIOUS)
            .remove(Player.COMMAND_SEEK_TO_NEXT)
`, `            // Keep playlist navigation commands for Bluetooth headsets and watches
            .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .add(Player.COMMAND_SEEK_TO_NEXT)
`);
  fs.writeFileSync(callbackFile, callbackSource);
}
