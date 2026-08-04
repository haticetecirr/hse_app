import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { isVideoUrl } from '../types';
import { AuthenticatedImage, AuthenticatedVideo } from './AuthenticatedMedia';
import { CameraCapture, CaptureMode } from './CameraCapture';

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
}

// Sunucudaki sinirlarla ayni tutulmali (uploads.controller.ts).
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// Fotograf yukleme + onizleme. URL'ler ust forma (attachments) aktarilir.
export function PhotoUpload({ value, onChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);

  // Bu oturumda secilen dosyalarin YEREL onizlemeleri: sunucu URL'i -> object URL.
  // Yeni yuklenen dosya henuz bir bildirime bagli olmadigi icin korunan
  // /api/files ucu 404 doner; bu yuzden onizleme yerel dosyadan uretilir.
  // Sunucu URL'i (value) forma gonderilmek uzere degistirilmeden korunur.
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef(localPreviews);
  previewsRef.current = localPreviews;

  // Unmount'ta kalan tum object URL'ler serbest birakilir.
  useEffect(
    () => () => {
      Object.values(previewsRef.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  // Yukleme akisinin TEK yeri. Hem dosya secici hem kamera bunu kullanir.
  async function uploadFiles(selected: File[]) {
    if (selected.length === 0) return;

    // Boyut kontrolu (sunucu tarafinda da ayni sinirlar uygulanir).
    const tooBig = selected.find((f) =>
      f.type.startsWith('video/')
        ? f.size > MAX_VIDEO_BYTES
        : f.size > MAX_IMAGE_BYTES,
    );
    if (tooBig) {
      const isVideo = tooBig.type.startsWith('video/');
      setError(
        t('accidentForm.fileTooLarge', {
          name: tooBig.name,
          limit: Math.round(
            (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES) / (1024 * 1024),
          ),
        }),
      );
      return;
    }

    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      selected.forEach((f) => fd.append('files', f));
      const { data } = await api.post<{ urls: string[] }>('/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Sunucu URL'leri dosyalarla ayni sirada doner; her birini kendi
      // yerel object URL'i ile eslestir.
      const created: Record<string, string> = {};
      data.urls.forEach((serverUrl, i) => {
        const file = selected[i];
        if (file) created[serverUrl] = URL.createObjectURL(file);
      });
      setLocalPreviews((prev) => ({ ...prev, ...created }));

      onChange([...value, ...data.urls]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  }

  // Kameradan gelen dosya da ayni yukleme akisina girer.
  async function onCaptured(file: File) {
    setCaptureMode(null);
    await uploadFiles([file]);
  }

  function remove(url: string) {
    const objectUrl = previewsRef.current[url];
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setLocalPreviews((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        {t('accidentForm.photoHelp')}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={onFiles}
        style={{ display: 'none' }}
      />
      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setCaptureMode('photo')}
          disabled={busy}
        >
          📷 {t('accidentForm.takePhoto')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setCaptureMode('video')}
          disabled={busy}
        >
          🎥 {t('accidentForm.takeVideo')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          📁 {busy ? t('common.uploading') : t('accidentForm.chooseFile')}
        </button>
      </div>

      {captureMode && (
        <CameraCapture
          mode={captureMode}
          onCancel={() => setCaptureMode(null)}
          onConfirm={onCaptured}
        />
      )}

      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 12,
          }}
        >
          {value.map((url) => (
            <div
              key={url}
              style={{
                position: 'relative',
                width: 100,
                height: 100,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}
            >
              {/* Bu oturumda secilen dosya -> yerel object URL ile onizleme.
                  Daha once kaydedilmis ek -> korunan uc uzerinden gosterim. */}
              {localPreviews[url] ? (
                isVideoUrl(url) ? (
                  <video
                    src={localPreviews[url]}
                    controls
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={localPreviews[url]}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )
              ) : isVideoUrl(url) ? (
                <AuthenticatedVideo
                  url={url}
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <AuthenticatedImage
                  url={url}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                title={t('accidentForm.removeInjury')}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: 'rgba(220,38,38,0.9)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  width: 22,
                  height: 22,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
