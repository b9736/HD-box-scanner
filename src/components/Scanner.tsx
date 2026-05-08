import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera } from 'lucide-react';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
  onTapToFocus?: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanSuccess, onScanFailure }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(() => {
    const saved = localStorage.getItem('preferred_camera_index');
    return saved ? parseInt(saved, 10) : 0;
  });
  const regionId = "qr-reader-region";

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Scanner stop error:", err);
      }
    }
  };

  const startScanner = async (cameraIdOrFacingMode: string | { facingMode: string }) => {
    try {
      await stopScanner();
      
      const element = document.getElementById(regionId);
      if (!element) return;

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(regionId, {
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
      }
      
      const config = { 
        fps: 30, 
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.9);
          return { width: size, height: size };
        },
        aspectRatio: undefined,
        videoConstraints: typeof cameraIdOrFacingMode === 'string' ? {
          deviceId: { exact: cameraIdOrFacingMode },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        } : {
          facingMode: "environment",
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        }
      };

      await scannerRef.current.start(
        cameraIdOrFacingMode,
        config,
        onScanSuccess,
        onScanFailure
      );

      // Apply constraints
      setTimeout(async () => {
        if (scannerRef.current) {
          try {
            const track = (scannerRef.current as any).getRunningTrack() as MediaStreamTrack;
            if (track) {
              const capabilities = track.getCapabilities() as any;
              const constraints: any = { advanced: [] };

              if (capabilities.focusMode?.includes('continuous')) {
                constraints.advanced.push({ focusMode: 'continuous' });
              }
              
              if (capabilities.zoom) {
                const idealZoom = Math.min(2.0, capabilities.zoom.max);
                constraints.advanced.push({ zoom: idealZoom });
              }

              if (constraints.advanced.length > 0) {
                await track.applyConstraints(constraints);
              }
            }
          } catch (e) {
            console.warn("Failed to apply advanced constraints:", e);
          }
        }
      }, 1000);
    } catch (err) {
      console.error("Scanner start error:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        // Filter for back cameras if possible, otherwise take all
        const backCameras = devices.filter(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('0'));
        const availableCameras = backCameras.length > 0 ? backCameras : devices;
        
        setCameras(availableCameras);
        
        if (availableCameras.length > 0) {
          // Use the saved index if valid, otherwise fallback to 0
          const indexToUse = currentCameraIndex < availableCameras.length ? currentCameraIndex : 0;
          startScanner(availableCameras[indexToUse].id);
        } else {
          startScanner({ facingMode: "environment" });
        }
      } catch (err) {
        console.error("Failed to get cameras", err);
        startScanner({ facingMode: "environment" });
      }
    };

    init();

    return () => {
      stopScanner();
    };
  }, []);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    localStorage.setItem('preferred_camera_index', nextIndex.toString());
    startScanner(cameras[nextIndex].id);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id={regionId} style={{ width: '100%', height: '100%' }}></div>
      
      {cameras.length > 1 && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            switchCamera();
          }}
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          <Camera size={18} />
          <span>Lens {currentCameraIndex + 1}</span>
        </button>
      )}
    </div>
  );
};

export default Scanner;
