// Small shared helpers. No dependencies.

// HTML-escape untrusted text before interpolating into innerHTML.
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// "3 min ago" / "2 h ago" / "5 d ago" from an ISO string. Deterministic given now.
export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function fmtSnapshot(iso) {
  try {
    return (
      new Date(iso).toLocaleString('en-US', {
        month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      }) + ' UTC'
    );
  } catch { return String(iso); }
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export const prefersReducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
