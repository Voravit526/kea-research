/**
 * Image Compression Utility
 */

declare const imageCompression: any;

type ImageType = 'avatar' | 'background' | 'attachment';

interface CompressionPreset {
  maxSizeMB?: number;
  maxWidthOrHeight: number;
  initialQuality: number;
}

const PRESETS: Record<ImageType, CompressionPreset> = {
  avatar: { maxSizeMB: 0.5, maxWidthOrHeight: 200, initialQuality: 0.9 },
  background: { maxSizeMB: 2, maxWidthOrHeight: 1920, initialQuality: 0.85 },
  attachment: { maxWidthOrHeight: 2048, initialQuality: 0.85 }
};

export const ImageCompressor = {
  async compress(
    file: File,
    type: ImageType,
    customOptions: { quality?: number; maxWidthOrHeight?: number } = {}
  ): Promise<Blob> {
    const preset = PRESETS[type];
    let maxDim = customOptions.maxWidthOrHeight || preset.maxWidthOrHeight;

    // Background: adjust for high-DPI displays
    if (type === 'background') {
      const pixelRatio = window.devicePixelRatio || 1;
      maxDim = pixelRatio > 1 ? 3840 : 1920;
    }

    const options = {
      maxSizeMB: preset.maxSizeMB,
      maxWidthOrHeight: maxDim,
      useWebWorker: true,
      initialQuality: customOptions.quality ? customOptions.quality / 100 : preset.initialQuality
    };

    try {
      const compressed = await imageCompression(file, options);
      return new Blob([await compressed.arrayBuffer()], { type: compressed.type });
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
