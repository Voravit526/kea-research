/**
 * Type definitions for external libraries loaded via CDN
 */

// Bootstrap Modal
declare namespace bootstrap {
  class Modal {
    constructor(element: Element, options?: Partial<Modal.Options>);
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Modal | null;
    static getOrCreateInstance(element: Element): Modal;
  }

  namespace Modal {
    interface Options {
      backdrop: boolean | 'static';
      keyboard: boolean;
      focus: boolean;
    }
  }

  class Toast {
    constructor(element: Element, options?: Partial<Toast.Options>);
    show(): void;
    hide(): void;
    dispose(): void;
    static getInstance(element: Element): Toast | null;
    static getOrCreateInstance(element: Element): Toast;
  }

  namespace Toast {
    interface Options {
      animation: boolean;
      autohide: boolean;
      delay: number;
    }
  }

  class Tooltip {
    constructor(element: Element, options?: Partial<Tooltip.Options>);
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Tooltip | null;
  }

  namespace Tooltip {
    interface Options {
      title: string;
      placement: 'top' | 'bottom' | 'left' | 'right';
      trigger: string;
    }
  }
}

// Image Compression Library
interface ImageCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  exifOrientation?: number;
  fileType?: string;
}

declare function imageCompression(
  file: File,
  options: ImageCompressionOptions
): Promise<Blob>;

declare namespace imageCompression {
  function getExifOrientation(file: File): Promise<number>;
  function drawImageInCanvas(img: HTMLImageElement): HTMLCanvasElement;
}
