import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineCamera, HiOutlineX } from 'react-icons/hi';
import { useLanguage } from '../context/LanguageContext';

/** Shrink a photo so receipts stay small (max 1280px, JPEG). Returns a data URL. */
async function compress(file, maxSide = 1280, quality = 0.75) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Friendly "Add photo" button with preview; value is a data URL ('' when empty). */
export default function PhotoPicker({ value, onChange, label = 'Bill photo', optional = true }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error(t('Please pick an image'));
    if (file.size > 15 * 1024 * 1024) return toast.error(t('That image is too large'));
    setBusy(true);
    try {
      let data = await compress(file);
      if (data.length > 1900000) data = await compress(file, 900, 0.6);
      onChange(data);
    } catch {
      toast.error(t('Could not read that image'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-photo">
      <span className="px-photo-label">
        {t(label)} {optional && <small className="muted">{t('(optional)')}</small>}
      </span>
      {value ? (
        <div className="px-photo-preview">
          <img src={value} alt={t('Selected receipt')} />
          <div className="px-photo-meta">
            <strong>{t('Photo added')}</strong>
            <button type="button" className="rx-link" onClick={() => inputRef.current?.click()}>
              {t('Change')}
            </button>
          </div>
          <button type="button" className="px-photo-remove" onClick={() => onChange('')} aria-label={t('Remove photo')}>
            <HiOutlineX size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="px-photo-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <span className="spinner" /> : <HiOutlineCamera size={20} />}
          <span>{busy ? t('Preparing photo…') : t('Add a photo of the bill')}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}
