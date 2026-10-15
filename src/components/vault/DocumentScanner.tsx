import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Plus, Check, X, Loader2, ChevronLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentScannerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the final merged PDF file when the user taps Done. */
  onScanComplete: (file: File) => Promise<void>;
  /** Optional error handler (e.g. show a toast in the parent). */
  onError?: (message: string) => void;
}

type ScanStep = 'preview' | 'captured';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Captures the current video frame onto a canvas and returns a JPEG data URL. */
function captureFrame(video: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Converts an array of JPEG data-URLs into a single PDF Blob (A4 pages). */
function imagesToPdf(dataUrls: string[]): Blob {
  // A4 at 96 DPI: 794 × 1123 px
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  dataUrls.forEach((url, idx) => {
    if (idx > 0) pdf.addPage();
    // Fit image into A4, preserving aspect ratio
    const img = new Image();
    img.src = url;
    // jsPDF accepts dataUrls directly via addImage
    pdf.addImage(url, 'JPEG', 0, 0, pageW, pageH);
  });

  return pdf.output('blob');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentScanner({ open, onClose, onScanComplete, onError }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<ScanStep>('preview');
  const [pages, setPages] = useState<string[]>([]); // data URLs of captured pages
  const [currentCapture, setCurrentCapture] = useState<string>(''); // last captured image
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // The preview video is conditionally rendered. On a second scan, React
  // creates a new video element, so explicitly reattach the existing stream.
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && streamRef.current) {
      element.srcObject = streamRef.current;
      // When returning from the captured-image view the stream already has
      // metadata. In that case `loadedmetadata` may not fire again.
      setCameraReady(element.readyState >= HTMLMediaElement.HAVE_METADATA);
      void element.play().catch(() => undefined);
    }
  }, []);

  // ─── Camera lifecycle ──────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported on this browser. Please use Chrome or Safari on a mobile device.');
      return;
    }

    try {
      // Prefer rear camera on mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
          void videoRef.current?.play().catch(() => undefined);
        };
        if (videoRef.current.readyState >= HTMLMediaElement.HAVE_METADATA) {
          setCameraReady(true);
        }
      }
    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Camera permission was denied. Please allow camera access in your browser settings.'
        : 'Could not start the camera. Please check your device settings.';
      setCameraError(msg);
      onError?.(msg);
    }
  }, [onError]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (open) {
      setPages([]);
      setCurrentCapture('');
      setStep('preview');
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCapture = () => {
    if (!videoRef.current || !cameraReady) return;
    const dataUrl = captureFrame(videoRef.current);
    setCurrentCapture(dataUrl);
    setStep('captured');
  };

  const handleRetake = () => {
    setCurrentCapture('');
    setStep('preview');
  };

  const handleAddPage = () => {
    setPages((prev) => [...prev, currentCapture]);
    setCurrentCapture('');
    setCameraReady(false);
    setStep('preview');
  };

  const handleDone = async () => {
    // Include the current capture if user didn't tap "Add page" before "Done"
    const allPages = currentCapture ? [...pages, currentCapture] : pages;
    if (allPages.length === 0) {
      onError?.('No pages scanned yet. Please capture at least one page.');
      return;
    }

    setIsMerging(true);
    try {
      const pdfBlob = imagesToPdf(allPages);
      const fileName = `scan_${new Date().toISOString().slice(0, 10)}_${allPages.length}pg.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      await onScanComplete(file);
      onClose();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not create or upload the PDF. Please try again.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setPages([]);
    setCurrentCapture('');
    setStep('preview');
    onClose();
  };

  // ─── Page count helpers ────────────────────────────────────────────────────

  const totalPagesIfDone = currentCapture ? pages.length + 1 : pages.length;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
        <button onClick={handleClose} className="flex items-center gap-1 text-white/80 hover:text-white text-sm">
          <ChevronLeft className="h-5 w-5" />
          Cancel
        </button>
        <div className="text-center">
          <p className="text-white font-medium text-sm">Scan Document</p>
          <p className="text-white/60 text-xs">
            {pages.length === 0 ? 'Position document in frame' : `${pages.length} page${pages.length !== 1 ? 's' : ''} captured`}
          </p>
        </div>
        {totalPagesIfDone > 0 ? (
          <Button
            size="sm"
            onClick={handleDone}
            disabled={isMerging}
            className="gold-gradient text-black font-semibold text-xs px-3 h-8"
          >
            {isMerging ? <Loader2 className="h-3 w-3 animate-spin" /> : `Done (${totalPagesIfDone})`}
          </Button>
        ) : (
          <div className="w-16" /> /* spacer */
        )}
      </div>

      {/* ── Main area ── */}
      <div className="relative flex-1 overflow-hidden">

        {/* Live camera preview */}
        {step === 'preview' && (
          <>
            <video
              ref={setVideoElement}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-3 text-white/60">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Starting camera…</p>
                </div>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
                <div className="text-center space-y-4">
                  <Camera className="h-12 w-12 text-white/30 mx-auto" />
                  <p className="text-white/70 text-sm">{cameraError}</p>
                  <Button variant="outline" onClick={startCamera} className="border-white/30 text-white">
                    Try Again
                  </Button>
                </div>
              </div>
            )}
            {/* Document framing guide */}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="border-2 border-yellow-400/70 rounded-lg"
                  style={{ width: '85%', height: '75%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
                />
              </div>
            )}
          </>
        )}

        {/* Captured image preview */}
        {step === 'captured' && currentCapture && (
          <img
            src={currentCapture}
            alt="Captured page"
            className="h-full w-full object-contain bg-black"
          />
        )}
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="bg-black/90 backdrop-blur-sm px-6 py-5">

        {step === 'preview' ? (
          <div className="flex items-center justify-center gap-8">
            {/* Page thumbnails */}
            {pages.length > 0 && (
              <div className="flex gap-1">
                {pages.slice(-3).map((pg, i) => (
                  <div
                    key={i}
                    className="h-10 w-8 rounded overflow-hidden border border-white/20 bg-white/5"
                  >
                    <img src={pg} alt={`Page ${pages.length - (pages.slice(-3).length - 1 - i)}`} className="h-full w-full object-cover" />
                  </div>
                ))}
                {pages.length > 3 && (
                  <div className="h-10 w-8 rounded border border-white/20 bg-white/10 flex items-center justify-center">
                    <span className="text-white/60 text-[9px]">+{pages.length - 3}</span>
                  </div>
                )}
              </div>
            )}

            {/* Capture button */}
            <button
              onClick={handleCapture}
              disabled={!cameraReady}
              className={cn(
                'h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95',
                !cameraReady && 'opacity-30 cursor-not-allowed',
              )}
            >
              <div className="h-12 w-12 rounded-full bg-white" />
            </button>

            {/* Spacer to balance layout */}
            <div className="w-16" />
          </div>
        ) : (
          /* After capture: Retake / Add Page / Done */
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              className="flex-1 border-white/30 text-white bg-transparent hover:bg-white/10"
              onClick={handleRetake}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/30 text-white bg-transparent hover:bg-white/10"
              onClick={handleAddPage}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Page
            </Button>
            <Button
              className="flex-1 gold-gradient text-black font-semibold"
              onClick={handleDone}
              disabled={isMerging}
            >
              {isMerging
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Check className="mr-2 h-4 w-4" />Done</>}
            </Button>
          </div>
        )}

        {/* Instruction hint */}
        <p className="text-center text-white/40 text-xs mt-3">
          {step === 'preview'
            ? 'Position document within the guide and tap the circle to capture'
            : 'Add more pages or tap Done to save the scanned document'}
        </p>
      </div>
    </div>
  );
}

