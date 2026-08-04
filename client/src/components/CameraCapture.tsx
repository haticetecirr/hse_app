import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Cihaz kamerasindan fotograf/video yakalama modali.
 *
 * - Tek bir MediaStream tutulur; yeni akis acilmadan once eskisi kapatilir.
 * - Modal kapandiginda / unmount'ta tum track'ler stop() edilir.
 * - Onizleme icin uretilen object URL'ler revokeObjectURL ile serbest birakilir.
 * - Sonuc, mevcut yukleme akisina verilmek uzere DOGRU UZANTILI bir File olur
 *   (StorageService uzantiyi originalname'den aliyor, frontend de video/foto
 *   ayrimini uzantiya gore yapiyor).
 */

export type CaptureMode = 'photo' | 'video';

interface Props {
  mode: CaptureMode;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

// Kamera ile cekilen videolar icin ust sinir.
const MAX_RECORD_SECONDS = 60;

// Tarayicinin destekledigi ilk kayit formatini sec.
function pickRecorderMime(): { recorderMime: string; fileMime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: { recorderMime: string; fileMime: string; ext: string }[] = [
    { recorderMime: 'video/webm;codecs=vp9,opus', fileMime: 'video/webm', ext: 'webm' },
    { recorderMime: 'video/webm;codecs=vp8,opus', fileMime: 'video/webm', ext: 'webm' },
    { recorderMime: 'video/webm', fileMime: 'video/webm', ext: 'webm' },
    { recorderMime: 'video/mp4', fileMime: 'video/mp4', ext: 'mp4' },
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder.isTypeSupported !== 'function' ||
      MediaRecorder.isTypeSupported(c.recorderMime)
    ) {
      return c;
    }
  }
  return null;
}

export function CameraCapture({ mode, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment',
  );
  const [canSwitch, setCanSwitch] = useState(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captured, setCaptured] = useState<File | null>(null);

  // --- yardimcilar ---------------------------------------------------------
  const stopStream = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* yoksay */
      }
    }
    recorderRef.current = null;

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Kamera/mikrofon isigi sonmeli: tum track'ler kapatilir.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setCaptured(null);
  }, []);

  const startStream = useCallback(async () => {
    setError('');
    setStarting(true);

    // Guvenli baglam kontrolu (getUserMedia HTTPS veya localhost ister).
    if (!window.isSecureContext) {
      setError(t('camera.insecureContext'));
      setStarting(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('camera.notSupported'));
      setStarting(false);
      return;
    }

    // Ayni anda birden fazla akis olmasin.
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: mode === 'video',
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Birden fazla kamera varsa on/arka gecisi sun.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanSwitch(
          devices.filter((d) => d.kind === 'videoinput').length > 1,
        );
      } catch {
        setCanSwitch(false);
      }
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError(t('camera.permissionDenied'));
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError(t('camera.noCamera'));
      } else {
        setError(t('camera.genericError'));
      }
    } finally {
      setStarting(false);
    }
  }, [facingMode, mode, stopStream, t]);

  // Acilista ve kamera degisiminde akisi baslat; onizleme varken baslatma.
  useEffect(() => {
    if (captured) return;
    void startStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, captured]);

  // Unmount: kamera/mikrofon kapansin, object URL serbest kalsin.
  useEffect(
    () => () => {
      stopStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    },
    [stopStream],
  );

  function setPreviewFromFile(file: File) {
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCaptured(file);
  }

  // --- fotograf ------------------------------------------------------------
  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError(t('camera.genericError'));
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(t('camera.genericError'));
          return;
        }
        // Uzanti sart: MinIO key'i ve img/video ayrimi buna bagli.
        const file = new File([blob], `kamera-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        stopStream();
        setPreviewFromFile(file);
      },
      'image/jpeg',
      0.92,
    );
  }

  // --- video ---------------------------------------------------------------
  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const picked = pickRecorderMime();
    if (!picked) {
      setError(t('camera.recorderNotSupported'));
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: picked.recorderMime,
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Dosya tipi codec eki OLMADAN yazilir; backend allowlist'i tam
        // eslesme bekliyor (or. "video/webm").
        const blob = new Blob(chunksRef.current, { type: picked.fileMime });
        chunksRef.current = [];
        const file = new File([blob], `kamera-${Date.now()}.${picked.ext}`, {
          type: picked.fileMime,
        });
        stopStream();
        setRecording(false);
        setPreviewFromFile(file);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);

      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch {
      setError(t('camera.recorderNotSupported'));
    }
  }

  function stopRecording() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // onstop icinde dosya olusturulur
    }
  }

  function retake() {
    clearPreview();
    setElapsed(0);
    // captured null olunca useEffect akisi yeniden baslatir.
  }

  function close() {
    stopStream();
    clearPreview();
    onCancel();
  }

  function confirm() {
    if (!captured) return;
    stopStream();
    onConfirm(captured);
    // Object URL'i parent'a vermiyoruz; burada serbest birakilir.
    clearPreview();
  }

  const title = mode === 'photo' ? t('camera.photoTitle') : t('camera.videoTitle');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 16,
      }}
      onClick={close}
    >
      <div
        className="card"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-between">
          <div className="card-title" style={{ marginBottom: 0 }}>
            {title}
          </div>
          {recording && (
            <span className="badge badge-danger">
              ● {t('camera.recording')} {elapsed}/{MAX_RECORD_SECONDS}s
            </span>
          )}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
            aspectRatio: '4 / 3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {previewUrl ? (
            mode === 'photo' ? (
              <img
                src={previewUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <video
                src={previewUrl}
                controls
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        {starting && !error && (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {t('camera.starting')}
          </div>
        )}

        <div className="flex gap-8 mt-16" style={{ flexWrap: 'wrap' }}>
          {previewUrl ? (
            <>
              <button type="button" className="btn" onClick={confirm}>
                {t('camera.use')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={retake}
              >
                {t('camera.retake')}
              </button>
            </>
          ) : (
            <>
              {mode === 'photo' ? (
                <button
                  type="button"
                  className="btn"
                  onClick={takePhoto}
                  disabled={starting || !!error}
                >
                  📷 {t('camera.capture')}
                </button>
              ) : recording ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={stopRecording}
                >
                  ⏹ {t('camera.stopRecording')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={startRecording}
                  disabled={starting || !!error}
                >
                  ⏺ {t('camera.startRecording')}
                </button>
              )}

              {canSwitch && !recording && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setFacingMode((f) =>
                      f === 'environment' ? 'user' : 'environment',
                    )
                  }
                  disabled={starting}
                >
                  🔄 {t('camera.switchCamera')}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={close}
            style={{ marginLeft: 'auto' }}
          >
            {t('common.cancel')}
          </button>
        </div>

        {mode === 'video' && !previewUrl && (
          <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
            {t('camera.maxDuration')}
          </div>
        )}
      </div>
    </div>
  );
}
