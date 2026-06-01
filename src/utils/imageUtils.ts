export const compressImage = (file: File, maxWidth = 2048, quality = 0.9): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        let srcWidth = img.width;
        let srcHeight = img.height;
        
        let offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = srcWidth;
        offscreenCanvas.height = srcHeight;
        const offscreenCtx = offscreenCanvas.getContext('2d');
        if (offscreenCtx) {
          offscreenCtx.drawImage(img, 0, 0);
          
          while (srcWidth * 0.5 > width) {
            srcWidth = Math.round(srcWidth * 0.5);
            srcHeight = Math.round(srcHeight * 0.5);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = srcWidth;
            tempCanvas.height = srcHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.imageSmoothingEnabled = true;
              tempCtx.imageSmoothingQuality = 'high';
              tempCtx.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width, offscreenCanvas.height, 0, 0, srcWidth, srcHeight);
              offscreenCanvas = tempCanvas;
            }
          }
        }

        ctx.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width, offscreenCanvas.height, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
};
