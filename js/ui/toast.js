/* =====================================================================
   ui/toast.js — the small message that pops up at the bottom
   ("Saved!", "Import failed..."). Usage: toast('Saved'), toast('Oops', 'error')
   ===================================================================== */
let timer;
export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 3200);
}
