import { useEffect, useState } from 'react'
import './ThemeToggle.css'

const PMS_THEMES = [
  { id: 'olive', name: 'Current Olive', accent: '#8b9d39', strong: '#566b17', page: '#f7faee', surface: '#ffffff', text: '#27331b', muted: '#687253', border: '#dbe5bf', sidebar: '#edf4dc' },
  { id: 'cobalt', name: 'Cobalt Blue', accent: '#3978e8', strong: '#1e4fae', page: '#f1f6ff', surface: '#ffffff', text: '#152b51', muted: '#607292', border: '#cfddf5', sidebar: '#e6efff' },
  { id: 'sapphire', name: 'Sapphire Blue', accent: '#168ed2', strong: '#075d9b', page: '#eef9ff', surface: '#ffffff', text: '#12324d', muted: '#5f7890', border: '#c8e5f5', sidebar: '#e0f3ff' },
  { id: 'ocean', name: 'Ocean Blue', accent: '#2b78d0', strong: '#154f97', page: '#f0f7ff', surface: '#ffffff', text: '#152c4d', muted: '#62758e', border: '#cfdef2', sidebar: '#e4efff' },
  { id: 'midnight', name: 'Midnight Navy', accent: '#4875a8', strong: '#203c67', page: '#edf3fb', surface: '#ffffff', text: '#14243b', muted: '#61738c', border: '#cdd9e9', sidebar: '#e1ebf8' },
  { id: 'graphite', name: 'Graphite Dark', accent: '#708096', strong: '#39485b', page: '#eef1f4', surface: '#ffffff', text: '#1f2937', muted: '#667383', border: '#d2d9e1', sidebar: '#e5e9ee' },
  { id: 'teal', name: 'Teal Breeze', accent: '#0bb5aa', strong: '#007d79', page: '#ecfbfa', surface: '#ffffff', text: '#123a4c', muted: '#5e7983', border: '#c5ebe7', sidebar: '#ddf6f3' },
  { id: 'forest', name: 'Forest Emerald', accent: '#20b866', strong: '#08743f', page: '#effbf4', surface: '#ffffff', text: '#173b2b', muted: '#5e7a69', border: '#c9ead7', sidebar: '#e1f6e9' },
  { id: 'amber', name: 'Golden Amber', accent: '#eaa817', strong: '#a86c00', page: '#fff9ed', surface: '#ffffff', text: '#453219', muted: '#806f4f', border: '#f1dfb1', sidebar: '#fff3d4' },
  { id: 'cinnamon', name: 'Warm Cinnamon', accent: '#ef7516', strong: '#b94708', page: '#fff5ed', surface: '#ffffff', text: '#482c1d', muted: '#806452', border: '#f2d1b7', sidebar: '#ffead8' },
  { id: 'bronze', name: 'Mocha Bronze', accent: '#b48b2b', strong: '#785817', page: '#fbf7ed', surface: '#ffffff', text: '#3d321f', muted: '#7a6e54', border: '#e7dcbf', sidebar: '#f3ebd6' },
  { id: 'crimson', name: 'Crimson Rose', accent: '#e84b69', strong: '#a92847', page: '#fff1f5', surface: '#ffffff', text: '#482232', muted: '#826174', border: '#f1cbd5', sidebar: '#ffe3ea' },
  { id: 'burgundy', name: 'Burgundy Wine', accent: '#b33f68', strong: '#76213e', page: '#fff2f6', surface: '#ffffff', text: '#432031', muted: '#806071', border: '#eccbd8', sidebar: '#fbe3eb' },
  { id: 'orchid', name: 'Orchid Plum', accent: '#a443d5', strong: '#70229e', page: '#faf1ff', surface: '#ffffff', text: '#382247', muted: '#766180', border: '#e5ccef', sidebar: '#f3e2fc' },
  { id: 'royal', name: 'Royal Purple', accent: '#7650c7', strong: '#4f2e96', page: '#f5f1ff', surface: '#ffffff', text: '#2f2550', muted: '#70668b', border: '#d9cef1', sidebar: '#ebe4fb' },
]

const STORAGE_KEY = 'pms-selected-theme'
const CUSTOM_COLOR_KEY = 'pms-custom-theme-color'

function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'teal'
}

function applyPmsTheme(themeId) {
  const theme = PMS_THEMES.find((item) => item.id === themeId) || PMS_THEMES[6]
  const root = document.documentElement
  root.dataset.pmsTheme = theme.id
  Object.entries({
    '--pms-accent': theme.accent,
    '--pms-accent-strong': theme.strong,
    '--pms-page-bg': theme.page,
    '--pms-surface': theme.surface,
    '--pms-text': theme.text,
    '--pms-muted': theme.muted,
    '--pms-border': theme.border,
    '--pms-sidebar': theme.sidebar,
    '--pms-gradient': `linear-gradient(135deg, ${theme.accent}, ${theme.strong})`,
    '--pms-page-gradient': `linear-gradient(135deg, ${theme.page} 0%, color-mix(in srgb, ${theme.accent} 10%, ${theme.page}) 52%, ${theme.sidebar} 100%)`,
  }).forEach(([key, value]) => root.style.setProperty(key, value))
}

function applyCustomPmsTheme(color) {
  const accent = /^#[0-9a-f]{6}$/i.test(color) ? color : '#0bb5aa'
  const numeric = Number.parseInt(accent.slice(1), 16)
  const dark = (channel) => Math.max(0, Math.round(channel * 0.62))
  const strong = `#${[16, 8, 0].map((shift) => dark((numeric >> shift) & 255).toString(16).padStart(2, '0')).join('')}`
  const root = document.documentElement
  root.dataset.pmsTheme = 'custom'
  Object.entries({
    '--pms-accent': accent,
    '--pms-accent-strong': strong,
    '--pms-page-bg': '#f7fbfb',
    '--pms-surface': '#ffffff',
    '--pms-text': '#183044',
    '--pms-muted': '#64798a',
    '--pms-border': `${accent}55`,
    '--pms-sidebar': `${accent}16`,
    '--pms-gradient': `linear-gradient(135deg, ${accent}, ${strong})`,
    '--pms-page-gradient': `linear-gradient(135deg, #f7fbfb 0%, color-mix(in srgb, ${accent} 10%, #f7fbfb) 52%, ${accent}16 100%)`,
  }).forEach(([key, value]) => root.style.setProperty(key, value))
}

function hueToHex(hue) {
  const channel = (offset) => {
    const value = (offset + hue / 60) % 6
    return Math.round(255 * (1 - Math.max(0, Math.min(value, 4 - value, 1)))).toString(16).padStart(2, '0')
  }
  return ('#' + channel(5) + channel(3) + channel(1)).toUpperCase()
}

function ThemeToggle() {
  const [open, setOpen] = useState(false)
  const [showCustomPicker, setShowCustomPicker] = useState(true)
  const [hue, setHue] = useState(185)
  const [appliedColor, setAppliedColor] = useState(() => localStorage.getItem(CUSTOM_COLOR_KEY) || '#0BB5AA')
  const [selected, setSelected] = useState(getStoredTheme)
  const [customColor, setCustomColor] = useState(() => localStorage.getItem(CUSTOM_COLOR_KEY) || '#0BB5AA')

  useEffect(() => {
    if (selected === 'custom') applyCustomPmsTheme(appliedColor)
    else applyPmsTheme(selected)
  }, [appliedColor, selected])

  function chooseTheme(themeId) {
    setSelected(themeId)
    localStorage.setItem(STORAGE_KEY, themeId)
    window.dispatchEvent(new CustomEvent('pms:theme-changed', { detail: { themeId } }))
  }

  function applyCustomTheme() {
    if (!/^#[0-9a-f]{6}$/i.test(customColor)) return
    const normalized = customColor.toUpperCase()
    setAppliedColor(normalized)
    setCustomColor(normalized)
    setSelected('custom')
    localStorage.setItem(CUSTOM_COLOR_KEY, normalized)
    localStorage.setItem(STORAGE_KEY, 'custom')
    window.dispatchEvent(new CustomEvent('pms:theme-changed', { detail: { themeId: 'custom', color: normalized } }))
  }

  return <div className="pms-theme-picker">
    <button className="pms-theme-trigger" type="button" aria-label="Choose theme colour" title="Choose theme colour" onClick={() => setOpen((value) => !value)}>
      <svg className="pms-theme-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="9.5" r="3.2" />
        <path d="M12 2v2M12 15v2M4.5 9.5h2M17.5 9.5h2M6.7 4.2l1.4 1.4M15.9 13.4l1.4 1.4M17.3 4.2l-1.4 1.4M8.1 13.4l-1.4 1.4M4 20c2.2-1.7 4.9-2.5 8-2.5s5.8.8 8 2.5" />
      </svg>
    </button>
    {open ? <div className="pms-theme-panel" role="dialog" aria-label="Choose a theme colour">
      <div className="pms-theme-panel-head"><div><strong>Pick a theme colour</strong><small>Choose a colourful palette for your application.</small></div><button type="button" aria-label="Close theme picker" onClick={() => setOpen(false)}>×</button></div>
      <div className="pms-theme-options">{PMS_THEMES.map((theme) => <button key={theme.id} type="button" className={`pms-theme-option${theme.id === selected ? ' is-selected' : ''}`} onClick={() => chooseTheme(theme.id)}><span style={{ background: `linear-gradient(135deg, ${theme.accent} 0 50%, ${theme.strong} 50%)` }} />{theme.name}{theme.id === selected ? <b>✓</b> : null}</button>)}
      <button className={`pms-theme-option pms-custom-option${selected === 'custom' ? ' is-selected' : ''}`} type="button" onClick={() => setShowCustomPicker(true)} aria-expanded={showCustomPicker}>
        <span style={{ background: /^#[0-9a-f]{6}$/i.test(customColor) ? customColor : '#0BB5AA' }}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 5 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg></span>Custom
      </button>
      </div>
      {showCustomPicker ? <section className="pms-custom-theme" aria-label="Custom colour picker">
        <header><strong>Colour picker</strong><button className="pms-custom-close" type="button" aria-label="Close colour picker" onClick={() => setShowCustomPicker(false)}>?</button></header>
        <input className="pms-hue-slider" aria-label="Colour hue" type="range" min="0" max="359" value={hue} onChange={(event) => { const next = Number(event.target.value); setHue(next); setCustomColor(hueToHex(next)) }} />
        <div><input aria-label="Choose custom theme colour" type="color" value={/^#[0-9a-f]{6}$/i.test(customColor) ? customColor : '#0BB5AA'} onChange={(event) => setCustomColor(event.target.value.toUpperCase())} /><input type="text" aria-label="Custom theme hex value" value={customColor} onChange={(event) => setCustomColor(event.target.value)} maxLength={7} aria-invalid={!/^#[0-9a-f]{6}$/i.test(customColor)} /><button type="button" onClick={applyCustomTheme} disabled={!/^#[0-9a-f]{6}$/i.test(customColor)}>Apply</button></div>
      </section> : null}
      <button className="pms-theme-done" type="button" onClick={() => setOpen(false)}>Done</button>
    </div> : null}
  </div>
}

export default ThemeToggle
