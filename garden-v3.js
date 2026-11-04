// =====================================================================
// garden-v3.js  -  load AFTER garden-v2.js
// Adds: landing page + loading screen, day/night sky, butterflies & clouds,
// XP + levels, daily missions, achievements, mute button, saved progress.
// =====================================================================
(function () {
    const $ = id => document.getElementById(id);
    const S = { harvest: 0, water: 0, plant: 0, bug: 0, days: 0, xp: 0, level: 1, ach: {}, act: null };
    try { Object.assign(S, JSON.parse(localStorage.getItem('garden_v3') || '{}')); } catch (e) { }
    const save = () => { try { localStorage.setItem('garden_v3', JSON.stringify(S)); } catch (e) { } };
    const py = () => fetchFromPython('[game.coins, game.water, len(gardenTree.get_all_sorted())]');
    let lastCoins = 0;

    // ============ LANDING PAGE + LOADING SCREEN ============
    const intro = document.createElement('div');
    intro.className = 'intro';
    intro.innerHTML = `
        ${['🌽', '🍅', '🎃', '🌻', '🥕', '🦋', '☀️', '💧'].map((e, i) => `<span class="intro-float" style="left:${8 + i * 12}%;top:${i % 2 ? 12 : 78}%;animation-delay:${-i}s">${e}</span>`).join('')}
        <h1>Python-Based<br>Garden Simulator</h1>
        <p>Grow a glowing sanctuary, beat the bugs, unlock automation, and learn data structures with real Python running in your browser.</p>
        <div class="chips3"><span>SDG 2 · Zero Hunger</span><span>SDG 13 · Climate Action</span><span>SDG 15 · Life on Land</span></div>
        <div class="feat">
            <div><b>🌱</b>Plant, water &amp; harvest 3-phase crops</div>
            <div><b>🐛</b>Squash bugs before they eat crops</div>
            <div><b>⚙️</b>Buy sprinklers &amp; solar panels</div>
            <div><b>🏆</b>Missions, XP levels &amp; achievements</div>
            <div><b>🌙</b>Day and night sky cycle</div>
            <div><b>🧠</b>8 live data-structure topics</div>
        </div>
        <div class="prog"><i id="intro-bar"></i></div>
        <div id="intro-msg">Waking up the garden…</div>
        <button id="start-go">Loading…</button>`;
    document.body.appendChild(intro);
    const setProg = (p, m) => { $('intro-bar').style.width = p + '%'; $('intro-msg').textContent = m; };
    $('start-go').onclick = () => {
        intro.classList.add('out'); SFX.buy(); setTimeout(() => intro.remove(), 800);
        setTimeout(() => bigBanner('🌱 Welcome, Gardener!'), 400);
    };

    // Same startup as v2 (all 8 topics run) but reports progress to the loading bar.
    window.initPyodideEngine = async function () {
        const box = $('output-console');
        try {
            setProg(6, 'Loading the Python engine…');
            pyodideInstance = await loadPyodide();
            pyodideInstance.setStdout({ batched: t => { box.innerText += t + "\n"; } });
            box.innerText = '';
            const order = [1, 3, 4, 2, 5, 6, 7, 8];
            for (let n = 0; n < order.length; n++) {
                const k = order[n];
                setProg(25 + n * 9, `Running Topic ${k}: ${topicTemplates[k].title.split(': ')[1]}`);
                await new Promise(r => setTimeout(r, 40));
                await pyodideInstance.runPythonAsync(topicTemplates[k].code);
                activatedTopics.add(String(k));
                box.innerText += `✅ Topic ${k} running\n`;
            }
            displayActionHistory.length = 0; $('action-stack').innerHTML = '';
            syncFromBST(); refreshTopicUI(); lastCoins = py()[0]; renderXP(); renderPanel(); skyUpdate();
            setProg(100, 'Garden ready!');
            $('start-go').textContent = '▶ Start Gardening'; $('start-go').classList.add('ready');
        } catch (err) {
            console.error(err); setProg(100, 'Python failed to load. Refresh the page.');
        }
    };

    function bigBanner(t) {
        const b = document.createElement('div'); b.className = 'day-banner'; b.textContent = t;
        document.body.appendChild(b); setTimeout(() => b.remove(), 1700);
    }

    // ============ XP, MISSIONS, ACHIEVEMENTS ============
    const POOL = [
        { t: 'Harvest 3 crops', k: 'harvest', n: 3, r: 30 }, { t: 'Water 6 times', k: 'water', n: 6, r: 20 },
        { t: 'Plant 4 seeds', k: 'plant', n: 4, r: 20 }, { t: 'Squash 2 bugs', k: 'bug', n: 2, r: 25 }, { t: 'Survive 3 days', k: 'days', n: 3, r: 25 }];
    if (!S.act) S.act = [0, 1, 3].map(i => ({ i, from: S[POOL[i].k] || 0 }));
    const ACH = [
        ['first', '🌾 First Harvest', () => S.harvest >= 1], ['farmer', '🧺 Farmer (10)', () => S.harvest >= 10],
        ['bug', '🐞 Bug Buster (5)', () => S.bug >= 5], ['green', '🌱 Green Thumb (15)', () => S.plant >= 15],
        ['surv', '📅 Survivor (10 days)', () => S.days >= 10], ['auto', '⚙️ Automated', () => owned.sprinkler > 0 || owned.solar > 0],
        ['rich', '🪙 Tycoon (500c)', () => lastCoins >= 500]];

    function giveCoins(n) { try { runPy(`game.coins += ${n}\ngame.sync_ui()`); syncFromBST(); lastCoins += n; } catch (e) { } }
    function evt(k, n = 1) {
        S[k] = (S[k] || 0) + n;
        gainXP(({ harvest: 10, plant: 2, water: 1, bug: 3, days: 1 })[k] * n);
        S.act.forEach(a => {
            const m = POOL[a.i];
            if (S[m.k] - a.from >= m.n) {
                giveCoins(m.r); showToast(`✅ Mission done: ${m.t} (+${m.r} coins)`); floatAt(null, `+${m.r} Coins`, '#ffd600'); SFX.buy();
                do { a.i = (a.i + 1) % POOL.length; } while (S.act.some(o => o !== a && o.i === a.i));
                a.from = S[POOL[a.i].k] || 0;
            }
        });
        checkAch(); save(); renderPanel();
    }
    function checkAch() {
        ACH.forEach(([id, name, ok]) => {
            if (!S.ach[id] && ok()) { S.ach[id] = 1; showToast('🏆 Achievement: ' + name); bigBanner('🏆 ' + name); SFX.harvest(); save(); renderPanel(); }
        });
    }
    function gainXP(x) {
        S.xp += x;
        while (S.xp >= 30 * S.level) {
            S.xp -= 30 * S.level; S.level++;
            const bonus = 25 * S.level; bigBanner(`⭐ Level ${S.level}!`); SFX.harvest(); giveCoins(bonus); floatAt(null, `+${bonus} Coins`, '#ffd600', 300);
        }
        renderXP();
    }
    function renderXP() {
        let box = $('xp-box');
        if (!box) {
            box = document.createElement('div'); box.id = 'xp-box';
            const host = document.querySelector('header .flex.items-center.gap-3') || document.body;
            if (host === document.body) box.style.cssText = 'position:fixed;top:10px;right:10px;z-index:20';
            host.insertBefore(box, host.firstChild);
        }
        box.innerHTML = `<span class="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">LEVEL ${S.level}</span><div class="bar"><i style="width:${S.xp / (30 * S.level) * 100}%"></i></div>`;
    }
    function renderPanel() {
        let p = $('v3-panel');
        if (!p) {
            p = document.createElement('div'); p.id = 'v3-panel'; p.className = 'glass-panel rounded-2xl p-4';
            const host = $('stack-panel') ? $('stack-panel').parentNode : document.body; host.appendChild(p);
        }
        p.innerHTML = `<h3 class="font-bold text-emerald-400 mb-3 text-sm">🎯 Missions</h3>` +
            S.act.map(a => { const m = POOL[a.i], v = Math.min(m.n, S[m.k] - a.from);
                return `<div class="mission"><div class="flex justify-between"><span>${m.t}</span><span>${v}/${m.n} · +${m.r}c</span></div><div class="mb"><i style="width:${v / m.n * 100}%"></i></div></div>`; }).join('') +
            `<h3 class="font-bold text-emerald-400 mt-3 mb-2 text-sm">🏆 Achievements</h3>` +
            ACH.map(([id, name]) => `<span class="ach ${S.ach[id] ? 'on' : ''}">${name}</span>`).join('');
    }

    // Hook every game action to feed missions/XP/achievements.
    const _pc = window.pyCall;
    window.pyCall = function (func, ...args) {
        const wasPest = func === 'handle_tile_click' && pests.has(args[0]);
        let b = null; try { if (pyodideInstance) b = py(); } catch (e) { }
        _pc(func, ...args);
        if (wasPest) return evt('bug');
        let a = null; try { if (pyodideInstance) a = py(); } catch (e) { }
        if (!a || !b) return;
        lastCoins = a[0];
        if (func === 'handle_tile_click') { if (a[0] > b[0]) evt('harvest'); else if (a[2] > b[2]) evt('plant'); else if (a[1] < b[1]) evt('water'); }
        else if (func === 'water_all') { const n = Math.round((b[1] - a[1]) / 10); if (n > 0) evt('water', n); }
        else if (func === 'advance_day') { evt('days'); skyUpdate(); }
        checkAch();
    };

    // ============ DAY / NIGHT SKY, CLOUDS, BUTTERFLIES, MUTE ============
    let tint, orb, stars;
    function skyUpdate() {
        if (!tint) return;
        const ph = (+$('day-counter').textContent) % 4;
        const T = { 1: ['rgba(255,170,100,.16)', '🌅'], 2: ['rgba(0,0,0,0)', '☀️'], 3: ['rgba(255,90,150,.18)', '🌇'], 0: ['rgba(8,6,60,.5)', '🌙'] }[ph];
        tint.style.background = T[0]; orb.textContent = T[1]; stars.style.opacity = ph === 0 ? 1 : 0;
    }
    window.addEventListener('DOMContentLoaded', () => {
        document.getElementById('version-badge').textContent = 'v0.9.0';
        const vg = $('view-game');
        vg.insertAdjacentHTML('afterbegin', `<div id="sky-tint"></div><div id="stars"></div><div id="sky-orb">🌅</div>` +
            [0, 1, 2].map(i => `<span class="cloud" style="animation-duration:${50 + i * 20}s;animation-delay:${-i * 25}s;top:${4 + i * 5}%">☁️</span>`).join('') +
            [0, 1, 2].map(i => `<span class="bfly" style="left:${15 + i * 25}%;top:${30 + i * 15}%;animation-delay:${-i * 4}s">🦋</span>`).join(''));
        tint = $('sky-tint'); orb = $('sky-orb'); stars = $('stars');
        const m = document.createElement('button'); m.id = 'mute-btn'; m.textContent = '🔊';
        let muted = false; const _tone = window.tone;
        window.tone = (...a) => { if (!muted) _tone(...a); };
        m.onclick = () => { muted = !muted; m.textContent = muted ? '🔇' : '🔊'; };
        document.body.appendChild(m);
        renderXP(); renderPanel();
    });
})();
