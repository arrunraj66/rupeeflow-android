import subprocess, time, re, pathlib, xml.etree.ElementTree as ET
out=pathlib.Path('screenshots');out.mkdir(exist_ok=True)
def adb(*args,check=True):return subprocess.run(['adb',*args],check=check,capture_output=True).stdout.decode(errors='replace')
def dump(name):
 adb('shell','uiautomator','dump','/sdcard/ui.xml')
 xml=adb('shell','cat','/sdcard/ui.xml');(out/f'{name}.xml').write_text(xml)
 return xml

def wait_for(text,name):
 for i in range(12):
  time.sleep(2)
  xml=dump(name)
  if text in xml:
   image=subprocess.check_output(['adb','exec-out','screencap','-p']);(out/f'{name}.png').write_bytes(image)
   return xml
 raise AssertionError(f'{name}: expected {text!r} not visible')
def tap_label(label,xml):
 nodes=ET.fromstring(xml).iter('node')
 candidates=[n for n in nodes if n.get('text')==label or label in n.get('content-desc','').split(', ')]
 if not candidates:raise AssertionError('Cannot find '+label)
 # Main navigation lives below each module's local tabs.
 n=max(candidates,key=lambda n:int(re.findall(r'\d+',n.get('bounds'))[1]))
 x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
 adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))

adb('install','-r','delivery/Arun-One-1.0.0.apk')
for p in ['POST_NOTIFICATIONS','READ_MEDIA_AUDIO','READ_MEDIA_VIDEO']:
 adb('shell','pm','grant','com.arun.one','android.permission.'+p,check=False)
adb('logcat','-c')
adb('shell','am','start','-W','-n','com.arun.one/.MainActivity')
xml=wait_for('YOUR DAY AT A GLANCE','plan')
tap_label('Media',xml);xml=wait_for('Media studio','media')
tap_label('Money',xml);xml=wait_for('Your money','money')
tap_label('Inbox',xml);xml=wait_for('Message inbox','inbox')
tap_label('Plan',xml);wait_for('YOUR DAY AT A GLANCE','plan-return')
assert adb('shell','pidof','com.arun.one').strip(), 'App process exited'
logs=adb('logcat','-d','-s','AndroidRuntime:E','ReactNativeJS:E')
(out/'errors.log').write_text(logs)
assert 'FATAL EXCEPTION' not in logs and 'ReactNativeJS: Error:' not in logs, logs
print('PASS: installed, launched and opened Plan, Media, Money and Inbox; returned to Plan without fatal error.')
