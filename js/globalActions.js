/* =====================================================================
   globalActions.js — actions that work on EVERY screen (the + button,
   theme switch, install button, month arrows). Screen-specific actions
   live inside their own file in views/.
   An element triggers one of these with  data-click="name"  or
   data-change="name". main.js turns these tables into lookup Maps.
   ===================================================================== */
import { getState, saveSetting, setMonth } from './store.js';
import { shiftMonth } from './calc.js';
import { promptInstall } from './ui/install.js';
import { openTxDialog } from './ui/txDialog.js';

export const globalClick = {
  'add-tx': () => openTxDialog(),
  'toggle-theme': () => saveSetting('theme', getState().settings.theme === 'dark' ? 'light' : 'dark'),
  'install': () => promptInstall(),
  'month-prev': () => setMonth(shiftMonth(getState().month, -1)),
  'month-next': () => setMonth(shiftMonth(getState().month, 1)),
};

export const globalChange = {
  'set-month': (el) => el.value && setMonth(el.value),
};
