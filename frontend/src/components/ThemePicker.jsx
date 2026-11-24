import { HiCheck, HiOutlineDesktopComputer, HiOutlineMoon, HiOutlineSun } from 'react-icons/hi';
import { ACCENTS, useTheme } from '../context/ThemeContext';

const MODES = [
  { id: 'light', label: 'Light', icon: HiOutlineSun },
  { id: 'dark', label: 'Dark', icon: HiOutlineMoon },
  { id: 'system', label: 'System', icon: HiOutlineDesktopComputer },
];

/** Appearance settings: light / dark / follow the device, and the app colour. */
export default function ThemePicker() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <section className="tp-card" aria-labelledby="tp-title">
      <div className="tp-head">
        <h3 id="tp-title">Appearance</h3>
        <small className="muted">Saved on this device</small>
      </div>

      <div className="tp-modes" role="radiogroup" aria-label="Light or dark">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            className={`tp-mode sc-press ${mode === id ? 'on' : ''}`}
            onClick={() => setMode(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      <div className="tp-accents" role="radiogroup" aria-label="App colour">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={accent === a.id}
            className={`tp-accent sc-press ${accent === a.id ? 'on' : ''}`}
            onClick={() => setAccent(a.id)}
            style={{ '--sw': a.swatch }}
          >
            <span className="tp-swatch" aria-hidden="true">
              <span className="tp-swatch-bar" />
              <span className="tp-swatch-dot">{accent === a.id && <HiCheck size={14} />}</span>
            </span>
            <span className="tp-name">{a.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
