const S = (d, sw = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const TROPHY = (s = 1) => `<g transform="scale(${s})"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#ffd34d"/><path d="M7 5H4.5a2.5 3 0 0 0 3 4.5M17 5h2.5a2.5 3 0 0 1-3 4.5" stroke="#ffd34d" stroke-width="1.6" fill="none"/><rect x="11" y="13.5" width="2" height="3" fill="#ffd34d"/><rect x="8" y="16.5" width="8" height="2.5" rx="1" fill="#ffd34d"/><path d="M9.5 6.2v2.6" stroke="#fff6cc" stroke-width="1.2" stroke-linecap="round"/></g>`;

const ICONS = {
  logo: `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#1e88fa"/>${TROPHY()}</svg>`,
  home: S('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),
  menu: S('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  min: S('<path d="M6 12h12"/>', 2),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>', 2),
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  chev: S('<path d="M9 5l7 7-7 7"/>'),
  pause: S('<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>'),
  play: S('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>'),
  pin: S('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'),
  rotate: S('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/><circle cx="12" cy="12" r="2"/>'),
  full: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6"/>'),
  camera: S('<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/>'),
  rec: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="9" width="14" height="11" rx="2"/><path d="M16.5 13l5-3v9l-5-3"/><circle cx="6" cy="5.5" r="2.5"/><circle cx="12.5" cy="5.5" r="2.5"/><circle cx="9.5" cy="14.5" r="2" fill="#e53935" stroke="none"/></svg>`,
  pen: S('<path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/><path d="M3 22c3 0 4-2 7-2"/>'),
  folder: S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.3 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  help: S('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a3 3 0 0 1-3 2h-2"/>'),
  phone: S('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  pc: S('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'),
  sound: S('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  keys: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h2M11 9h2M15 9h2M7 13h10M7 16h10"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  q: S('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.3"/>'),

  wifiArt: `<svg viewBox="0 0 70 60"><path d="M22 18a18 18 0 0 1 26 0M26.5 23a11.5 11.5 0 0 1 17 0M31 28a5 5 0 0 1 8 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/><rect x="10" y="34" width="50" height="22" rx="3" fill="#fff"/><text x="35" y="50.5" text-anchor="middle" font-family="Segoe UI,Arial" font-weight="800" font-size="15" fill="#1e88fa">5G</text></svg>`,
  usbArt: `<svg viewBox="0 0 70 60"><rect x="4" y="8" width="44" height="32" rx="3" fill="#fff" opacity=".95"/><rect x="8" y="12" width="36" height="24" rx="1.5" fill="#dbe9ff"/><path d="M14 19h10a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h12" stroke="#5b7cff" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="20" y="40" width="12" height="6" fill="#fff" opacity=".9"/><rect x="14" y="46" width="24" height="3" rx="1.5" fill="#fff"/><rect x="50" y="22" width="15" height="27" rx="3" fill="#fff"/><rect x="52" y="25" width="11" height="19" rx="1" fill="#c7b8ff"/></svg>`,
  trophyArt: `<svg viewBox="0 0 150 150"><circle cx="100" cy="105" r="62" fill="#eef5ff"/><g transform="translate(46 40) scale(4.2)"><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#ffc83d"/><path d="M7 4h5v10a5 5 0 0 1-5-5z" fill="#ffd970"/><path d="M7 5H4.5a2.5 3 0 0 0 3 4.5M17 5h2.5a2.5 3 0 0 1-3 4.5" stroke="#f0a920" stroke-width="1.4" fill="none"/><rect x="11" y="13.5" width="2" height="3" fill="#e9a21c"/><rect x="8" y="16.5" width="8" height="2.6" rx="1" fill="#1e88fa"/></g><circle cx="40" cy="58" r="3" fill="#ffc83d"/><circle cx="128" cy="40" r="2.5" fill="#5b7cff"/><path d="M30 92l3 3m0-3-3 3" stroke="#1e88fa" stroke-width="1.6"/></svg>`,
  usbIllus: `<svg viewBox="0 0 250 200"><circle cx="125" cy="100" r="88" fill="#e9eef8"/><circle cx="196" cy="38" r="3" fill="#ff4f8b"/><circle cx="215" cy="70" r="3" fill="#1e88fa"/><circle cx="220" cy="98" r="7" fill="#7fb6ff"/><circle cx="28" cy="80" r="2.5" fill="#7fb6ff"/><circle cx="40" cy="128" r="4" fill="#1e88fa"/><circle cx="60" cy="58" r="5" fill="#dbe6f7"/><rect x="40" y="62" width="150" height="92" rx="5" fill="#fff" stroke="#1d3557" stroke-width="5"/><circle cx="52" cy="72" r="2" fill="#1e88fa"/><circle cx="59" cy="72" r="2" fill="#7fb6ff"/><rect x="52" y="82" width="58" height="40" rx="2" fill="#e3ebf8"/><path d="M60 116l14-16 10 10 7-6 12 12z" fill="#fff"/><rect x="118" y="82" width="62" height="8" rx="2" fill="#e3ebf8"/><rect x="118" y="96" width="62" height="5" rx="2" fill="#e3ebf8"/><rect x="118" y="106" width="50" height="5" rx="2" fill="#e3ebf8"/><rect x="52" y="130" width="120" height="5" rx="2" fill="#e3ebf8"/><path d="M28 154h190a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6z" fill="#1d3557"/><rect x="58" y="146" width="10" height="16" rx="2" fill="#1d3557"/><rect x="60" y="141" width="6" height="6" fill="#fff" stroke="#1d3557" stroke-width="1.5"/><path d="M63 162v12h122v-14" stroke="#1d3557" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/><rect x="165" y="92" width="40" height="70" rx="7" fill="#fff" stroke="#1d3557" stroke-width="4.5"/><rect x="171" y="100" width="28" height="22" rx="2" fill="#e3ebf8"/><rect x="171" y="128" width="28" height="4" rx="2" fill="#e3ebf8"/><rect x="171" y="136" width="20" height="4" rx="2" fill="#e3ebf8"/><rect x="178" y="152" width="14" height="3" rx="1.5" fill="#1d3557"/></svg>`
};

function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { const k = el.dataset.icon; if (ICONS[k]) el.innerHTML = ICONS[k]; });
}
