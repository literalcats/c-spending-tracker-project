/* =====================================================================
   views/index.js — the LIST of screens.
   TO ADD A NEW SCREEN: create js/views/yourview.js (copy a small one),
   import it here, and add it to the array. The menu and routing
   update automatically. No other file needs to change.
   ===================================================================== */
import dashboard from './dashboard.js';
import transactions from './transactions.js';
import budget from './budget.js';
import reports from './reports.js';
import data from './data.js';

export default [dashboard, transactions, budget, reports, data];
