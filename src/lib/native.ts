import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();

// ─── Status Bar ────────────────────────────────────────────────────────────
export async function initStatusBar() {
  if (!isNative) return;
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
}

// ─── Back Button ───────────────────────────────────────────────────────────
export function initBackButton(onBack: () => void) {
  if (!isNative) return;
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) onBack();
    else App.exitApp();
  });
}

// ─── Camera / Document Scan ────────────────────────────────────────────────
export async function pickImageFromCamera(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 85,
  });
  if (!photo.dataUrl) return null;
  const res = await fetch(photo.dataUrl);
  const blob = await res.blob();
  return new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
}

export async function pickImageFromGallery(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    quality: 85,
  });
  if (!photo.dataUrl) return null;
  const res = await fetch(photo.dataUrl);
  const blob = await res.blob();
  return new File([blob], `doc_${Date.now()}.jpg`, { type: 'image/jpeg' });
}

// ─── Offline Storage (key-value) ───────────────────────────────────────────
export async function saveOffline(key: string, value: unknown) {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function loadOffline<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key });
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export async function removeOffline(key: string) {
  await Preferences.remove({ key });
}

// ─── File System (for saving PDFs locally) ─────────────────────────────────
export async function saveFileLocally(fileName: string, base64Data: string): Promise<string> {
  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return result.uri;
}

// ─── Push Notifications ────────────────────────────────────────────────────
export async function initPushNotifications(
  onToken: (token: string) => void,
  onNotification: (title: string, body: string) => void,
) {
  if (!isNative) return;

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    onToken(token.value);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    onNotification(notification.title ?? '', notification.body ?? '');
  });
}
