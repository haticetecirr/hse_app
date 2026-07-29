import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

/**
 * Korunan dosya ucu artik JWT istiyor. Duz <img src> / <video src> istekleri
 * Authorization basligi tasimadigi icin bu bilesenler dosyayi Axios (api)
 * uzerinden ceker.
 *
 * - Resimler: blob olarak indirilir, object URL ile gosterilir.
 * - Videolar: buyuk olabilecegi icin blob'a alinmaz; kisa sureli imzali
 *   (presigned) URL alinir, boylece tarayici Range istekleriyle sarabilir.
 */

const FILES_PREFIX = '/api/files/';

/**
 * URL korunan dosya ucuna mi ait? Degilse (or. eski "/uploads/..." kayitlari)
 * null doner ve bilesen URL'i oldugu gibi kullanir - mevcut davranis korunur.
 */
export function protectedFileKey(url: string): string | null {
  if (!url || !url.startsWith(FILES_PREFIX)) return null;
  const key = url.slice(FILES_PREFIX.length);
  if (!key || key.includes('/') || key.includes('\\')) return null;
  return key;
}

// ---------------------------------------------------------------------------
// PDF uretimi, korunan resimlerin yuklenmesini bekleyebilsin diye kucuk bir
// sayac. Zaman asimi cagiran tarafta; burada sonsuz bekleme olusmaz.
// ---------------------------------------------------------------------------
let pendingImages = 0;
let waiters: Array<() => void> = [];

function imageStarted() {
  pendingImages += 1;
}

function imageSettled() {
  pendingImages = Math.max(0, pendingImages - 1);
  if (pendingImages === 0 && waiters.length > 0) {
    const current = waiters;
    waiters = [];
    current.forEach((w) => w());
  }
}

/** Bekleyen korunan resim istegi kalmayana kadar (veya sure dolana kadar) bekler. */
export function whenProtectedImagesSettled(timeoutMs = 15000): Promise<void> {
  if (pendingImages === 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    waiters.push(finish);
    setTimeout(finish, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// AuthenticatedImage
// ---------------------------------------------------------------------------
interface ImageProps {
  url: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** Tiklaninca tam boyutu yeni sekmede acar (mevcut buyutme davranisi). */
  openOnClick?: boolean;
}

export function AuthenticatedImage({
  url,
  alt = '',
  className,
  style,
  openOnClick,
}: ImageProps) {
  const { t } = useTranslation();
  const fileKey = protectedFileKey(url);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Korunan uc degilse istek atma; URL dogrudan kullanilir.
    if (!fileKey) return;

    let cancelled = false;
    let created: string | null = null;

    setObjectUrl(null);
    setFailed(false);
    imageStarted();

    api
      .get(`/files/${encodeURIComponent(fileKey)}`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return; // unmount olduysa object URL hic olusturulmaz
        created = URL.createObjectURL(res.data as Blob);
        setObjectUrl(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(imageSettled);

    return () => {
      cancelled = true;
      // URL veya bilesen degistiginde onceki object URL serbest birakilir.
      if (created) URL.revokeObjectURL(created);
    };
  }, [fileKey]);

  const placeholder = (text: string) => (
    <div
      className={className}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        color: 'var(--muted)',
        fontSize: 11,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );

  if (!fileKey) {
    return <img src={url} alt={alt} className={className} style={style} />;
  }
  if (failed) return placeholder(t('common.noData'));
  if (!objectUrl) return placeholder(t('common.loading'));

  const img = <img src={objectUrl} alt={alt} className={className} style={style} />;

  if (openOnClick) {
    return (
      <a href={objectUrl} target="_blank" rel="noreferrer">
        {img}
      </a>
    );
  }
  return img;
}

// ---------------------------------------------------------------------------
// AuthenticatedVideo
// ---------------------------------------------------------------------------
interface VideoProps {
  url: string;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}

// Imzali URL suresi dolarsa yenilenebilir; ancak bu araliktan sik istek
// yapilmaz (sonsuz yenileme dongusunu onler).
const REFRESH_THROTTLE_MS = 10000;

export function AuthenticatedVideo({
  url,
  controls,
  muted,
  className,
  style,
}: VideoProps) {
  const { t } = useTranslation();
  const fileKey = protectedFileKey(url);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const lastFetchRef = useRef(0);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!fileKey) return;
    lastFetchRef.current = Date.now();
    try {
      const { data } = await api.get<{ url: string; expiresIn: number }>(
        `/files/${encodeURIComponent(fileKey)}/access-url`,
      );
      if (!mountedRef.current) return;
      setSrc(data.url); // imzali URL loglanmaz
      setFailed(false);
    } catch {
      if (mountedRef.current) setFailed(true);
    }
  }, [fileKey]);

  useEffect(() => {
    mountedRef.current = true;
    setSrc(null);
    setFailed(false);
    if (fileKey) void load();
    return () => {
      mountedRef.current = false;
    };
  }, [fileKey, load]);

  // Sure dolmus olabilir -> kontrollu tek yenileme denemesi.
  function handleError() {
    if (Date.now() - lastFetchRef.current < REFRESH_THROTTLE_MS) {
      setFailed(true);
      return;
    }
    void load();
  }

  if (!fileKey) {
    return (
      <video
        src={url}
        controls={controls}
        muted={muted}
        className={className}
        style={style}
      />
    );
  }

  if (failed || !src) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: 'var(--muted)',
          fontSize: 11,
        }}
      >
        {failed ? t('common.noData') : t('common.loading')}
      </div>
    );
  }

  return (
    <video
      src={src}
      controls={controls}
      muted={muted}
      className={className}
      style={style}
      onError={handleError}
    />
  );
}
