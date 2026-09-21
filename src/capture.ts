// Typed native boundary. No credentials or bank PINs are requested by this application.
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { Message } from './model';
export interface CaptureStatus { smsPermission: boolean; receivePermission: boolean; smsEnabled: boolean; notificationsEnabled: boolean; notificationAccess: boolean }
interface Bridge {
  status(): Promise<CaptureStatus>;
  setEnabled(kind: string, value: boolean): Promise<void>;
  scanSms(since: number): Promise<number>;
  events(after: number): Promise<Message[]>;
  openNotificationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  openPaymentApp(name: string): Promise<void>;
}
export const native = NativeModules.FinanceCapture as Bridge | undefined;
export async function allowSms() {
  if (!native || Platform.OS !== 'android') throw new Error('Install the Android APK to import messages. Expo Go cannot read SMS.');
  const grants = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.READ_SMS, PermissionsAndroid.PERMISSIONS.RECEIVE_SMS]);
  if (grants[PermissionsAndroid.PERMISSIONS.READ_SMS] !== 'granted') throw new Error('SMS permission was declined. Enable it in Android app settings to import.');
  await native.setEnabled('sms', true);
}
