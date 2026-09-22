import pathlib, re, subprocess, time, xml.etree.ElementTree as ET

out = pathlib.Path('alarm-screenshots'); out.mkdir(exist_ok=True)
def adb(*args, check=True):
    return subprocess.run(['adb', *args], check=check, capture_output=True, text=True).stdout
def dump(name):
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', check=False)
    xml = adb('shell', 'cat', '/sdcard/ui.xml'); (out / f'{name}.xml').write_text(xml)
    (out / f'{name}.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
    return xml
def wait_for(text, name, attempts=15):
    for _ in range(attempts):
        time.sleep(1)
        xml = dump(name)
        if text in xml: return xml
    raise AssertionError(f'{name}: expected {text!r}')
def tap(label, xml):
    nodes = [n for n in ET.fromstring(xml).iter('node') if n.get('text') == label or label in n.get('content-desc', '')]
    if not nodes: raise AssertionError('Cannot find ' + label)
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', nodes[-1].get('bounds')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))

adb('install', '-r', 'delivery/Arun-One-1.1.0.apk')
adb('shell', 'pm', 'grant', 'com.arun.one', 'android.permission.POST_NOTIFICATIONS', check=False)
adb('shell', 'appops', 'set', 'com.arun.one', 'USE_FULL_SCREEN_INTENT', 'allow', check=False)
adb('shell', 'appops', 'set', 'com.arun.one', 'SCHEDULE_EXACT_ALARM', 'allow', check=False)
adb('logcat', '-c')
adb('shell', 'am', 'start', '-W', '-n', 'com.arun.one/.MainActivity')
xml = wait_for('YOUR DAY AT A GLANCE', 'plan')
tap('Alarms', xml); xml = wait_for('Test in 5 sec', 'alarms')
tap('Test in 5 sec', xml); xml = wait_for('Test alarm set', 'test-confirmation')
adb('shell', 'input', 'keyevent', '66'); time.sleep(1)
adb('shell', 'input', 'keyevent', '26')
xml = wait_for('STOP ALARM', 'ringing', attempts=20)
assert 'SNOOZE 5 MIN' in xml and 'WAKE-UP ALARM' in xml
tap('STOP ALARM', xml); time.sleep(2)
assert 'WakeAlarmActivity' not in adb('shell', 'dumpsys', 'activity', 'activities')
logs = adb('logcat', '-d', '-s', 'AndroidRuntime:E', 'ReactNativeJS:E')
(out / 'errors.log').write_text(logs)
assert 'FATAL EXCEPTION' not in logs and 'ReactNativeJS: Error:' not in logs, logs
print('PASS: exact test alarm woke the locked screen, showed full-screen Stop/Snooze, and stopped cleanly.')
