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

    // All attachment features are disabled (Coming Soon)
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
    let processedFile = file;

    if (type === 'image' && this.compressImages && file.type.startsWith('image/')) {
      try {
        console.log(`Compressing image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        const compressedBlob = await ImageCompressor.compressAttachment(file, this.compressionOptions);
        processedFile = new File([compressedBlob], file.name, { type: compressedBlob.type });
        console.log(`Compressed to: ${(processedFile.size / 1024).toFixed(1)} KB`);
      } catch (error) {
        console.error('Image compression failed, using original:', error);
      }
    }

    this.attachments.push({ type, file: processedFile, name: file.name });
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
    let preview = document.getElementById('attachmentPreview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'attachmentPreview';
      preview.className = 'd-flex flex-wrap gap-2 mt-2';
      const wrapper = document.getElementById('chatInputWrapper');
      if (wrapper) {
        wrapper.after(preview);
      }
    }

    preview.innerHTML = this.attachments.map((att, index) => {
      let icon: string, label: string;
      switch (att.type) {
        case 'image':
          icon = '<i class="bi bi-image text-success"></i>';
          label = att.name || 'Image';
          break;
        case 'file':
          icon = '<i class="bi bi-files text-kea"></i>';
          label = att.name || 'File';
          break;
        case 'youtube':
          icon = '<i class="bi bi-youtube text-danger"></i>';
          label = 'YouTube';
          break;
        case 'wikipedia':
          icon = '<i class="bi bi-wikipedia text-body-secondary"></i>';
          label = 'Wikipedia';
          break;
        default:
          icon = '<i class="bi bi-file"></i>';
          label = 'Attachment';
      }
      return `<span class="badge bg-body-secondary text-body d-flex align-items-center gap-1">
        ${icon} <span class="text-truncate" style="max-width: 100px;">${label}</span>
        <button type="button" class="btn-close btn-close-sm ms-1" data-index="${index}" aria-label="Remove"></button>
      </span>`;
    }).join('');

    preview.querySelectorAll('.btn-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.index || '0');
        this.attachments.splice(index, 1);
        this.updateAttachmentPreview();
      });
    });

    if (this.attachments.length === 0 && preview) {
      preview.remove();
    }
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

  clearAttachments(): void {
    this.attachments = [];
    const preview = document.getElementById('attachmentPreview');
    if (preview) preview.remove();
  }
};

// Make it globally available
declare global {
  interface Window {
    AttachmentManager: typeof AttachmentManager;
  }
}

window.AttachmentManager = AttachmentManager;
