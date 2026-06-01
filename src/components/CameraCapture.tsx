import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [focusCoords, setFocusCoords] = useState<{ x: number; y: number } | null>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const focusTimeoutRef = useRef<any>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleTouchFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || loading || error) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFocusCoords({ x, y });
    setIsFocusing(true);

    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      setIsFocusing(false);
    }, 1000);

    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as any;
        
        if (capabilities.focusMode && capabilities.focusMode.includes('single-shot')) {
          await track.applyConstraints({
            advanced: [{ focusMode: 'single-shot' } as any]
          });
          
          setTimeout(async () => {
            if (track && streamRef.current) {
              try {
                await track.applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as any]
                });
              } catch (e) {
                // Ignore silent errors
              }
            }
          }, 1500);
        }
      }
    } catch (err) {
      console.warn("Autofocus failed:", err);
    }
  };

  const startStream = async (deviceId?: string) => {
    setLoading(true);
    setError(null);
    stopStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { 
              deviceId: { exact: deviceId },
              width: { ideal: 3840 },
              height: { ideal: 2160 }
            }
          : { 
              facingMode: { ideal: 'environment' },
              width: { ideal: 3840 },
              height: { ideal: 2160 }
            },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError("Failed to access camera. Please check your permissions.");
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get all available cameras
    const initCameras = async () => {
      try {
        // Request initial permission to enumerate cameras properly
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        // Immediately close the temporary stream to unlock the camera hardware!
        tempStream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Filter back cameras first
        const backCameras = videoDevices.filter(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('0')
        );
        const sortedDevices = backCameras.length > 0 
          ? [...backCameras, ...videoDevices.filter(d => !backCameras.includes(d))]
          : videoDevices;

        setCameras(sortedDevices);
        
        if (sortedDevices.length > 0) {
          startStream(sortedDevices[0].deviceId);
        } else {
          startStream();
        }
      } catch (err) {
        console.warn("Permission denied or enumeration failed, trying default stream", err);
        startStream();
      }
    };

    initCameras();

    return () => {
      stopStream();
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    };
  }, []);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    startStream(cameras[nextIndex].deviceId);
  };

  const takePhoto = () => {
    if (!videoRef.current || loading || error) return;

    // Trigger flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        } else {
          alert("Capture failed: Could not generate image blob.");
        }
      }, 'image/jpeg', 0.9);
    }
  };

  return (
    <div className="camera-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff'
    }}>
      {/* Flash effect overlay */}
      {isFlashing && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#fff',
          zIndex: 10000,
          opacity: 0.9,
          pointerEvents: 'none'
        }} />
      )}

      {/* Video Viewport */}
      <div 
        onClick={handleTouchFocus}
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        <style>{`
          @keyframes focus-ring-pulse {
            0% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1); opacity: 1; border-color: #ffcc00; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; border-color: #ffffff; }
          }
        `}</style>

        {isFocusing && focusCoords && (
          <div style={{
            position: 'absolute',
            left: `${focusCoords.x}px`,
            top: `${focusCoords.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            border: '2px dashed #ffcc00',
            borderRadius: '50%',
            zIndex: 15,
            pointerEvents: 'none',
            animation: 'focus-ring-pulse 0.4s ease-out forwards'
          }} />
        )}

        {loading && (
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="loader" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)' }}></div>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Initializing lens...</span>
          </div>
        )}

        {error ? (
          <div style={{ position: 'absolute', padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--error-color)', marginBottom: '16px' }}>{error}</p>
            <button 
              onClick={() => startStream(cameras[currentCameraIndex]?.deviceId)}
              style={{
                background: 'var(--primary-color)',
                border: 'none',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        )}

        {/* Top Control Bar */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <button
            onClick={onClose}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            <X size={20} />
          </button>

          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)'
              }}
            >
              <RotateCw size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div style={{
        width: '100%',
        height: '120px',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '20px'
      }}>
        {/* Shutter Button Container */}
        <button
          onClick={takePhoto}
          disabled={loading || !!error}
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading || error ? 'not-allowed' : 'pointer',
            opacity: loading || error ? 0.5 : 1,
            outline: 'none',
            padding: 0
          }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '4px solid #000',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Camera size={28} color="#000" />
          </div>
        </button>
      </div>
    </div>
  );
};
