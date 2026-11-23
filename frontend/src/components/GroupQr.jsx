import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';
import { HiOutlineDownload, HiOutlineShare } from 'react-icons/hi';
import { useLanguage } from '../context/LanguageContext';

/**
 * Builds a shareable PNG "card": group name + QR + code.
 * Anyone who scans it lands on /join, signs up / logs in, and is added to the group straight away.
 */
async function buildCard({ url, title, subtitle, code }) {
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: 560, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });

  const W = 720;
  const H = 960;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(0, 0, W, 14);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  let name = title;
  while (ctx.measureText(name).width > W - 80 && name.length > 4) name = `${name.slice(0, -2)}…`;
  ctx.fillText(name, W / 2, 92);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(subtitle, W / 2, 138);

  ctx.drawImage(qr, (W - 560) / 2, 175, 560, 560);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 44px ui-monospace, SFMono-Regular, Consolas, monospace';
  ctx.fillText(code, W / 2, 815);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText('Scan with your phone camera to join on FairShare', W / 2, 870);
  ctx.fillText('or open the app → Join → enter the code', W / 2, 906);

  return c;
}

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export default function GroupQr({ url, roomName, code, groupType }) {
  const { t } = useLanguage();
  const [img, setImg] = useState('');
  const [card, setCard] = useState(null);

  const kind = groupType === 'trip' ? 'trip' : groupType === 'group' ? 'group' : 'flat';
  const fileName = `${(roomName || 'group').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'group'}-qr.png`;

  useEffect(() => {
    let alive = true;
    if (!url) return undefined;
    buildCard({ url, title: roomName, subtitle: `Join our ${kind} to split expenses`, code })
      .then((canvas) => {
        if (!alive) return;
        setCard(canvas);
        setImg(canvas.toDataURL('image/png'));
      })
      .catch(() => alive && setImg(''));
    return () => {
      alive = false;
    };
  }, [url, roomName, code, kind]);

  function download() {
    if (!img) return;
    const a = document.createElement('a');
    a.href = img;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!card) return;
    try {
      const blob = await toBlob(card);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: roomName, text: t('Scan to join "{name}" on FairShare', { name: roomName }) });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // user closed the share sheet
    }
    download();
    toast.success(t('QR saved — send the image to your friends'));
  }

  return (
    <div className="gq-wrap">
      <div className="gq-frame">
        {img ? <img src={img} alt={t('QR code to join {name}', { name: roomName })} /> : <span className="spinner" />}
      </div>
      <p className="muted text-xs gq-hint">{t('Friends scan this with their phone camera. They sign up (or log in) and join straight away.')}</p>
      <div className="rx-invite-actions">
        <button type="button" className="btn-ghost" onClick={share} disabled={!img}>
          <HiOutlineShare size={15} /> {t('Share QR')}
        </button>
        <button type="button" className="btn-ghost" onClick={download} disabled={!img}>
          <HiOutlineDownload size={15} /> {t('Download')}
        </button>
      </div>
    </div>
  );
}
