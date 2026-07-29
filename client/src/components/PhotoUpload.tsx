import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { isVideoUrl } from '../types';
import { AuthenticatedImage, AuthenticatedVideo } from './AuthenticatedMedia';

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
}

// Fotograf yukleme + onizleme. URL'ler ust forma (attachments) aktarilir.
export function PhotoUpload({ value, onChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const selected = Array.from(files);
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
      if (inputRef.current) inputRef.current.value = '';
    }
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
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        📷 {busy ? t('common.uploading') : t('accidentForm.uploadPhotos')}
      </button>

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
