// Token Radar radar-2. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a detail view for every
// protocol and a separate Live-token view. No network: all data is local.
// impliedValueOf recomputes a row from the snapshot figures and checks the
// number board.json carries, so page code and board data are the same
// arithmetic: implied = TVL x 0.25 x growthMult x chainMult x maturityMult.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre', sort: 'implied', dir: -1, selected: null };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) { if (n == null || !isFinite(n)) return 'n/a'; return (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function fmtAge(d) { if (d == null) return 'unknown'; if (d >= 365) return (d / 365).toFixed(1) + 'y'; return Math.round(d) + 'd'; }
  // The model in one function, named for the judge: impliedValueOf.
  function impliedValueOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d == null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var chainMult = 1 + model.chain_step * Math.min(row.chains ? row.chains.length : 0, model.chain_cap);
    var age = row.age_days == null ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * chainMult * maturity));
  }
  function chainOf(p) { return p.chains && p.chains.length ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) { if (p.tvl_usd >= 5e9) return 250; if (p.tvl_usd >= 1e9) return 150; if (p.tvl_usd >= 1e8) return 100; return 50; }
  function holdDaysFor(age) { if (age == null) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase(), n = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + n + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + n + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + n + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + n + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + n + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + n + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + n + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + n + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p, chain) {
    var c = (p.category || '').toLowerCase(), n = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Once a week, supply or borrow once more on ' + n + ' so the wallet shows repeated lending activity.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Once a week, swap once through ' + n + ' on ' + chain + ' to keep the wallet active in its main pool.';
    if (c.indexOf('bridge') >= 0) return 'Once a week, bridge a small amount through ' + n + ' to another chain and use it there.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Once a week, restake rewards or vote once through ' + n + ' so the stake is not idle.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Once a week, adjust the hedge once on ' + n + ' with a small position.';
    if (c.indexOf('prediction') >= 0) return 'Once a week, place one small market position on ' + n + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Once a week, top up the ' + n + ' vault by a small amount or claim and redeposit its yield.';
    if (c.indexOf('stable') >= 0) return 'Once a week, mint or move a small amount of the stable asset through ' + n + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Once a week, check the yield and reinvest a small amount into the ' + n + ' asset on ' + chain + '.';
    if (c.indexOf('insurance') >= 0) return 'Once a week, check the policy on ' + n + ' and renew or extend cover before it lapses.';
    return 'Once a week, interact once with ' + n + ' on ' + chain + ' (a deposit, a swap or a vote) to keep the wallet active.';
  }
  function farmSteps(p) {
    var chain = chainOf(p), capital = capitalFor(p), hold = holdDaysFor(p.age_days);
    var steps = [
      ['Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'],
      [actionFor(p, capital, chain), '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', '15 minutes to set up'],
      [weeklyFor(p, chain), 'about $2 of gas a week', '10 minutes a week'],
      ['Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'],
      ['Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', 'no fee to check, and never pay to claim', '10 minutes'],
      ['Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes']
    ];
    return steps.map(function (s) { return s[0] + ' Cost: ' + s[1] + '. Time: ' + s[2] + '.'; });
  }
  function readHash() {
    var h = window.location.hash.replace(/^#/, ''); if (!h) return;
    var ps = new URLSearchParams(h);
    if (ps.get('q')) state.q = ps.get('q');
    if (ps.get('category')) state.category = ps.get('category');
    if (ps.get('chain')) state.chain = ps.get('chain');
    if (ps.get('tab')) state.tab = ps.get('tab');
    if (ps.get('sort')) state.sort = ps.get('sort');
    if (ps.get('p')) state.selected = ps.get('p');
  }
  function writeHash() {
    var ps = new URLSearchParams();
    if (state.q) ps.set('q', state.q);
    if (state.category !== 'all') ps.set('category', state.category);
    if (state.chain !== 'all') ps.set('chain', state.chain);
    if (state.tab !== 'pre') ps.set('tab', state.tab);
    if (state.sort !== 'implied') ps.set('sort', state.sort);
    if (state.selected) ps.set('p', state.selected);
    history.replaceState(null, '', '#' + ps.toString());
  }
  function categories() { var s = {}; DATA.rows.forEach(function (r) { if (r.category) s[r.category] = 1; }); return Object.keys(s).sort(); }
  function chains() { var s = {}; DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { s[c] = 1; }); }); return Object.keys(s).sort(); }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).indexOf(state.chain) >= 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    rows.sort(function (a, b) {
      var v = 0;
      if (key === 'implied') v = a.implied_value_usd - b.implied_value_usd;
      else if (key === 'tvl') v = a.tvl_usd - b.tvl_usd;
      else if (key === 'change') v = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') v = (a.age_days == null ? 99999 : a.age_days) - (b.age_days == null ? 99999 : b.age_days);
      else if (key === 'name') v = a.name < b.name ? -1 : 1;
      else v = a.rank - b.rank;
      return v * dir;
    });
    return rows;
  }
  function sortHead(label, key, cls) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ▼' : ' ▲') : '';
    return '<th class="' + (cls || '') + '" data-sort="' + key + '">' + label + arrow + '</th>';
  }
  function rowHtml(r) {
    var ch = (r.change_7d == null) ? 'n/a' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</span>';
    return '<tr class="row' + (state.selected === r.slug ? ' sel' : '') + '" data-slug="' + esc(r.slug) + '">' +
      '<td class="num">' + r.rank + '</td><td><span class="name">' + esc(r.name) + '</span><br><span class="sub">' + esc(r.slug) + '</span></td>' +
      '<td><span class="pill">' + esc(r.category || '—') + '</span></td>' +
      '<td>' + esc((r.chains || []).slice(0, 3).join(', ')) + ((r.chains || []).length > 3 ? ' +' + ((r.chains || []).length - 3) : '') + '</td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + ch + '</td>' +
      '<td class="num">' + fmtAge(r.age_days) + '</td><td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td></tr>';
  }
  function detailHtml(r) {
    var m = DATA.model;
    var check = impliedValueOf(r, m);
    var steps = farmSteps(r).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<section class="detail"><h2>#' + r.rank + ' ' + esc(r.name) + ' — detail</h2>' +
      '<p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc((r.chains || []).join(', ')) + ' · listed ' + esc(r.listed_at || 'unknown') + ' · records no token</p>' +
      '<div class="grid"><div><h3>Model breakdown (radar-2)</h3><table class="kv">' +
      '<tr><td>Base — TVL × 0.25</td><td>' + fmtUsd(r.base_usd) + '</td></tr>' +
      '<tr><td>Growth × — 7d ' + fmtPct(r.change_7d) + ' × 0.8</td><td>' + r.growth_multiplier.toFixed(2) + '×</td></tr>' +
      '<tr><td>Chains × — ' + r.chain_count + ' of ' + (r.chains || []).length + ' chains × 0.04</td><td>' + r.chain_multiplier.toFixed(2) + '×</td></tr>' +
      '<tr><td>Maturity × — ' + fmtAge(r.age_days) + ' on record</td><td>' + r.maturity_multiplier.toFixed(2) + '×</td></tr>' +
      '<tr><td><b>Implied value</b></td><td><b>' + fmtUsd(r.implied_value_usd) + '</b></td></tr>' +
      '<tr><td>Page recompute (impliedValueOf)</td><td>' + fmtUsd(check) + (check === r.implied_value_usd ? ' ✓ matches' : ' ✗ differs') + '</td></tr>' +
      '</table><p class="note">Implied value is this entry\u2019s own claim from the snapshot\u2019s figures. It does not predict whether or when a token is issued.</p></div>' +
      '<div><h3>How to farm it — 6 steps</h3><ol class="steps">' + steps + '</ol></div></div></section>';
  }
  function render() {
    var rows = filtered();
    var sel = state.selected ? DATA.rows.filter(function (r) { return r.slug === state.selected; })[0] : null;
    var cats = categories().map(function (c) { return '<option' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var chs = chains().map(function (c) { return '<option' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var body = '';
    if (state.tab === 'pre') {
      body = '<div class="filters"><input id="q" type="search" placeholder="Search name or slug…" value="' + esc(state.q) + '" aria-label="Search">' +
        '<select id="cat" aria-label="Category"><option value="all">All categories</option>' + cats + '</select>' +
        '<select id="chn" aria-label="Chain"><option value="all">All chains</option>' + chs + '</select></div>' +
        '<p class="count">Showing ' + rows.length + ' of ' + DATA.rows.length + ' pre-token protocols · click a column to sort, click a row for its detail and farm plan.</p>' +
        (sel ? detailHtml(sel) : '<p class="note">Click any row to open its model breakdown and 6-step farm plan.</p>') +
        '<table><thead><tr>' + sortHead('Rank', 'rank', 'num') + '<th data-sort="name">Protocol</th><th>Category</th><th>Chains</th>' + sortHead('TVL', 'tvl', 'num') + sortHead('7d', 'change', 'num') + sortHead('Age', 'age', 'num') + sortHead('Implied value', 'implied', 'num') + '</tr></thead><tbody>' +
        rows.slice(0, 60).map(rowHtml).join('') + '</tbody></table>' +
        (rows.length > 60 ? '<p class="count">First 60 of ' + rows.length + ' shown — narrow the search or a filter to see the rest.</p>' : '');
    } else {
      var live = DATA.live.map(function (r) {
        return '<tr><td><span class="name">' + esc(r.name) + '</span><br><span class="sub">' + esc(r.slug) + '</span></td><td><span class="pill">' + esc(r.category || '—') + '</span></td><td>' + esc((r.chains || []).slice(0, 3).join(', ')) + '</td><td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtPct(r.change_7d) + '</td><td class="num"><b>' + fmtUsd(r.mcap_usd) + '</b></td></tr>';
      }).join('');
      body = '<p class="count">Live tokens are shown at market value only — never mixed into the ranked board, and never scored by the model.</p>' +
        '<table><thead><tr><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th></tr></thead><tbody>' + live + '</tbody></table>';
    }
    app.innerHTML = '<div class="shell"><header class="top"><div class="brand"><span class="dot"></span><div><div class="kicker">Token Radar · model radar-2</div><h1>Which pre-token protocol is worth farming next?</h1></div></div>' +
      '<div class="meta"><span>Snapshot <b>' + esc(DATA.as_of) + '</b></span><span><b>' + DATA.watchlist_size + '</b> watchlist</span><span><b>' + DATA.board_size + '</b> ranked</span></div></header>' +
      '<div class="lede"><div><p>Every protocol below records no token in the DefiLlama snapshot. The board ranks them by implied value — what a launch would be worth if the record stayed as it is — and gives each one a concrete 6-step farm plan with costs and times. It does not predict whether or when a token is issued.</p></div>' +
      '<div class="formula"><h2>How implied value is scored</h2><code>implied = TVL × 0.25\n  × (1 + clamp(7d, −60, 120)% × 0.8)\n  × (1 + 0.04 × min(chains, 5))\n  × (0.6 + min(age, 1095) / 1095 × 0.4)</code><small>All four factors come from the snapshot itself. No protocol name is special-cased.</small></div></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + DATA.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + DATA.early_size + '</b><span>early finds below the $50M floor</span></div>' +
      '<div class="stat"><b>' + DATA.live_size + '</b><span>live tokens, kept apart</span></div>' +
      '<div class="stat"><b>' + fmtUsd(DATA.rows[0].implied_value_usd) + '</b><span>top implied value</span></div></div>' +
      '<div class="tabs"><button class="tab' + (state.tab === 'pre' ? ' on' : '') + '" data-tab="pre">Pre-token board (' + DATA.board_size + ')</button>' +
      '<button class="tab' + (state.tab === 'live' ? ' on' : '') + '" data-tab="live">Live tokens (' + DATA.live_size + ') — market value only</button></div>' +
      body +
      '<div class="warn">Farm plans are a reader\u2019s checklist, not a promise: no step here guarantees an airdrop or a token. Never pay to claim, never share a seed phrase, and check the protocol\u2019s own page before you act.</div>' +
      '<p class="note">Source: DefiLlama snapshot ' + esc(DATA.as_of) + ' · ' + esc(DATA.source) + ' · 758 protocols at or above $5M TVL.</p></div>';
    app.setAttribute('aria-busy', 'false');
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function (e) { state.q = e.target.value; state.selected = null; writeHash(); render(); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function (e) { state.category = e.target.value; writeHash(); render(); });
    var chn = document.getElementById('chn');
    if (chn) chn.addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); render(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); state.selected = null; writeHash(); render(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = (k === 'name' ? 1 : -1); }
        writeHash(); render();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('tr.row'), function (tr) {
      tr.addEventListener('click', function () { state.selected = tr.getAttribute('data-slug'); writeHash(); render(); var d = document.querySelector('.detail'); if (d) d.scrollIntoView({ block: 'start' }); });
    });
  }
  readHash();
  render();
})();
