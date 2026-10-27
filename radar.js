/* ============================================================
 * radar.js — رادار نبض المشجعين (Fan Pulse Radar)
 * خريطة حيّة تُظهر مشاعر الجماهير (فرح / حماس / غضب) لحظة الأهداف والأحداث الكبرى.
 * - window.openFanRadar()            يفتح الصفحة (زر الشريط السفلي)
 * - window.renderFanRadarPage(box)   يرسم الصفحة داخل أي حاوية
 * - window.FanPulse.push(event)      لتغذية الرادار ببيانات حقيقية:
 *     { city, lon, lat, match, ev, dom: 'joy'|'hype'|'rage', mix: {joy,hype,rage}, fans }
 * وبدون تغذية خارجية يعمل بأحداث تجريبية (محاكاة) حتى يُربط بالبيانات الحقيقية.
 * ============================================================ */
(function () {
    'use strict';
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const T = (ar, en) => (isAr() ? ar : en);
    const COL = { joy: '#ffc83d', hype: '#25e3c6', rage: '#ff4d5e' };
    const W = 760, H = 300;

    // مدن + مباريات (ar, en للمدينة والمباراة)
    const CITIES = [
        ['الرياض', 'Riyadh', 'الهلال × النصر', 'Al Hilal v Al Nassr', 46.7, 24.7],
        ['مدريد', 'Madrid', 'ريال مدريد × أتلتيكو', 'Real Madrid v Atletico', -3.7, 40.4],
        ['لندن', 'London', 'أرسنال × تشلسي', 'Arsenal v Chelsea', -0.1, 51.5],
        ['القاهرة', 'Cairo', 'الأهلي × الزمالك', 'Al Ahly v Zamalek', 31.2, 30],
        ['بوينس آيرس', 'Buenos Aires', 'بوكا × ريفر', 'Boca v River', -58.4, -34.6],
        ['ريو', 'Rio', 'فلامنغو × بالميراس', 'Flamengo v Palmeiras', -43.2, -22.9],
        ['طوكيو', 'Tokyo', 'فيسيل كوبي × أوراوا', 'Vissel Kobe v Urawa', 139.7, 35.7],
        ['باريس', 'Paris', 'باريس × مارسيليا', 'PSG v Marseille', 2.3, 48.9],
        ['إسطنبول', 'Istanbul', 'غلطة سراي × فنربخشة', 'Galatasaray v Fenerbahce', 29, 41],
        ['الدار البيضاء', 'Casablanca', 'الوداد × الرجاء', 'Wydad v Raja', -7.6, 33.6],
        ['نيويورك', 'New York', 'إنتر ميامي × نيويورك', 'Inter Miami v NYC', -74, 40.7],
        ['لاغوس', 'Lagos', 'نيجيريا × غانا', 'Nigeria v Ghana', 3.4, 6.5],
        ['سيدني', 'Sydney', 'سيدني × ملبورن', 'Sydney v Melbourne', 151.2, -33.9],
        ['ميلانو', 'Milan', 'إنتر × ميلان', 'Inter v Milan', 9.2, 45.5]
    ];
    const EVENTS = [
        ['هدف!', 'Goal!'], ['ركلة جزاء', 'Penalty'], ['هدف في الدقيقة الأخيرة', 'Last-minute goal'],
        ['بطاقة حمراء', 'Red card'], ['تصدٍّ تاريخي', 'Huge save'], ['هدف ملغى بالـVAR', 'Goal ruled out by VAR']
    ];
    const LAND = [
        [[-168,66],[-140,70],[-100,72],[-80,68],[-60,55],[-55,48],[-70,42],[-80,30],[-97,25],[-88,16],[-78,8],[-95,16],[-110,23],[-125,40],[-135,58]],
        [[-80,10],[-60,10],[-35,-6],[-40,-22],[-58,-38],[-68,-54],[-75,-45],[-71,-18],[-80,-3]],
        [[-10,36],[-9,44],[-2,50],[5,58],[20,70],[40,68],[40,45],[28,40],[15,38],[5,38]],
        [[-17,21],[-6,36],[10,37],[32,31],[43,12],[51,11],[40,-12],[33,-27],[20,-35],[12,-17],[9,4],[-8,5],[-17,14]],
        [[40,45],[45,70],[100,76],[150,70],[178,66],[140,45],[122,30],[110,18],[103,2],[90,22],[77,8],[68,24],[57,24],[50,30],[35,30],[27,40]],
        [[114,-22],[130,-12],[142,-11],[153,-27],[146,-39],[132,-33],[116,-35]]
    ];

    const proj = (lo, la) => [(lo + 170) / 350 * W, (75 - la) / 130 * H];
    function inside(x, y) {
        const lo = x / W * 350 - 170, la = 75 - y / H * 130;
        for (const p of LAND) {
            let c = false;
            for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
                const a = p[i], b = p[j];
                if ((a[1] > la) !== (b[1] > la) && lo < (b[0] - a[0]) * (la - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
            }
            if (c) return true;
        }
        return false;
    }
    let dots = null;
    function landDots() {
        if (dots) return dots;
        dots = [];
        for (let x = 5; x < W; x += 8) for (let y = 5; y < H; y += 8) if (inside(x, y)) dots.push([x, y]);
        return dots;
    }

    const S = { pulses: [], feed: [], sel: null, filt: 'all', sm: { joy: 33, hype: 34, rage: 33 }, timers: [], raf: 0 };
    const fmt = n => Number(n).toLocaleString(isAr() ? 'ar-EG' : 'en-US');

    function stop() {
        S.timers.forEach(clearInterval); S.timers = [];
        cancelAnimationFrame(S.raf);
    }

    // إضافة حدث (من مصدر حقيقي أو من المحاكاة)
    function push(e) {
        if (!e) return;
        let x = e.x, y = e.y;
        if (x == null) { const p = proj(e.lon, e.lat); x = p[0]; y = p[1]; }
        const mix = e.mix || { joy: 34, hype: 33, rage: 33 };
        const dom = e.dom || Object.keys(mix).sort((a, b) => mix[b] - mix[a])[0];
        const o = { x, y, t: performance.now() - (e.age || 0), dom, mix,
            city: e.city || '', match: e.match || '', ev: e.ev || '', fans: Number(e.fans) || 20000 };
        S.pulses.push(o);
        S.feed.unshift(o); S.feed = S.feed.slice(0, 5);
        renderFeed();
        if (!e.silent) pick(o);
    }

    function simulate(age) {
        const c = CITIES[Math.floor(Math.random() * CITIES.length)];
        const k = Math.floor(Math.random() * EVENTS.length);
        const dom = (k === 3 || k === 5) ? 'rage' : (k === 1 || k === 4 ? 'hype' : (Math.random() < 0.6 ? 'joy' : 'hype'));
        const m = { joy: Math.random() * 20, hype: Math.random() * 20, rage: Math.random() * 20 };
        m[dom] += 45 + Math.random() * 30;
        const s = m.joy + m.hype + m.rage;
        Object.keys(m).forEach(q => m[q] = Math.round(m[q] / s * 100));
        const ar = isAr();
        push({ lon: c[4], lat: c[5], city: ar ? c[0] : c[1], match: ar ? c[2] : c[3], ev: EVENTS[k][ar ? 0 : 1],
            dom, mix: m, fans: Math.round(12000 + Math.random() * 470000), age, silent: !!age });
    }

    function renderFeed() {
        const el = document.getElementById('fp-feed');
        if (!el) return;
        el.innerHTML = S.feed.map(o => `<div class="fp-row"><div><i class="fp-dot" style="background:${COL[o.dom]}"></i>${o.ev} · ${o.city}</div><span>${fmt(o.fans)}</span></div>`).join('');
    }
    function pick(o) {
        S.sel = o;
        const d = document.getElementById('fp-detail');
        if (!d) return;
        d.style.borderColor = COL[o.dom];
        d.innerHTML = `<strong>${o.ev} — ${o.city}</strong><p>${o.match} · ${fmt(o.fans)} ${T('مشجع متفاعل', 'fans reacting')}</p>
            <p style="color:#fff;margin-top:8px">${T('فرح', 'Joy')} ${o.mix.joy}% · ${T('حماس', 'Hype')} ${o.mix.hype}% · ${T('غضب', 'Anger')} ${o.mix.rage}%</p>`;
    }

    function loop() {
        const cv = document.getElementById('fp-canvas');
        if (!cv) return stop();                       // غادر المستخدم الصفحة
        const ctx = cv.getContext('2d'), t = performance.now();
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#26307a';
        landDots().forEach(d => ctx.fillRect(d[0] - 1, d[1] - 1, 2.2, 2.2));
        const sx = reduce ? -50 : (t / 12) % (W + 100) - 50;
        const g = ctx.createLinearGradient(sx - 60, 0, sx, 0);
        g.addColorStop(0, 'rgba(37,227,198,0)'); g.addColorStop(1, 'rgba(37,227,198,.22)');
        ctx.fillStyle = g; ctx.fillRect(sx - 60, 0, 60, H);

        S.pulses = S.pulses.filter(o => t - o.t < 30000);
        const tot = { joy: 0, hype: 0, rage: 0 };
        S.pulses.forEach(o => {
            const age = (t - o.t) / 1000, fade = Math.max(0, 1 - age / 30);
            for (const k in tot) tot[k] += o.mix[k] * fade * o.fans / 1e5;
            if (S.filt !== 'all' && S.filt !== o.dom) return;
            const col = COL[o.dom];
            for (let r = 0; r < 3; r++) {
                const a = ((age * 0.5) + r / 3) % 1;
                ctx.beginPath(); ctx.arc(o.x, o.y, 6 + a * (22 + o.fans / 25000), 0, 7);
                ctx.strokeStyle = col; ctx.globalAlpha = (1 - a) * 0.8 * Math.max(fade, 0.35); ctx.lineWidth = 2; ctx.stroke();
            }
            ctx.globalAlpha = Math.max(fade, 0.4);
            ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, 7);
            ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
            if (o === S.sel) { ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
            ctx.globalAlpha = 1;
        });
        const sum = (tot.joy + tot.hype + tot.rage) || 1;
        [['joy', 'j'], ['hype', 'h'], ['rage', 'r']].forEach(([k, s]) => {
            S.sm[k] += (tot[k] / sum * 100 - S.sm[k]) * 0.03;
            const b = document.getElementById('fp-b' + s), p = document.getElementById('fp-p' + s);
            if (b) b.style.width = S.sm[k] + '%';
            if (p) p.textContent = Math.round(S.sm[k]) + '%';
        });
        S.raf = requestAnimationFrame(loop);
    }

    window.renderFanRadarPage = function (box) {
        stop();
        S.pulses = []; S.feed = []; S.sel = null; S.filt = 'all';
        const ar = isAr();
        box.innerHTML = `
        <style>
            .fp-wrap{direction:${ar ? 'rtl' : 'ltr'};color:#fff}
            .fp-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
            .fp-head h2{font-size:1.25rem;font-weight:900;margin:0}
            .fp-live{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;color:#ff4d5e;margin-top:3px}
            .fp-live i{width:8px;height:8px;border-radius:50%;background:#ff4d5e;animation:fpb 1.2s infinite}
            @keyframes fpb{50%{opacity:.25}}
            .fp-chips{display:flex;gap:8px;margin-bottom:10px;overflow-x:auto}
            .fp-chip{flex:none;border:1px solid #2b3578;background:rgba(17,26,74,.9);color:#98a2d6;padding:7px 14px;border-radius:18px;font-size:.82rem;font-family:inherit;cursor:pointer}
            .fp-chip[aria-pressed="true"]{color:#fff;border-color:var(--c,#f5c35a);box-shadow:0 0 12px -2px var(--c,#f5c35a)}
            .fp-map{border:1px solid rgba(245,195,90,.4);border-radius:20px;background:#070a22;overflow-x:auto;overflow-y:hidden}
            .fp-map canvas{display:block}
            .fp-card{margin-top:12px;background:rgba(17,26,74,.9);border:1px solid #232c70;border-radius:18px;padding:14px}
            .fp-card h3{font-size:.85rem;color:#98a2d6;font-weight:700;margin:0 0 10px}
            .fp-bar{display:flex;height:14px;border-radius:7px;overflow:hidden;background:#1a2260}
            .fp-bar div{transition:width .8s}
            .fp-leg{display:flex;justify-content:space-between;margin-top:10px;font-size:.8rem}
            .fp-leg b{display:block;font-size:1.15rem}
            .fp-detail strong{font-size:1rem}
            .fp-detail p{color:#98a2d6;font-size:.8rem;margin:4px 0 0}
            .fp-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-top:1px solid #1d2566;font-size:.88rem}
            .fp-row span{color:#98a2d6;font-size:.75rem}
            .fp-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:8px}
        </style>
        <div class="fp-wrap">
            <div class="fp-head"><div><h2>📡 ${T('رادار نبض المشجعين', 'Fan Pulse Radar')}</h2>
                <div class="fp-live"><i></i>${T('مباشر', 'Live')} · <span id="fp-fans">0</span> ${T('مشجع', 'fans')}</div></div></div>
            <div class="fp-chips" id="fp-chips">
                <button class="fp-chip" data-f="all" aria-pressed="true">${T('الكل', 'All')}</button>
                <button class="fp-chip" data-f="joy" style="--c:${COL.joy}" aria-pressed="false">${T('فرح', 'Joy')}</button>
                <button class="fp-chip" data-f="hype" style="--c:${COL.hype}" aria-pressed="false">${T('حماس', 'Hype')}</button>
                <button class="fp-chip" data-f="rage" style="--c:${COL.rage}" aria-pressed="false">${T('غضب', 'Anger')}</button>
            </div>
            <div class="fp-map" id="fp-map" dir="ltr"><canvas id="fp-canvas"></canvas></div>
            <div class="fp-card">
                <h3>${T('مزاج الجماهير حول العالم الآن', 'Global fan mood right now')}</h3>
                <div class="fp-bar"><div id="fp-bj" style="background:${COL.joy}"></div><div id="fp-bh" style="background:${COL.hype}"></div><div id="fp-br" style="background:${COL.rage}"></div></div>
                <div class="fp-leg"><div style="color:${COL.joy}"><b id="fp-pj">0%</b>${T('فرح', 'Joy')}</div><div style="color:${COL.hype}"><b id="fp-ph">0%</b>${T('حماس', 'Hype')}</div><div style="color:${COL.rage}"><b id="fp-pr">0%</b>${T('غضب', 'Anger')}</div></div>
            </div>
            <div class="fp-card fp-detail" id="fp-detail"><strong>${T('اضغط على أي نبضة في الخريطة', 'Tap any pulse on the map')}</strong><p>${T('ستظهر تفاصيل الحدث ونسب مشاعر الجمهور.', 'See the event and the crowd’s emotion mix.')}</p></div>
            <div class="fp-card"><h3>${T('آخر الأحداث', 'Latest events')}</h3><div id="fp-feed"></div></div>
            <div style="height:20px"></div>
        </div>`;

        const cv = document.getElementById('fp-canvas'), dpr = window.devicePixelRatio || 1;
        cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
        cv.getContext('2d').scale(dpr, dpr);

        cv.addEventListener('click', e => {
            const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
            let best = null, bd = 900;
            S.pulses.forEach(o => {
                if (S.filt !== 'all' && S.filt !== o.dom) return;
                const d = (o.x - x) ** 2 + (o.y - y) ** 2;
                if (d < bd) { bd = d; best = o; }
            });
            if (best) pick(best);
        });
        document.getElementById('fp-chips').addEventListener('click', e => {
            const b = e.target.closest('.fp-chip'); if (!b) return;
            S.filt = b.dataset.f;
            box.querySelectorAll('.fp-chip').forEach(c => c.setAttribute('aria-pressed', c === b));
        });

        for (let i = 0; i < 5; i++) simulate(i * 3500);
        S.timers.push(setInterval(() => simulate(0), 4500));
        S.timers.push(setInterval(() => {
            const el = document.getElementById('fp-fans');
            if (el) el.textContent = fmt(S.pulses.reduce((n, o) => n + o.fans, 0));
        }, 1000));
        try { const m = document.getElementById('fp-map'); m.scrollLeft = (W - m.clientWidth) / 2; } catch (e) {}
        renderFeed();
        loop();
    };

    // فتح الصفحة من زر الشريط السفلي (أو showPage('radar'))
    window.openFanRadar = function () {
        const box = document.getElementById('main-content');
        if (!box) return;
        document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.toggle('active', b.id === 'nav-radar'));
        window.scrollTo(0, 0);
        window.renderFanRadarPage(box);
    };

    window.FanPulse = { push };

    // يجعل showPage('radar') يعمل من أي مكان (حتى لو app.js لا يعرف الصفحة)
    let tries = 0;
    const hook = setInterval(() => {
        if (typeof window.showPage === 'function' && !window.showPage.__radar) {
            const orig = window.showPage;
            const wrapped = function (name) {
                if (name === 'radar') return window.openFanRadar();
                stop();
                return orig.apply(this, arguments);
            };
            wrapped.__radar = true;
            window.showPage = wrapped;
            clearInterval(hook);
        } else if (++tries > 100) clearInterval(hook);
    }, 200);
})();
