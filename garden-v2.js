// =====================================================================
// garden-v2.js  -  load AFTER script.js
// Adds: auto-run topics 1-8, isometric tiles, pests/weeds, sprinklers &
// solar panels, floating text, sounds, weather FX. Overrides a few
// globals from script.js (initPyodideEngine, renderGridFromBST, pyCall,
// showToast); nothing in script.js needs editing.
// =====================================================================

// ---------------- Topics 6-8 (were placeholders) ----------------
topicTemplates[6].code = `# Topic 6: Hash Tables, Collisions, & Rehashing
class HashTable:
    """Separate chaining. Doubles capacity (rehash) when load factor > 0.75."""
    def __init__(self, capacity=4):
        self.capacity = capacity
        self.size = 0
        self.buckets = [[] for _ in range(capacity)]
        self.collisions = 0

    def _index(self, key):
        return sum(ord(ch) for ch in key) % self.capacity

    def put(self, key, value):
        bucket = self.buckets[self._index(key)]
        for pair in bucket:
            if pair[0] == key:
                pair[1] = value
                return
        if bucket:
            self.collisions += 1
        bucket.append([key, value])
        self.size += 1
        if self.size / self.capacity > 0.75:
            self._rehash()

    def get(self, key):
        for k, v in self.buckets[self._index(key)]:
            if k == key:
                return v
        return None

    def _rehash(self):
        old = [pair for b in self.buckets for pair in b]
        self.capacity *= 2
        self.buckets = [[] for _ in range(self.capacity)]
        self.size = 0
        for k, v in old:
            self.put(k, v)

crop_values = HashTable()
for name, coins in [("Maize", 30), ("Tomato", 45), ("Wheat", 25), ("Carrot", 35), ("Pumpkin", 75), ("Sunflower", 55)]:
    crop_values.put(name, coins)
print(f"Topic 6: {crop_values.size} crops hashed, capacity {crop_values.capacity}, collisions {crop_values.collisions}")
print("Pumpkin yield lookup:", crop_values.get("Pumpkin"))
`;

topicTemplates[7].code = `# Topic 7: Graph Foundations & DFS/BFS
from collections import deque

garden_graph = {
    "Core": ["Hydro", "Solar"],
    "Hydro": ["Core", "Bed A", "Bed B"],
    "Solar": ["Core", "Greenhouse"],
    "Bed A": ["Hydro"],
    "Bed B": ["Hydro", "Greenhouse"],
    "Greenhouse": ["Solar", "Bed B"],
}

def graph_bfs(graph, start):
    """Level by level using a FIFO queue (how pests spread outward)."""
    seen, order, q = {start}, [], deque([start])
    while q:
        node = q.popleft()
        order.append(node)
        for nb in graph[node]:
            if nb not in seen:
                seen.add(nb)
                q.append(nb)
    return order

def graph_dfs(graph, node, seen=None):
    """Go as deep as possible first (recursion = call stack)."""
    if seen is None:
        seen = []
    seen.append(node)
    for nb in graph[node]:
        if nb not in seen:
            graph_dfs(graph, nb, seen)
    return seen

print("Topic 7 BFS:", " -> ".join(graph_bfs(garden_graph, "Core")))
print("Topic 7 DFS:", " -> ".join(graph_dfs(garden_graph, "Core")))
`;

topicTemplates[8].code = `# Topic 8: Sorting Algorithms
def bubble_sort(items):
    a = list(items)
    for i in range(len(a)):
        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a

def merge_sort(items):
    if len(items) <= 1:
        return list(items)
    mid = len(items) // 2
    left, right = merge_sort(items[:mid]), merge_sort(items[mid:])
    out = []
    while left and right:
        out.append(left.pop(0) if left[0] <= right[0] else right.pop(0))
    return out + left + right

def quick_sort(items):
    if len(items) <= 1:
        return list(items)
    pivot, rest = items[0], items[1:]
    return quick_sort([x for x in rest if x < pivot]) + [pivot] + quick_sort([x for x in rest if x >= pivot])

yields = [30, 45, 25, 35, 75, 55]
print("Topic 8 bubble O(n^2):", bubble_sort(yields))
print("Topic 8 merge  O(n log n):", merge_sort(yields))
print("Topic 8 quick  avg O(n log n):", quick_sort(yields))
`;

// ---------------- Auto-run EVERY topic at startup ----------------
window.initPyodideEngine = async function () {
    const box = document.getElementById('output-console');
    try {
        pyodideInstance = await loadPyodide();
        pyodideInstance.setStdout({ batched: t => { box.innerText += t + "\n"; } });
        box.innerText = '';
        // Order matters: 3 makes `game`, 2 makes `cq`, 5 makes `gardenTree`.
        for (const k of [1, 3, 4, 2, 5, 6, 7, 8]) {
            await pyodideInstance.runPythonAsync(topicTemplates[k].code);
            activatedTopics.add(String(k));
            box.innerText += `✅ Topic ${k} running\n`;
        }
        displayActionHistory.length = 0;                 // drop Topic 1's demo pushes
        document.getElementById('action-stack').innerHTML = '';
        syncFromBST();
        refreshTopicUI();
        showToast("All 8 topics running! Pick a seed, then click a tile 🌱");
    } catch (err) {
        console.error("Failed to initialize Pyodide:", err);
        showToast("Python failed to load");
    }
};

// ---------------- Audio ----------------
let ac = null;
function tone(f, t0, d, type = 'sine', v = .15, f2) {
    try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
    } catch (e) { /* audio blocked: ignore */ }
}
const SFX = {
    harvest: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .07, .2, 'triangle', .2)),
    water: () => { tone(900, 0, .12, 'sine', .18, 400); tone(700, .1, .12, 'sine', .15, 300); tone(1000, .2, .1, 'sine', .12, 500); },
    plant: () => tone(300, 0, .15, 'square', .08, 650),
    pest: () => { tone(200, 0, .08, 'sawtooth', .12); tone(120, .07, .1, 'sawtooth', .1); },
    buy: () => { tone(660, 0, .1, 'square', .09); tone(880, .1, .15, 'square', .09); },
    alert: () => tone(180, 0, .25, 'sawtooth', .1)
};

// ---------------- Floating text ----------------
function floatAt(idx, text, color, delay = 0) {
    setTimeout(() => {
        const el = idx == null ? document.getElementById('garden-grid')
            : document.querySelector(`.iso-tile[data-idx="${idx}"] .top`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = document.createElement('div');
        d.className = 'float-text';
        d.textContent = text;
        d.style.color = color;
        d.style.left = (r.left + r.width / 2) + 'px';
        d.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 1300);
    }, delay);
}

// ---------------- Cartoon plants (3 phases, thick outlines) ----------------
const CROP_COLOR = { Maize: '#FFD700', Tomato: '#FF3B30', Wheat: '#F5C542', Carrot: '#FF8C00', Pumpkin: '#FF7518', Sunflower: '#FFE600' };
function plantSvg(stage, species) {
    const c = CROP_COLOR[species] || '#FF3B30';
    const S = 'stroke="#14532d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
    const leaf = (d, f) => `<path d="${d}" fill="${f}" ${S}/>`;
    if (stage === 1) return `<svg viewBox="0 0 60 70"><path d="M30 64 V48" fill="none" ${S}/>
        ${leaf('M30 50 C20 50 14 42 17 36 C26 37 30 43 30 50Z', '#98FB98')}${leaf('M30 50 C40 50 46 42 43 36 C34 37 30 43 30 50Z', '#7FFF00')}</svg>`;
    if (stage === 2) return `<svg viewBox="0 0 60 70"><path d="M30 64 V26" fill="none" ${S}/>
        ${leaf('M30 56 C16 56 8 46 12 38 C24 38 30 46 30 56Z', '#32CD32')}${leaf('M30 56 C44 56 52 46 48 38 C36 38 30 46 30 56Z', '#7FFF00')}
        ${leaf('M30 42 C20 42 14 34 18 27 C27 28 30 34 30 42Z', '#7FFF00')}${leaf('M30 42 C40 42 46 34 42 27 C33 28 30 34 30 42Z', '#32CD32')}
        <circle cx="30" cy="22" r="7" fill="${c}" ${S}/></svg>`;
    return `<svg viewBox="0 0 60 70"><path d="M30 66 V30" fill="none" ${S} stroke-width="6"/>
        ${leaf('M30 62 C12 62 2 50 8 40 C22 40 30 50 30 62Z', '#32CD32')}${leaf('M30 62 C48 62 58 50 52 40 C38 40 30 50 30 62Z', '#7FFF00')}
        <circle cx="30" cy="26" r="17" fill="${c}" ${S}/><ellipse cx="24" cy="19" rx="5" ry="3.5" fill="#fff" opacity=".7" transform="rotate(-30 24 19)"/></svg>`;
}

// ---------------- Pests & weeds ----------------
const pests = new Map();             // tile index -> {type:'bug'|'weed', age}
const stageMemory = new Map();       // tile index -> last rendered stage (for grow animation)
const rnd = n => Math.floor(Math.random() * n);
const runPy = code => pyodideInstance.runPython(code);
const plantedSet = () => new Set(fetchFromPython('gardenTree.get_all_sorted()').map(n => n.key));

function spawnPest() {
    if (pests.size >= 8) return;
    const planted = plantedSet();
    const crops = [...planted].filter(i => !pests.has(i));
    if (!crops.length) return;               // bugs only go after planted crops
    const i = crops[rnd(crops.length)];
    pests.set(i, { type: 'bug', age: 0 });
    SFX.alert();
    showToast(`🐛 A bug is eating tile ${i}! Click it!`);
}

function removePest(i) {
    const p = pests.get(i);
    pests.delete(i);
    const reward = 5;
    SFX.pest();
    runPy(`game.coins += ${reward}\ngame.sync_ui()`);
    syncFromBST();
    floatAt(i, 'Bug squashed!', '#ffffff');
    floatAt(i, `+${reward} Coins`, '#32CD32', 180);
}

function pestsPreDay() {
    const planted = plantedSet();
    for (const [i, p] of [...pests]) {
        p.age++;
        if (p.type === 'bug') {
            if (!planted.has(i)) { pests.delete(i); continue; }
            if (p.age >= 2) {                         // left alone for a full day: crop destroyed
                runPy(`game.remove_tile(${i})`);
                pests.delete(i);
                showToast(`🐛 Bugs destroyed the crop on tile ${i}!`);
                floatAt(i, 'Crop eaten!', '#ff5252');
            }
        }
    }
}

// ---------------- Unlockable automation ----------------
const owned = { sprinkler: 0, solar: 0 };
const COST = { sprinkler: 40, solar: 60 }, MAXOWN = 5;
let autoWatered = [];

function buyUpgrade(kind) {
    if (!pyodideInstance) return showToast("Python engine is still loading...");
    if (owned[kind] >= MAXOWN) return showToast("Max level reached!");
    const coins = fetchFromPython('game.coins');
    if (coins < COST[kind]) return showToast(`Need ${COST[kind]} coins!`);
    runPy(`game.coins -= ${COST[kind]}\ngame.sync_ui()`);
    owned[kind]++;
    SFX.buy();
    updateShop();
    syncFromBST();
    floatAt(null, `-${COST[kind]} Coins`, '#ff5252');
    showToast(kind === 'sprinkler' ? '💦 Sprinkler installed: waters 4 crops each dawn' : '☀️ Solar panel installed: +10 Wh each dawn');
}

function updateShop() {
    document.getElementById('shop-sprinkler').textContent = `${owned.sprinkler}/${MAXOWN} · ${COST.sprinkler}c`;
    document.getElementById('shop-solar').textContent = `${owned.solar}/${MAXOWN} · ${COST.solar}c`;
}

function autoWaterNow() {
    autoWatered = [];
    if (!owned.sprinkler) return;
    const res = fetchFromPython(`_w = []
_n = ${owned.sprinkler * 4}
for _r in range(game.rows):
    for _c in range(game.cols):
        _cr = game.grid[_r][_c]
        if _n > 0 and _cr and not _cr.watered and _cr.stage < _cr.max_stage:
            _cr.watered = True
            _n -= 1
            _w.append(_r * game.cols + _c)
_w`);
    autoWatered = Array.from(res || []);
}

// ---------------- Weather overlay ----------------
function weatherFx(kind) {
    const fx = document.getElementById('weather-fx');
    if (!fx) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:0';
    if (kind === 'sun') {
        box.innerHTML = '<div class="sun-rays"></div><div class="sun-core"></div>';
    } else {
        for (let i = 0; i < 45; i++) {
            const p = document.createElement('div');
            if (kind === 'dust') {
                const s = 3 + rnd(5);
                p.className = 'dust';
                p.style.cssText = `left:${rnd(100)}%;top:${rnd(100)}%;width:${s}px;height:${s}px;--dx:${120 + rnd(200)}px;--dy:${rnd(80) - 40}px;animation-duration:${3 + rnd(3)}s;animation-delay:${rnd(2000)}ms`;
            } else {
                p.className = 'drop';
                p.style.cssText = `left:${rnd(100)}%;animation-duration:${.8 + Math.random()}s;animation-delay:${rnd(2500)}ms;animation-iteration-count:2`;
            }
            box.appendChild(p);
        }
    }
    fx.appendChild(box);
    setTimeout(() => box.remove(), 8000);
}

const _toast = window.showToast;
window.showToast = function (msg) {
    _toast(msg);
    if (typeof msg === 'string' && msg.startsWith('Climate:')) {
        if (msg.includes('Solar Flare')) weatherFx('sun');
        else if (msg.includes('Drought') || msg.includes('Heatwave')) weatherFx('dust');
        else if (msg.includes('Rain')) weatherFx('rain');
    }
};

// ---------------- Isometric grid renderer (replaces script.js version) ----------------
window.renderGridFromBST = function (sortedNodes) {
    const gridEl = document.getElementById('garden-grid');
    gridEl.innerHTML = '';
    const byTile = new Map(sortedNodes.map(n => [n.key, n]));

    for (let idx = 0; idx < GRID_TILES; idx++) {
        const t = byTile.get(idx), pest = pests.get(idx);
        const div = document.createElement('div');
        div.className = 'iso-tile' + (t ? ' has-crop' : '') + (t && t.watered ? ' watered' : '') + (t && t.is_mature ? ' mature' : '');
        div.dataset.idx = idx;

        let html = `<div class="top">${t ? '' : `<span class="idx">${idx}</span>`}</div><div class="sf"></div><div class="sr"></div>`;
        if (t) {
            const prev = stageMemory.get(idx);
            const grow = (prev === undefined || t.stage > prev) ? ' grow' : '';
            stageMemory.set(idx, t.stage);
            html += `<div class="plant${grow}">${plantSvg(t.stage, t.species)}</div>`;
        } else {
            stageMemory.delete(idx);
        }
        if (pest) html += `<div class="pest ${pest.type}">🐛</div>`;
        div.innerHTML = html;

        div.onclick = () => pyCall('handle_tile_click', idx, document.getElementById('crop-selector').value);
        gridEl.appendChild(div);
    }
};

// ---------------- pyCall wrapper: pests, automation, FX, sound ----------------
const _pyCall = window.pyCall;
const snap = () => { try { return fetchFromPython('[game.coins, game.water, game.energy]'); } catch (e) { return null; } };

window.pyCall = function (func, ...args) {
    if (!pyodideInstance) return _pyCall(func, ...args);
    let tile = null;
    if (func === 'handle_tile_click') {
        tile = args[0];
        if (pests.has(tile)) return removePest(tile);   // clicking a pest/weed removes it first
    }
    if (func === 'advance_day') { pestsPreDay(); autoWaterNow(); }
    const before = snap();
    _pyCall(func, ...args);
    if (func === 'advance_day') {
        if (Math.random() < .7) spawnPest();
        if (Math.random() < .3) spawnPest();
        if (owned.solar) runPy(`game.energy = min(120, game.energy + ${owned.solar * 10})\ngame.sync_ui()`);
        syncFromBST();
        dayBanner();
        autoWatered.forEach((i, k) => floatAt(i, '💦 Auto-water', '#4fc3ff', k * 120));
    }
    const after = snap();
    if (!before || !after) return;

    const [dc, dw, de] = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
    let k = 0;
    const pop = (txt, col) => floatAt(tile, txt, col, 160 * k++);
    if (dc > 0) pop(`+${dc} Coins`, '#32CD32');
    else if (dc < 0 && func === 'handle_tile_click') pop(`${dc} Coins`, '#ff5252');
    if (dw > 0) pop(`+${dw}L Water`, '#4fc3ff');
    else if (dw < 0) pop(`${dw}L Water`, '#2979ff');
    if (de > 0) pop(`+${de} Wh`, '#ffd600');

    if (func === 'handle_tile_click' && tile != null) {
        if (dc > 0) { SFX.harvest(); confetti(tile); } else if (dw < 0) SFX.water(); else if (dc < 0) SFX.plant();
        const pl = document.querySelector(`.iso-tile[data-idx="${tile}"] .plant`);
        if (pl) { pl.classList.remove('grow'); void pl.offsetWidth; pl.classList.add('squish'); }   // squish/bounce
    } else if (func === 'water_all' && dw < 0) SFX.water();
};

// ---------------- DOM setup (runs after script.js's own DOMContentLoaded handler) ----------------
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-badge').textContent = 'v0.8.0';
    document.getElementById('tab-game').parentElement.classList.add('tabbar-fix');

    const fx = document.createElement('div');
    fx.id = 'weather-fx';
    document.getElementById('view-game').appendChild(fx);

    const shop = document.createElement('div');
    shop.innerHTML = `<h3 class="text-xs font-bold text-yellow-300 uppercase tracking-wider mb-2">Automation Shop</h3>
        <div class="grid gap-2">
            <button class="shop-btn" onclick="buyUpgrade('sprinkler')"><span>💦 Sprinkler (auto-water 4)</span><span id="shop-sprinkler"></span></button>
            <button class="shop-btn" onclick="buyUpgrade('solar')"><span>☀️ Solar Panel (+10 Wh/day)</span><span id="shop-solar"></span></button>
        </div>`;
    const controls = document.querySelector('#resources-section .border-t');
    controls.parentNode.insertBefore(shop, controls);
    updateShop();

    // Random events: now and then a pest appears without waiting for a new day.
    setInterval(() => {
        if (pyodideInstance && typeof pyodideInstance.runPython === 'function' && Math.random() < .4) {
            try { spawnPest(); syncFromBST(); } catch (e) { /* engine not ready yet */ }
        }
    }, 20000);
});


// =====================================================================
// FUN PACK: confetti, day banner, counter bumps, drifting leaves
// =====================================================================
function confetti(idx) {
    const el = document.querySelector(`.iso-tile[data-idx="${idx}"] .top`);
    if (!el) return;
    const r = el.getBoundingClientRect(), cols = ['#32CD32', '#7FFF00', '#ffd600', '#ff5252', '#4fc3ff', '#ff7ae0'];
    for (let i = 0; i < 26; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        const ang = Math.random() * Math.PI * 2, dist = 50 + rnd(90);
        c.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${cols[rnd(cols.length)]};` +
            `--x:${Math.cos(ang) * dist}px;--y:${Math.sin(ang) * dist - 40}px;--r:${rnd(720)}deg`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 1000);
    }
}

function dayBanner() {
    const day = document.getElementById('day-counter').textContent;
    const b = document.createElement('div');
    b.className = 'day-banner';
    b.innerHTML = `<span>☀️</span> Day ${day}`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1700);
}

function bump(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
const _uRes = window.updateResources, _uHdr = window.updateHeaderStats;
let _lastCoins = null, _lastDay = null, _lastScore = null;
window.updateResources = function (w, s, e, c) {
    _uRes(w, s, e, c);
    if (_lastCoins !== null && c !== _lastCoins) bump('coins-text');
    _lastCoins = c;
};
window.updateHeaderStats = function (d, sc) {
    _uHdr(d, sc);
    if (_lastDay !== null && d !== _lastDay) bump('day-counter');
    if (_lastScore !== null && sc !== _lastScore) bump('stewardship-counter');
    _lastDay = d; _lastScore = sc;
};

// gentle falling leaves + fireflies-style sparkles behind the UI
(function () {
    const layer = document.createElement('div');
    layer.className = 'leaf-layer';
    const icons = ['🍃', '🌿', '✨', '🍀', '🌸'];
    for (let i = 0; i < 14; i++) {
        const l = document.createElement('span');
        l.className = 'leaf';
        l.textContent = icons[rnd(icons.length)];
        l.style.cssText = `left:${rnd(100)}%;font-size:${12 + rnd(14)}px;animation-duration:${12 + rnd(14)}s;animation-delay:${-rnd(20)}s`;
        layer.appendChild(l);
    }
    document.body.appendChild(layer);
})();