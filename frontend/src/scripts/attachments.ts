/**
 * Attachment Manager
 */

import { StorageUtils } from './storage';
import { ImageCompressor } from './image';

declare function t(key: string, vars?: Record<string, string | number>): string;

interface Attachment {
  type: 'image' | 'file' | 'youtube' | 'wikipedia';
  file?: File;
  url?: string;
  name?: string;
}

export const AttachmentManager = {
  attachments: [] as Attachment[],
  useSearch: false,
  useDatabase: false,
  compressImages: true,
  compressionOptions: { quality: 85, maxWidthOrHeight: 2048 },

  async init(): Promise<void> {
    const settings = await StorageUtils.getSettings();
    this.compressImages = settings.compressAttachedImages;
    this.compressionOptions = {
      quality: settings.compressionQuality,
      maxWidthOrHeight: settings.compressionMaxDimension
    };

    const compressToggle = document.getElementById('compressAttachedImagesToggle') as HTMLInputElement | null;
    if (compressToggle) {
      compressToggle.addEventListener('change', (e) => {
        this.compressImages = (e.target as HTMLInputElement).checked;
      });
    }

    const qualitySlider = document.getElementById('compressionQuality') as HTMLInputElement | null;
    if (qualitySlider) {
      qualitySlider.addEventListener('input', (e) => {
        this.compressionOptions.quality = parseInt((e.target as HTMLInputElement).value);
      });
    }

    const dimensionSlider = document.getElementById('compressionMaxDimension') as HTMLInputElement | null;
    if (dimensionSlider) {
      dimensionSlider.addEventListener('input', (e) => {
        this.compressionOptions.maxWidthOrHeight = parseInt((e.target as HTMLInputElement).value);
      });
    }

    // === Wire up image attachment button ===
    const attachImageBtn = document.getElementById('attachImage');
    const imageInput = document.getElementById('imageInput') as HTMLInputElement | null;

    if (attachImageBtn && imageInput) {
      // Click button -> trigger file input
      attachImageBtn.addEventListener('click', () => {
        imageInput.click();
      });

      // File input change -> process selected files
      imageInput.addEventListener('change', async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            await this.addAttachment('image', file);
          } else {
            console.warn(`Skipping non-image file: ${file.name}`);
          }
        }

        // Reset input to allow selecting same file again
        imageInput.value = '';
      });
    }

    console.log('AttachmentManager initialized (images enabled)');
  },

  updateIndicator(): void {
    const plusIcon = document.querySelector('#chatInputWrapper .dropdown .btn i');
    if (!plusIcon) return;

    if (this.useDatabase && this.useSearch) {
      plusIcon.className = 'bi bi-stars fs-5 text-kea';
    } else if (this.useDatabase) {
      plusIcon.className = 'bi bi-database fs-5 text-info';
    } else if (this.useSearch) {
      plusIcon.className = 'bi bi-search fs-5 text-warning';
    } else {
      plusIcon.className = 'bi bi-plus-circle fs-5';
    }
  },

  async addAttachment(type: 'image' | 'file', file: File): Promise<void> {
    // Validate image type
    if (type === 'image') {
      const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!SUPPORTED_TYPES.includes(file.type)) {
        alert(`Unsupported image format: ${file.type}. Please use JPEG, PNG, WebP, or GIF.`);
        return;
      }

      // Check file size (max 10MB before compression)
      const MAX_SIZE_BYTES = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
        alert(`Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`);
        return;
      }

      // Limit: 5 images per message (Claude's limit)
      const MAX_IMAGES = 5;
      const currentImageCount = this.attachments.filter((att) => att.type === 'image').length;
      if (currentImageCount >= MAX_IMAGES) {
        alert(`Maximum ${MAX_IMAGES} images per message. Please remove some images first.`);
        return;
      }
    }

    let processedFile = file;

    // Compress image if enabled
    if (type === 'image' && this.compressImages && file.type.startsWith('image/')) {
      try {
        console.log(`Compressing: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

        const compressedBlob = await ImageCompressor.compressAttachment(
          file,
          this.compressionOptions
        );

        // Only use compressed if it's actually smaller
        if (compressedBlob.size < file.size) {
          processedFile = new File([compressedBlob], file.name, { type: compressedBlob.type });
          console.log(
            `Compressed: ${file.name} - ${(file.size / 1024).toFixed(1)}KB → ${(processedFile.size / 1024).toFixed(1)}KB`
          );
        } else {
          console.warn(`Compression increased size for ${file.name}, using original`);
        }
      } catch (error) {
        console.error('Compression failed, using original:', error);
        // Continue with original file
      }
    }

    // Add to attachments array
    this.attachments.push({
      type,
      file: processedFile,
      name: file.name,
    });

    // Update UI preview
    this.updateAttachmentPreview();
  },

  addYoutubeLink(url: string): void {
    this.attachments.push({ type: 'youtube', url });
    this.updateAttachmentPreview();
  },

  addWikipediaLink(url: string): void {
    this.attachments.push({ type: 'wikipedia', url });
    this.updateAttachmentPreview();
  },

  updateAttachmentPreview(): void {
    const previewContainer = document.getElementById('attachmentPreview');
    if (!previewContainer) return;

    if (this.attachments.length === 0) {
      previewContainer.innerHTML = '';
      previewContainer.classList.add('d-none');
      return;
    }

    previewContainer.classList.remove('d-none');

    const previewHTML = this.attachments
      .map((att, index) => {
        let icon = '<i class="bi bi-paperclip"></i>';
        let preview = '';

        // Show thumbnail for images
        if (att.type === 'image' && att.file) {
          const imgUrl = URL.createObjectURL(att.file);
          preview = `
            <img
              src="${imgUrl}"
              class="img-thumbnail me-2 attachment-preview-thumbnail"
              alt="${att.name}"
            >
          `;

          // Clean up object URL after a delay
          setTimeout(() => URL.revokeObjectURL(imgUrl), 60000);
        } else {
          preview = icon;
        }

        return `
          <div class="d-inline-flex align-items-center rounded px-2 py-1 me-2 mb-2 attachment-preview-item">
            ${preview}
            <span class="small me-2 text-body">${att.name}</span>
            <button
              type="button"
              class="btn-close attachment-preview-close"
              aria-label="Remove"
              data-attachment-index="${index}"
            ></button>
          </div>
        `;
      })
      .join('');

    previewContainer.innerHTML = previewHTML;

    // Wire up remove buttons
    previewContainer.querySelectorAll('.btn-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const index = parseInt(target.dataset.attachmentIndex || '0', 10);
        this.removeAttachment(index);
      });
    });
  },

  removeAttachment(index: number): void {
    this.attachments.splice(index, 1);
    this.updateAttachmentPreview();
  },

  /**
   * Convert image file to base64 data URL
   * @param file Image file
   * @returns Promise resolving to base64 data URL (e.g., "data:image/jpeg;base64,...")
   */
  async convertImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader result is not a string'));
        }
      };

      reader.onerror = () => {
        reject(reader.error || new Error('FileReader error'));
      };

      reader.readAsDataURL(file);
    });
  },

  showYoutubeModal(): void {
    const url = prompt(t('js.enterYoutubeUrl'));
    if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      this.addYoutubeLink(url);
    } else if (url) {
      alert(t('js.invalidYoutubeUrl'));
    }
  },

  showWikipediaModal(): void {
    const url = prompt(t('js.enterWikipediaUrl'));
    if (url && url.includes('wikipedia.org')) {
      this.addWikipediaLink(url);
    } else if (url) {
      alert(t('js.invalidWikipediaUrl'));
    }
  },

  /**
   * Clear all attachments (called after message is sent)
   */
  clearAttachments(): void {
    this.attachments = [];
    this.updateAttachmentPreview();
  }
};

// Make it globally available
declare global {
  interface Window {
    AttachmentManager: typeof AttachmentManager;
  }
}

window.AttachmentManager = AttachmentManager;
