import { useState } from 'react';
import { View } from 'react-native';
import { api, imageSource } from '@/lib/api';
import { Button, Notice } from './ui';
// Tách adapter web để SSR không import module thư viện ảnh chỉ có trên native.
export function ResultActions({ assetId }: { assetId: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function exportImage(save: boolean) {
    setBusy(true); setMessage('');
    try {
      await api('/me'); const source = imageSource(assetId);
      const response = await fetch(source.uri, { headers: source.headers }); if (!response.ok) throw new Error('Không tải được ảnh.');
      const blob = await response.blob(), file = new File([blob], `yofaso-${assetId}.png`, { type: 'image/png' });
      if (!save && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Phong cách của tôi tại YoFaSo' });
      else { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <View><Button title="Lưu ảnh kết quả" secondary disabled={busy} onPress={() => void exportImage(true)} /><Button title="Chia sẻ ảnh" secondary disabled={busy} onPress={() => void exportImage(false)} />{message && <Notice>{message}</Notice>}</View>;
}
