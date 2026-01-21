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

// Compressor.js - Image Compression Library
interface CompressorOptions {
  strict?: boolean;
  checkOrientation?: boolean;
  retainExif?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  width?: number;
  height?: number;
  resize?: 'none' | 'contain' | 'cover';
  quality?: number;
  mimeType?: string;
  convertTypes?: string | string[];
  convertSize?: number;
  beforeDraw?(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
  drew?(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
  success?(result: File | Blob): void;
  error?(error: Error): void;
}

declare class Compressor {
  constructor(file: File | Blob, options?: CompressorOptions);
  abort(): void;
  static noConflict(): typeof Compressor;
  static setDefaults(options: CompressorOptions): void;
}
