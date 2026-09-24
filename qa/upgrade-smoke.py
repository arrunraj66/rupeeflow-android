import pathlib, re, subprocess, time, xml.etree.ElementTree as ET

out = pathlib.Path('upgrade-screenshots'); out.mkdir(exist_ok=True)
def adb(*args, check=True):
    return subprocess.run(['adb', *args], check=check, capture_output=True, text=True).stdout
def dump(name):
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', check=False)
    xml = adb('shell', 'cat', '/sdcard/ui.xml', check=False)
    if xml:
        (out / f'{name}.xml').write_text(xml)
        (out / f'{name}.png').write_bytes(subprocess.check_output(['adb','exec-out','screencap','-p']))
    return xml
def wait_for(text, name, attempts=20):
    for _ in range(attempts):
        time.sleep(1); xml=dump(name)
        if text in xml: return xml
        if "Pixel Launcher isn't responding" in xml and 'text="Close app"' in xml:
            nodes=[n for n in ET.fromstring(xml).iter('node') if n.get('text')=='Close app']
            if nodes:
                x1,y1,x2,y2=map(int,re.findall(r'\d+',nodes[-1].get('bounds')))
                adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2),check=False)
    raw=adb('logcat','-d','-t','5000',check=False)
    keys=('com.arun.one','AndroidRuntime','ReactNative','FATAL','SoLoader','ActivityTaskManager','Expo','libc')
    logs='\n'.join(line for line in raw.splitlines() if any(key in line for key in keys))
    logs+='\n\nACTIVITIES:\n'+adb('shell','dumpsys','activity','activities',check=False)
    (out/f'{name}-fatal.log').write_text(logs)
    raise AssertionError(f'{name}: expected {text!r}\n{logs[-12000:]}')
def tap(label, xml):
    nodes=[n for n in ET.fromstring(xml).iter('node') if n.get('text')==label or label in n.get('content-desc','')]
    if not nodes: raise AssertionError('Cannot find '+label)
    x1,y1,x2,y2=map(int,re.findall(r'\d+',nodes[-1].get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))

# Reproduce the user's path: v2.0 is already installed, then hotfix is installed over it.
adb('install','-r','old/Arun-One-2.0.0-Preview.apk')
print(adb('shell','am','start','-W','-n','com.arun.one/.MainActivity'))
# 2.0 may return to the launcher on affected upgrade paths; install the hotfix
# over that exact package without clearing its sandbox.
time.sleep(5); dump('before-upgrade')
adb('shell','am','force-stop','com.arun.one')
adb('install','-r','new/Arun-One-2.0.1-Hotfix.apk')
package=adb('shell','dumpsys','package','com.arun.one')
assert 'versionCode=4' in package and 'versionName=2.0.1' in package
adb('shell','pm','grant','com.arun.one','android.permission.POST_NOTIFICATIONS',check=False)
adb('shell','appops','set','com.arun.one','USE_FULL_SCREEN_INTENT','allow',check=False)
adb('shell','appops','set','com.arun.one','SCHEDULE_EXACT_ALARM','allow',check=False)
adb('logcat','-c'); adb('shell','am','force-stop','com.arun.one')
print(adb('shell','am','start','-W','-n','com.arun.one/.MainActivity'))
xml=wait_for('ARUN ONE 2.0 PREVIEW','after-upgrade')
tap('More',xml); xml=wait_for('Feature Lab','more')
tap('Plan',xml); xml=wait_for('YOUR DAY AT A GLANCE','plan')
tap('Alarms',xml); xml=wait_for('Test in 5 sec','alarms')
tap('Test in 5 sec',xml); xml=wait_for('Test alarm set','test-confirmation')
adb('shell','input','keyevent','66'); time.sleep(1); adb('shell','input','keyevent','26')
xml=wait_for('STOP ALARM','ringing',attempts=20); assert 'SNOOZE 5 MIN' in xml
tap('STOP ALARM',xml); time.sleep(2)
logs=adb('logcat','-d','-s','AndroidRuntime:E','ReactNativeJS:E'); (out/'errors.log').write_text(logs)
assert 'FATAL EXCEPTION' not in logs and 'ReactNativeJS: Error:' not in logs, logs
print('PASS: in-place 2.0 to 2.0.1 upgrade opens safely and wake-up alarm works.')
