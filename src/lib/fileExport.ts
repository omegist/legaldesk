import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function safeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'document.pdf';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not prepare the file for Android.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const separator = result.indexOf(',');
      if (separator < 0) reject(new Error('Could not prepare the file for Android.'));
      else resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Download in a browser, or hand a real cached file to Android's share/open chooser. */
export async function deliverFile(blob: Blob, fileName: string, dialogTitle = 'Open or save file') {
  const safeName = safeFileName(fileName);

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: `vakildesk/${safeName}`,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: safeName,
      url: uri,
      dialogTitle,
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
