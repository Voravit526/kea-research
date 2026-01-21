/**
 * Image Compression Utility using Compressor.js
 */

declare const Compressor: any;

type ImageType = 'avatar' | 'background' | 'attachment';

interface CompressionPreset {
  maxDimension: number;
  quality: number;
}

const PRESETS: Record<ImageType, CompressionPreset> = {
  avatar: { maxDimension: 200, quality: 0.9 },
  background: { maxDimension: 1920, quality: 0.85 },
  attachment: { maxDimension: 2048, quality: 0.85 }
};

/**
 * Promise wrapper for Compressor.js callback API
 */
function compressImage(file: File, options: any): Promise<Blob> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      ...options,
      success(result: File | Blob) {
        resolve(result);
      },
      error(err: Error) {
        reject(err);
      }
    });
  });
}

export const ImageCompressor = {
  async compress(
    file: File,
    type: ImageType,
    customOptions: { quality?: number; maxWidthOrHeight?: number } = {}
  ): Promise<Blob> {
    const preset = PRESETS[type];
    let maxDim = customOptions.maxWidthOrHeight || preset.maxDimension;

    // Background: adjust for high-DPI displays
    if (type === 'background') {
      const pixelRatio = window.devicePixelRatio || 1;
      maxDim = pixelRatio > 1 ? 3840 : 1920;
    }

    const options = {
      maxWidth: maxDim,
      maxHeight: maxDim,
      quality: customOptions.quality ? customOptions.quality / 100 : preset.quality,
      checkOrientation: true,  // Auto-rotate based on EXIF
      mimeType: 'auto'         // Preserve original format
    };

    try {
      const compressed = await compressImage(file, options);
      return compressed instanceof Blob ? compressed : new Blob([compressed]);
    } catch (error) {
      console.error(`${type} compression error:`, error);
      throw error;
    }
  },

  // Legacy methods for backward compatibility
  async compressAvatar(file: File): Promise<Blob> {
    return this.compress(file, 'avatar');
  },
  async compressBackground(file: File): Promise<Blob> {
    return this.compress(file, 'background');
  },
  async compressAttachment(file: File, opts: { quality?: number; maxWidthOrHeight?: number } = {}): Promise<Blob> {
    return this.compress(file, 'attachment', opts);
  },

  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }
};

// Make it globally available
declare global {
  interface Window {
    ImageCompressor: typeof ImageCompressor;
  }
}

window.ImageCompressor = ImageCompressor;
