/* =====================================================================
   garden-v4.js  -  Part 3 add-on: Sorting + Hash Table
   Load AFTER script.js:   <script src="garden-v4.js"></script>
   Does not modify script.js. It watches the garden grid and reacts to
   plant / water / harvest, then shows an "Inventory" panel with:
     - Inventory tab   : Insertion Sort or Merge Sort, by weight/value/growth
     - Leaderboard tab : Merge Sort (stable) on seasonal scores
     - Hash Table tab  : plants keyed by tile index, chaining, rehashing
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     SPECIES TABLE (game-design numbers, edit freely)
     w = base weight kg, v = base coin value, sun = sunlight hours needed
     ------------------------------------------------------------------ */
  var SPECIES = {
    maize:     { w: 1.2, v: 15, sun: 6 },
    tomato:    { w: 0.4, v: 22, sun: 8 },
    wheat:     { w: 0.8, v: 8,  sun: 6 },
    carrot:    { w: 0.3, v: 10, sun: 5 },
    pumpkin:   { w: 5.0, v: 60, sun: 7 },
    sunflower: { w: 0.6, v: 18, sun: 9 }
  };
  var DEFAULT_SPECIES = { w: 1, v: 12, sun: 6 };

  function speciesInfo(label) {
    var n = (label || '').toLowerCase();
    for (var k in SPECIES) {
      if (n.indexOf(k) !== -1) {
        return { name: k.charAt(0).toUpperCase() + k.slice(1), w: SPECIES[k].w, v: SPECIES[k].v, sun: SPECIES[k].sun };
      }
    }
    var clean = (label || 'Crop').replace(/[^\w\s-]/g, '').trim() || 'Crop';
    return { name: clean, w: DEFAULT_SPECIES.w, v: DEFAULT_SPECIES.v, sun: DEFAULT_SPECIES.sun };
  }

  /* ------------------------------------------------------------------
     SORTING
     ------------------------------------------------------------------ */
  // Basic: Insertion Sort. Stable, in place on a copy. ~O(n) if nearly sorted.
  function insertionSort(arr, key, desc, stats) {
    var a = arr.slice();
    for (var i = 1; i < a.length; i++) {
      var cur = a[i], j = i - 1;
      while (j >= 0) {
        stats.cmp++;
        var outOfOrder = desc ? key(a[j]) < key(cur) : key(a[j]) > key(cur);
        if (!outOfOrder) break;
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = cur;
    }
    return a;
  }

  // Advanced: Merge Sort. O(n log n) always, stable (ties keep left item first).
  function mergeSort(arr, key, desc, stats) {
    if (arr.length <= 1) return arr.slice();
    var mid = arr.length >> 1;
    var L = mergeSort(arr.slice(0, mid), key, desc, stats);
    var R = mergeSort(arr.slice(mid), key, desc, stats);
    var out = [], i = 0, j = 0;
    while (i < L.length && j < R.length) {
      stats.cmp++;
      var takeLeft = desc ? key(L[i]) >= key(R[j]) : key(L[i]) <= key(R[j]);
      out.push(takeLeft ? L[i++] : R[j++]);
    }
    while (i < L.length) out.push(L[i++]);
    while (j < R.length) out.push(R[j++]);
    return out;
  }

  /* ------------------------------------------------------------------
     HASH TABLE: separate chaining + rehashing
     key = tile index (0..n), value = plant record
     ------------------------------------------------------------------ */
  function isPrime(n) {
    if (n < 2) return false;
    for (var i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function nextPrime(n) { while (!isPrime(n)) n++; return n; }

  function GardenHashTable(size) {
    this.size = nextPrime(size || 7);
    this.count = 0;
    this.rehashes = 0;
    this.MAX_LOAD = 0.75;
    this.buckets = this._empty(this.size);
  }
  GardenHashTable.prototype._empty = function (n) {
    var b = [];
    for (var i = 0; i < n; i++) b.push([]);
    return b;
  };
  // Multiplicative hash so neighbouring tiles do not simply land in
  // neighbouring buckets (this is what makes collisions visible).
  GardenHashTable.prototype._index = function (key) {
    return ((key * 2654435761) >>> 0) % this.size;
  };
  GardenHashTable.prototype.loadFactor = function () { return this.count / this.size; };
  GardenHashTable.prototype.put = function (key, rec) {
    var bucket = this.buckets[this._index(key)];
    for (var i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) { bucket[i][1] = rec; return; }
    }
    bucket.push([key, rec]);
    this.count++;
    if (this.loadFactor() > this.MAX_LOAD) this._rehash();
  };
  GardenHashTable.prototype.get = function (key) {
    var bucket = this.buckets[this._index(key)];
    for (var i = 0; i < bucket.length; i++) if (bucket[i][0] === key) return bucket[i][1];
    return null;
  };
  GardenHashTable.prototype.remove = function (key) {
    var bucket = this.buckets[this._index(key)];
    for (var i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) { bucket.splice(i, 1); this.count--; return true; }
    }
    return false;
  };
  GardenHashTable.prototype.entries = function () {
    var out = [];
    for (var b = 0; b < this.buckets.length; b++)
      for (var i = 0; i < this.buckets[b].length; i++) out.push(this.buckets[b][i]);
    return out;
  };
  GardenHashTable.prototype.longestChain = function () {
    var m = 0;
    for (var i = 0; i < this.buckets.length; i++) if (this.buckets[i].length > m) m = this.buckets[i].length;
    return m;
  };
  // Grow to ~2x (next prime) and re-place every entry directly into the new
  // buckets, so a rehash can never trigger a second rehash.
  GardenHashTable.prototype._rehash = function () {
    var old = this.entries();
    this.size = nextPrime(this.size * 2);
    this.buckets = this._empty(this.size);
    for (var i = 0; i < old.length; i++) this.buckets[this._index(old[i][0])].push(old[i]);
    this.rehashes++;
  };

  /* Export for quick testing in Node */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { insertionSort: insertionSort, mergeSort: mergeSort, GardenHashTable: GardenHashTable, speciesInfo: speciesInfo };
  }
  if (typeof document === 'undefined') return;

  /* ==================================================================
     GAME STATE
     ================================================================== */
  var ht = new GardenHashTable(7);
  var inventory = [];
  var leaderboard = [];
  var nextPlantId = 100;
  var nextCropId = 1;
  var lastStats = { cmp: 0, algo: 'insertion', n: 0 };
  var lastBoardCmp = 0;
  var prev = {};            // tile index -> {has, mature, watered}
  var activeTab = 'inv';
  var LS_KEY = 'garden_v4_leaderboard';

  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (Array.isArray(saved)) leaderboard = saved;
  } catch (e) { /* storage may be unavailable: ignore */ }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function numFrom(id) {
    var el = $(id);
    var n = el ? parseInt((el.textContent || '').replace(/[^\d-]/g, ''), 10) : 0;
    return isNaN(n) ? 0 : n;
  }
  function currentDay() { return Math.max(1, numFrom('day-counter')); }
  function selectedSeedLabel() {
    var s = $('crop-selector');
    if (!s || s.selectedIndex < 0) return 'Crop';
    return s.options[s.selectedIndex].text;
  }

  /* ==================================================================
     GRID WATCHER: turns plant / water / harvest into hash-table + inventory events
     ================================================================== */
  function onPlant(i) {
    var sp = speciesInfo(selectedSeedLabel());
    ht.put(i, {
      plantId: nextPlantId++, tile: i, species: sp.name, baseW: sp.w, baseV: sp.v,
      sun: sp.sun, health: 60, water: 0, plantedDay: currentDay()
    });
  }
  function onHarvest(i) {
    var rec = ht.get(i);
    if (!rec) return;
    var factor = 0.8 + Math.random() * 0.4;                    // 0.8x - 1.2x size
    var weight = Math.round(rec.baseW * factor * 100) / 100;
    var value = Math.max(1, Math.round(rec.baseV * factor));
    inventory.push({
      id: nextCropId++, species: rec.species, weight: weight, value: value,
      days: Math.max(1, currentDay() - rec.plantedDay), tile: i
    });
    ht.remove(i);
  }
  function onUpdate(i, cur) {
    var rec = ht.get(i);
    if (!rec) return;
    rec.water = cur.watered ? 10 : 0;
    rec.health = cur.watered ? 100 : 60;
  }

  function scanGrid() {
    var grid = $('garden-grid');
    if (!grid) return;
    var tiles = grid.children;
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var cur = {
        has: t.classList.contains('has-crop'),
        mature: t.classList.contains('mature'),
        watered: t.classList.contains('watered')
      };
      var p = prev[i] || { has: false, mature: false, watered: false };
      if (cur.has && !p.has) onPlant(i);
      else if (!cur.has && p.has) { if (p.mature) onHarvest(i); else ht.remove(i); }
      else if (cur.has) onUpdate(i, cur);
      prev[i] = cur;
    }
    render();
  }

  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () { scanTimer = null; scanGrid(); }, 40);
  }

  function attachWatcher() {
    var grid = $('garden-grid');
    if (!grid) return false;
    new MutationObserver(scheduleScan).observe(grid, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    scanGrid();
    return true;
  }

  /* ==================================================================
     UI PANEL (floating, so no changes to index.html layout are needed)
     ================================================================== */
  function buildPanel() {
    var css = document.createElement('style');
    css.textContent =
      '#v4-toggle{position:fixed;right:14px;bottom:14px;z-index:150;padding:8px 14px;border-radius:12px;' +
      'background:rgba(18,12,48,.85);border:1px solid #7FFF00;color:#d9ffb0;font:700 13px "Plus Jakarta Sans",sans-serif;cursor:pointer}' +
      '#v4-panel{position:fixed;right:14px;bottom:60px;z-index:150;width:min(380px,calc(100vw - 28px));max-height:70vh;overflow:auto;' +
      'padding:12px;border-radius:16px;display:none;font-size:12px;color:#ede9fe}' +
      '#v4-panel.open{display:block}' +
      '#v4-panel select,#v4-panel input{background:#1a1236;border:1px solid #6d28d9;color:#ede9fe;border-radius:10px;padding:5px 8px;font-size:12px;outline:none}' +
      '#v4-panel .v4b{background:rgba(91,33,182,.7);border:1px solid #8b5cf6;color:#ede9fe;border-radius:10px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer}' +
      '#v4-panel .v4t{padding:5px 10px;border-radius:10px;font-weight:700;cursor:pointer;color:#a78bfa;background:transparent;border:0}' +
      '#v4-panel .v4t.on{background:#3b2a6b;color:#fff}' +
      '#v4-panel table{width:100%;border-collapse:collapse;margin-top:8px}' +
      '#v4-panel th,#v4-panel td{text-align:left;padding:4px 6px;border-bottom:1px solid rgba(139,92,246,.25)}' +
      '#v4-panel th{color:#a78bfa;font-size:10px;text-transform:uppercase;letter-spacing:.05em}' +
      '.v4-note{font-family:"JetBrains Mono",monospace;color:#bbf7d0;margin-top:8px;font-size:11px}' +
      '.v4-cell{display:inline-block;min-width:26px;margin:2px;padding:2px 4px;border-radius:6px;text-align:center;' +
      'font:700 10px "JetBrains Mono",monospace;background:#1a1236;border:1px solid #4c3a8a;color:#8b7fc0}' +
      '.v4-cell.full{color:#d9ffb0;border-color:#7FFF00}' +
      '.v4-cell.clash{color:#fff6c0;border-color:#ffd600;background:rgba(255,214,0,.15)}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'v4-toggle';
    btn.textContent = '\uD83D\uDCE6 Inventory & Data';
    btn.onclick = function () { $('v4-panel').classList.toggle('open'); render(); };
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = 'v4-panel';
    panel.className = 'glass-panel';
    document.body.appendChild(panel);

    panel.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.tab) { activeTab = t.dataset.tab; render(); }
      if (t.id === 'v4-save-score') saveSeasonScore();
      if (t.id === 'v4-clear-board') { leaderboard = []; persistBoard(); render(); }
      if (t.id === 'v4-lookup-btn') doLookup();
    });
    panel.addEventListener('change', function (e) {
      if (e.target.id === 'v4-algo' || e.target.id === 'v4-key' || e.target.id === 'v4-order') render();
    });
  }

  function persistBoard() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(leaderboard)); } catch (e) { /* ignore */ }
  }

  function saveSeasonScore() {
    var nameEl = $('v4-name');
    var name = (nameEl && nameEl.value.trim()) || 'Player';
    leaderboard.push({
      player: name.slice(0, 20), score: numFrom('stewardship-counter'),
      coins: numFrom('coins-text'), day: currentDay()
    });
    persistBoard();
    render();
  }

  var lookupResult = '';
  function doLookup() {
    var el = $('v4-lookup');
    var key = el ? parseInt(el.value, 10) : NaN;
    if (isNaN(key)) { lookupResult = 'Enter a tile index.'; render(); return; }
    var r = ht.get(key);
    lookupResult = r
      ? 'Tile ' + key + ' -> #' + r.plantId + ' ' + r.species + ' | health ' + r.health + ' | water ' + r.water + 'L | sun ' + r.sun + 'h/day'
      : 'Tile ' + key + ': no plant (get returned null).';
    render();
  }

  function tabsHtml() {
    function tab(id, label) {
      return '<button class="v4t' + (activeTab === id ? ' on' : '') + '" data-tab="' + id + '">' + label + '</button>';
    }
    return '<div style="display:flex;gap:4px;margin-bottom:8px">' +
      tab('inv', 'Inventory') + tab('board', 'Leaderboard') + tab('hash', 'Hash Table') + '</div>';
  }

  function inventoryHtml() {
    var algo = ($('v4-algo') || {}).value || 'insertion';
    var keyName = ($('v4-key') || {}).value || 'value';
    var order = ($('v4-order') || {}).value || 'desc';
    var keyFn = { weight: function (c) { return c.weight; }, value: function (c) { return c.value; }, days: function (c) { return c.days; } }[keyName];
    var stats = { cmp: 0 };
    var sorted = algo === 'merge'
      ? mergeSort(inventory, keyFn, order === 'desc', stats)
      : insertionSort(inventory, keyFn, order === 'desc', stats);
    lastStats = { cmp: stats.cmp, algo: algo, n: inventory.length };

    function opt(v, label, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>'; }
    var h = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
      '<select id="v4-key">' + opt('value', 'Value', keyName) + opt('weight', 'Weight', keyName) + opt('days', 'Growth days', keyName) + '</select>' +
      '<select id="v4-order">' + opt('desc', 'High \u2192 Low', order) + opt('asc', 'Low \u2192 High', order) + '</select>' +
      '<select id="v4-algo">' + opt('insertion', 'Insertion Sort (basic)', algo) + opt('merge', 'Merge Sort (advanced)', algo) + '</select></div>';
    if (!sorted.length) {
      h += '<p style="margin-top:10px;color:#a78bfa">No harvested crops yet. Plant, water, advance the day, then harvest a mature crop.</p>';
    } else {
      h += '<table><tr><th>#</th><th>Crop</th><th>kg</th><th>Coins</th><th>Days</th></tr>';
      for (var i = 0; i < sorted.length; i++) {
        var c = sorted[i];
        h += '<tr><td>' + (i + 1) + '</td><td>' + esc(c.species) + '</td><td>' + c.weight + '</td><td>' + c.value + '</td><td>' + c.days + '</td></tr>';
      }
      h += '</table>';
    }
    h += '<div class="v4-note">' + (algo === 'merge' ? 'merge_sort' : 'insertion_sort') +
      ': n=' + lastStats.n + ', comparisons=' + lastStats.cmp + '</div>';
    return h;
  }

  function boardHtml() {
    var stats = { cmp: 0 };
    var sorted = mergeSort(leaderboard, function (r) { return r.score; }, true, stats);
    lastBoardCmp = stats.cmp;
    var h = '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      '<input id="v4-name" placeholder="Name" maxlength="20" style="width:110px" value="' + esc(($('v4-name') || {}).value || '') + '">' +
      '<button class="v4b" id="v4-save-score">Save season score</button>' +
      '<button class="v4b" id="v4-clear-board" style="background:rgba(127,29,29,.6);border-color:#f87171">Clear</button></div>' +
      '<div style="margin-top:6px;color:#a78bfa">Current: score ' + numFrom('stewardship-counter') + '%, ' + numFrom('coins-text') + ' coins, day ' + currentDay() + '</div>';
    if (!sorted.length) {
      h += '<p style="margin-top:8px;color:#a78bfa">No scores saved yet.</p>';
    } else {
      h += '<table><tr><th>Rank</th><th>Player</th><th>Score</th><th>Coins</th><th>Day</th></tr>';
      for (var i = 0; i < Math.min(10, sorted.length); i++) {
        var r = sorted[i];
        h += '<tr><td>' + (i + 1) + '</td><td>' + esc(r.player) + '</td><td>' + r.score + '</td><td>' + r.coins + '</td><td>' + r.day + '</td></tr>';
      }
      h += '</table>';
    }
    h += '<div class="v4-note">merge_sort (stable, ties keep earlier entry first): n=' + sorted.length + ', comparisons=' + lastBoardCmp + '</div>';
    return h;
  }

  function hashHtml() {
    var h = '<div class="v4-note" style="margin-top:0">size=' + ht.size + ' | plants=' + ht.count +
      ' | load=' + ht.loadFactor().toFixed(2) + ' (rehash > ' + ht.MAX_LOAD + ')<br>rehashes=' + ht.rehashes +
      ' | longest chain=' + ht.longestChain() + ' | collision method: chaining</div>';
    h += '<div style="display:flex;gap:6px;margin:8px 0"><input id="v4-lookup" type="number" placeholder="Tile index" style="width:100px">' +
      '<button class="v4b" id="v4-lookup-btn">get()</button></div>';
    if (lookupResult) h += '<div class="v4-note" style="margin-top:0;margin-bottom:8px">' + esc(lookupResult) + '</div>';
    h += '<div>';
    for (var b = 0; b < ht.buckets.length; b++) {
      var chain = ht.buckets[b];
      var cls = chain.length > 1 ? 'clash' : (chain.length === 1 ? 'full' : '');
      var label = chain.length ? chain.map(function (e) { return e[0]; }).join('\u2192') : '\u00B7';
      h += '<span class="v4-cell ' + cls + '" title="bucket ' + b + '">' + b + ':' + label + '</span>';
    }
    h += '</div><div style="margin-top:6px;color:#a78bfa">Yellow = collision (chain of 2+ plants in one bucket).</div>';
    return h;
  }

  function render() {
    var panel = $('v4-panel');
    if (!panel || !panel.classList.contains('open')) return;
    // keep focus/typed text when re-rendering from the grid watcher
    var active = document.activeElement && document.activeElement.id;
    if (active === 'v4-name' || active === 'v4-lookup') return;
    var body = activeTab === 'inv' ? inventoryHtml() : activeTab === 'board' ? boardHtml() : hashHtml();
    panel.innerHTML = tabsHtml() + body;
  }

  /* ==================================================================
     START
     ================================================================== */
  function start() {
    buildPanel();
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (attachWatcher() || tries > 100) clearInterval(timer);
    }, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.GardenV4 = { hashTable: ht, inventory: inventory, leaderboard: function () { return leaderboard; } };
})();
