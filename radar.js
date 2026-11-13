/* ============================================================
 * radar.js — رادار نبض المشجعين (Fan Pulse Radar)
 * خريطة حيّة تُظهر مشاعر الجماهير (فرح / حماس / غضب) لحظة الأهداف والأحداث الكبرى.
 * - window.openFanRadar()            يفتح الصفحة (زر الشريط السفلي)
 * - window.renderFanRadarPage(box)   يرسم الصفحة داخل أي حاوية
 * - window.FanPulse.push(event)      لتغذية الرادار ببيانات حقيقية:
 *     { city, lon, lat, match, ev, dom: 'joy'|'hype'|'rage', mix: {joy,hype,rage}, fans }
 * الوضع الحقيقي (عند توفر supabaseClient):
 *   - المباريات الجارية من جدول matches، والضغطات عبر rpc cast_pulse (pulse.sql)
 *   - Realtime: match_pulse (ضغطات الجمهور) + match_events (أهداف وبطاقات)
 * وضع العرض التجريبي (محاكاة) يعمل فقط بدون supabase أو بطلب المستخدم.
 * ============================================================ */
(function () {
    'use strict';
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const T = (ar, en) => window.zT(ar, en);
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
    const fmt = n => Number(n).toLocaleString(window.zA('ar-EG', 'en-US'));

    function stop() {
        S.timers.forEach(clearInterval); S.timers = [];
        cancelAnimationFrame(S.raf);
        try { const c = sb(); if (S.ch && c) c.removeChannel(S.ch); } catch (e) {}
        S.ch = null;
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

    const EMO = { joy: '😍', hype: '🔥', rage: '😡' };
    function renderFeed() {
        const el = document.getElementById('fp-feed');
        if (!el) return;
        el.innerHTML = S.feed.map(o => `<div class="fp-row"><div class="fp-ic" style="border-color:${COL[o.dom]}66">${EMO[o.dom]}</div><div class="fp-rt"><b>${o.ev}</b><small>${o.city}</small></div><span>${fmt(o.fans)}</span></div>`).join('');
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
                ctx.beginPath(); ctx.arc(o.x, o.y, 6 + a * (22 + Math.max(0, (Math.log10(o.fans + 1) - 2) * 7)), 0, 7);
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


    /* ================= الوضع الحقيقي: مباريات + Realtime ================= */
    const sb = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const toast = m => { try { if (typeof window.showToast === 'function') window.showToast(m); } catch (e) {} };

    // إحداثيات تقريبية للبلدان (lon, lat) — الاسم بالإنجليزية|العربية. أضف ما تحتاجه.
    const COUNTRY_RAW = {
        'brazil|البرازيل': [-47, -15], 'argentina|الأرجنتين': [-64, -34], 'france|فرنسا': [2, 47], 'spain|إسبانيا': [-3.7, 40],
        'england|إنجلترا': [-1, 52], 'germany|ألمانيا': [10, 51], 'italy|إيطاليا': [12, 42], 'portugal|البرتغال': [-8, 39.5],
        'netherlands|هولندا': [5, 52], 'belgium|بلجيكا': [4.5, 50.8], 'croatia|كرواتيا': [16, 45], 'uruguay|الأوروغواي': [-56, -33],
        'colombia|كولومبيا': [-74, 4.6], 'mexico|المكسيك': [-99, 19.4], 'usa|united states|الولايات المتحدة': [-98, 38],
        'canada|كندا': [-100, 56], 'japan|اليابان': [138, 36], 'south korea|كوريا الجنوبية': [127.5, 36.5],
        'australia|أستراليا': [134, -25], 'saudi arabia|السعودية': [45, 24], 'egypt|مصر': [31, 27], 'morocco|المغرب': [-7, 32],
        'tunisia|تونس': [9.5, 34], 'algeria|الجزائر': [3, 28], 'senegal|السنغال': [-14.5, 14.5], 'nigeria|نيجيريا': [8, 9],
        'ghana|غانا': [-1.5, 7.9], 'cameroon|الكاميرون': [12.5, 5.7], 'iran|إيران': [53, 32], 'qatar|قطر': [51.2, 25.3],
        'turkey|تركيا': [35, 39], 'switzerland|سويسرا': [8, 46.8], 'denmark|الدنمارك': [10, 56], 'poland|بولندا': [19, 52],
        'scotland|اسكتلندا': [-4, 56.5], 'ecuador|الإكوادور': [-78, -1.8], 'paraguay|باراغواي': [-58, -23], 'chile|تشيلي': [-71, -33],
        'iraq|العراق': [44, 33], 'jordan|الأردن': [36, 31], 'uae|الإمارات': [54, 24], 'south africa|جنوب أفريقيا': [25, -29]
    };
    const COUNTRY = {};
    Object.keys(COUNTRY_RAW).forEach(k => k.split('|').forEach(n => { COUNTRY[n.trim().toLowerCase()] = COUNTRY_RAW[k]; }));

    // موقع المباراة على الخريطة: أعمدة lon/lat إن وُجدت، ثم بلد الفريق، ثم وسط الخريطة
    function matchXY(m, side) {
        let ll = (m.lon != null && m.lat != null) ? [Number(m.lon), Number(m.lat)] : null;
        const find = name => {
            const n = String(name || '').trim().toLowerCase();
            if (COUNTRY[n]) return COUNTRY[n];
            if (typeof allWorldCupCountriesClubs !== 'undefined') {
                for (const key in allWorldCupCountriesClubs) {
                    if ((allWorldCupCountriesClubs[key] || []).some(c => String(c.name || '').toLowerCase() === n)) {
                        const k = String(key).toLowerCase();
                        if (COUNTRY[k]) return COUNTRY[k];
                    }
                }
            }
            return null;
        };
        if (!ll) ll = (side === 'b' ? (find(m.team_b) || find(m.team_a)) : (find(m.team_a) || find(m.team_b))) || [10, 30];
        const p = proj(ll[0] + (Math.random() - 0.5) * 4, ll[1] + (Math.random() - 0.5) * 3);
        return { x: p[0], y: p[1] };
    }

    function isLive(m) {
        const st = String(m.status || '').toUpperCase().trim();
        if (st === 'FINISHED') return false;
        const ls = String(m.live_status || m.api_status || '').toUpperCase().trim();   // من football-data
        if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(ls)) return true;
        if (['FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(ls)) return false;
        if (['LIVE', 'IN_PLAY', 'PAUSED', 'HALF_TIME'].includes(st)) return true;
        const mins = (Date.now() - new Date(m.match_date).getTime()) / 60000;
        return mins >= 0 && mins <= 150;                 // نافذة تقديرية لمدة المباراة
    }

    async function loadMatches() {
        const c = sb();
        const r = await c.from('matches').select('*').neq('status', 'FINISHED').order('match_date', { ascending: true });
        S.matches = (r.data || []).filter(isLive);
        S.byId = {}; S.matches.forEach(m => { S.byId[String(m.id)] = m; });
        if (S.matches.length) {
            const ids = S.matches.map(m => String(m.id));
            const pr = await c.from('match_pulse').select('*').in('match_id', ids);
            (pr.data || []).forEach(x => { S.last[String(x.match_id)] = snap(x); });
        }
    }

    // لقطة عدّادات مباراة: المجموع + مشجعو الفريق الأول (a) والثاني (b). المحايد = المجموع - a - b
    function snap(x) {
        const n = v => Number(v) || 0;
        return {
            joy: n(x.joy), hype: n(x.hype), rage: n(x.rage),
            a: { joy: n(x.a_joy), hype: n(x.a_hype), rage: n(x.a_rage) },
            b: { joy: n(x.b_joy), hype: n(x.b_hype), rage: n(x.b_rage) }
        };
    }
    const sideKey = id => 'zelo_radar_side_' + id;
    function loadSide(id) { try { const v = localStorage.getItem(sideKey(id)); return ['a', 'b', 'n'].includes(v) ? v : null; } catch (e) { return null; } }
    function saveSide(id, v) { try { localStorage.setItem(sideKey(id), v); } catch (e) {} }

    function renderSide() {
        const el = document.getElementById('fp-side'); if (!el) return;
        const m = S.byId[S.curr];
        if (!m) { el.innerHTML = ''; return; }
        const b = (k, label) => `<button class="fp-sidebtn" data-s="${k}" aria-pressed="${S.side === k}">${label}</button>`;
        el.innerHTML = `<div class="fp-h">${T('مع أي فريق أنت؟', 'Which side are you on?')}</div><div class="fp-sidebtns">`
            + b('a', m.team_a) + b('b', m.team_b) + b('n', T('محايد', 'Neutral')) + `</div>`;
        el.querySelectorAll('[data-s]').forEach(x => x.onclick = () => {
            S.side = x.dataset.s; saveSide(S.curr, S.side);
            renderSide();
            const v = document.getElementById('fp-vote'); if (v) v.classList.remove('off');
        });
    }

    // مزاج جمهور كل فريق (تراكمي منذ بداية المباراة)
    function renderTeams() {
        const el = document.getElementById('fp-teams-body'); if (!el) return;
        const m = S.byId[S.curr], l = S.last[S.curr];
        if (!m || !l) { el.innerHTML = `<div class="fp-empty">${T('اختر مباراة مباشرة.', 'Pick a live match.')}</div>`; return; }
        const row = (name, o) => {
            const sum = o.joy + o.hype + o.rage;
            if (!sum) return `<div class="fp-trow"><div class="fp-tname">${name}</div><div class="fp-empty">${T('لا تفاعل بعد', 'No reactions yet')}</div></div>`;
            const p = k => Math.round(o[k] / sum * 100);
            return `<div class="fp-trow"><div class="fp-tname">${name} <span>${fmt(sum)}</span></div>
                <div class="fp-bar"><div style="width:${o.joy / sum * 100}%;background:${COL.joy}"></div><div style="width:${o.hype / sum * 100}%;background:${COL.hype}"></div><div style="width:${o.rage / sum * 100}%;background:${COL.rage}"></div></div>
                <div class="fp-leg"><div style="color:${COL.joy}">${T('فرح', 'Joy')} ${p('joy')}%</div><div style="color:${COL.hype}">${T('حماس', 'Hype')} ${p('hype')}%</div><div style="color:${COL.rage}">${T('غضب', 'Anger')} ${p('rage')}%</div></div></div>`;
        };
        el.innerHTML = row(T('مشجعو ', 'Fans of ') + m.team_a, l.a) + row(T('مشجعو ', 'Fans of ') + m.team_b, l.b);
    }

    function renderChips() {
        const el = document.getElementById('fp-matches'); if (!el) return;
        if (!S.matches.length) {
            el.innerHTML = `<div class="fp-mcard"><div class="fp-empty">${T('لا توجد مباراة مباشرة الآن.', 'No live match right now.')}</div>
                <button class="fp-sidebtn" id="fp-demo" style="flex:none;padding:8px 14px">${T('عرض تجريبي', 'Demo mode')}</button></div>`;
            const d = document.getElementById('fp-demo'); if (d) d.onclick = startDemo;
            return;
        }
        const m = S.byId[S.curr] || S.matches[0];
        const sc = v => (v == null ? '-' : v);
        const h = m.live_home != null ? m.live_home : m.home_score, a = m.live_away != null ? m.live_away : m.away_score;
        let html = `<div class="fp-mcard"><div style="flex:1;min-width:0"><div class="fp-ml">● ${T('مباراة مباشرة الآن', 'Live now')}</div>
            <div class="fp-mrow"><div>${m.team_a}</div><div class="fp-sc">${sc(h)} - ${sc(a)}</div><div>${m.team_b}</div></div></div></div>`;
        if (S.matches.length > 1) html += '<div class="fp-chips2">' + S.matches.map(x => `<button class="fp-chip" data-m="${x.id}" aria-pressed="${String(x.id) === String(S.curr)}">${x.team_a} × ${x.team_b}</button>`).join('') + '</div>';
        el.innerHTML = html;
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => selectMatch(b.dataset.m));
    }
    function selectMatch(id) {
        S.curr = String(id);
        S.side = loadSide(S.curr);                       // الفريق الذي اختاره المشجع لهذه المباراة (إن وُجد)
        renderChips();
        renderSide();
        renderTeams();
        const v = document.getElementById('fp-vote'); if (v) v.classList.toggle('off', !S.side);
    }

    // ضغطة المشجع: تُجمَّع ثم تُرسل كل ~1.2 ثانية (الحد الأقصى 20 لكل إرسال حسب cast_pulse)
    function tap(emotion, btn) {
        if (!S.curr) return toast(T('اختر مباراة مباشرة أولاً', 'Pick a live match first'));
        if (!S.side) return toast(T('اختر فريقك أولاً', 'Pick your side first'));
        S.pend[S.side][emotion]++;
        if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
        try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    }
    let flushErr = false;
    async function flush() {
        const c = sb();
        if (!c || !S.curr) return;
        // نرسل فريقًا واحدًا في كل دورة (الخادم يتجاهل ما يصل أسرع من 0.8 ثانية)
        const side = ['a', 'b', 'n'].find(s => S.pend[s].joy + S.pend[s].hype + S.pend[s].rage > 0);
        if (!side) return;
        const n = S.pend[side];
        S.pend[side] = { joy: 0, hype: 0, rage: 0 };
        try {
            const args = { p_match: S.curr, p_joy: n.joy, p_hype: n.hype, p_rage: n.rage };
            let { error } = await c.rpc('cast_pulse', Object.assign({ p_side: side }, args));
            // قبل تحديث قاعدة البيانات: نرسل بالصيغة القديمة (بدون الفريق) كي لا تضيع الضغطات
            if (error && /p_side|could not find the function|PGRST202/i.test(String(error.message || '') + String(error.code || ''))) ({ error } = await c.rpc('cast_pulse', args));
            if (error) throw error;
            flushErr = false;
        } catch (e) {
            if (!flushErr) toast(T('تعذّر إرسال تفاعلك', 'Could not send your reaction'));
            flushErr = true;
        }
    }

    // تغيّر عدّاد مباراة → نجمّع الفرق ثم نطلق نبضة كل ~1.5 ثانية
    function onPulseRow(row) {
        if (!row) return;
        const id = String(row.match_id), prev = S.last[id], cur = snap(row);
        S.last[id] = cur;
        if (id === S.curr) renderTeams();
        if (!prev) return;
        const acc = S.acc[id] || (S.acc[id] = { a: { joy: 0, hype: 0, rage: 0 }, b: { joy: 0, hype: 0, rage: 0 }, n: { joy: 0, hype: 0, rage: 0 } });
        ['joy', 'hype', 'rage'].forEach(k => {
            const da = Math.max(0, cur.a[k] - prev.a[k]), db_ = Math.max(0, cur.b[k] - prev.b[k]);
            const dt = Math.max(0, cur[k] - prev[k]);
            acc.a[k] += da; acc.b[k] += db_; acc.n[k] += Math.max(0, dt - da - db_);   // المحايد = الباقي
        });
    }
    function drainAcc() {
        Object.keys(S.acc).forEach(id => {
            const m = S.byId[id]; if (!m) return;
            ['a', 'b', 'n'].forEach(s => {
                const a = S.acc[id][s], sum = a.joy + a.hype + a.rage;
                                if (!sum) return;
                S.acc[id][s] = { joy: 0, hype: 0, rage: 0 };
                const mix = { joy: Math.round(a.joy / sum * 100), hype: Math.round(a.hype / sum * 100), rage: Math.round(a.rage / sum * 100) };
                const dom = Object.keys(mix).sort((x, y) => mix[y] - mix[x])[0];
                const emo = { joy: T('فرح', 'Joy'), hype: T('حماس', 'Hype'), rage: T('غضب', 'Anger') }[dom];
                const who = s === 'a' ? T('مشجعو ', 'Fans of ') + m.team_a : s === 'b' ? T('مشجعو ', 'Fans of ') + m.team_b : T('جمهور محايد', 'Neutral fans');
                const xy = matchXY(m, s);
                push({ x: xy.x, y: xy.y, city: who, match: m.team_a + ' × ' + m.team_b, ev: emo, dom, mix, fans: sum, silent: true });
            });
        });
    }

    const EV = {
        goal:     { ar: 'هدف!', en: 'Goal!', mix: { joy: 62, hype: 30, rage: 8 } },
        red_card: { ar: 'بطاقة حمراء', en: 'Red card', mix: { joy: 10, hype: 20, rage: 70 } },
        penalty:  { ar: 'ركلة جزاء', en: 'Penalty', mix: { joy: 20, hype: 65, rage: 15 } },
        var:      { ar: 'مراجعة VAR', en: 'VAR check', mix: { joy: 10, hype: 45, rage: 45 } },
        kickoff:  { ar: 'انطلقت المباراة', en: 'Kick-off', mix: { joy: 25, hype: 65, rage: 10 } },
        fulltime: { ar: 'نهاية المباراة', en: 'Full time', mix: { joy: 35, hype: 40, rage: 25 } }
    };
    function onEvent(e, age) {
        if (!e || !EV[e.type]) return;
        const d = EV[e.type], m = S.byId[String(e.match_id)] || { team_a: e.home, team_b: e.away };
        const xy = matchXY(m), l = S.last[String(e.match_id)];
        const taps = l ? l.joy + l.hype + l.rage : 0;
        const score = (e.score_home != null && e.score_away != null) ? ' ' + e.score_home + '-' + e.score_away : '';
        push({ x: xy.x, y: xy.y, city: e.team || e.home || '', match: (e.home || '') + ' × ' + (e.away || ''),
            ev: T(d.ar, d.en) + (e.minute ? ' ' + e.minute + '’' : '') + score,
            mix: d.mix, fans: Math.max(3000, taps), age: age || 0, silent: !!age });
    }
    async function loadRecentEvents() {
        const c = sb();
        const since = new Date(Date.now() - 30 * 60000).toISOString();
        const r = await c.from('match_events').select('*').gte('created_at', since).order('created_at', { ascending: true }).limit(8);
        (r.data || []).forEach(e => onEvent(e, Date.now() - new Date(e.created_at).getTime()));
    }

    async function startLive() {
        const c = sb();
        try { await loadMatches(); await loadRecentEvents(); } catch (e) { console.warn('[radar] load failed', e); }
        renderChips();
        if (S.matches.length) selectMatch(S.matches[0].id);
        S.ch = c.channel('fan-pulse-' + Date.now())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'match_pulse' }, p => onPulseRow(p.new))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events' }, p => onEvent(p.new))
            .subscribe();
        S.timers.push(setInterval(flush, 1200));
        S.timers.push(setInterval(drainAcc, 1500));
        S.timers.push(setInterval(() => { loadMatches().then(renderChips).catch(() => {}); }, 120000)); // تحديث قائمة المباريات الجارية
    }
    function startDemo() {
        S.demo = true;
        const v = document.getElementById('fp-vote'); if (v) v.classList.add('off');
        for (let i = 0; i < 5; i++) simulate(i * 3500);
        S.timers.push(setInterval(() => simulate(0), 4500));
    }

    window.renderFanRadarPage = function (box) {
        stop();
        S.pulses = []; S.feed = []; S.sel = null; S.filt = 'all';
        S.last = {}; S.acc = {}; S.byId = {}; S.matches = []; S.curr = null; S.side = null; S.pend = { a: { joy: 0, hype: 0, rage: 0 }, b: { joy: 0, hype: 0, rage: 0 }, n: { joy: 0, hype: 0, rage: 0 } }; S.demo = false;
        const ar = isAr();
        box.innerHTML = `
        <style>
            .fp-wrap{direction:${window.zA('rtl', 'ltr')};color:#f4f6ff;padding:0 18px 10px}
            .fp-top{display:flex;align-items:center;gap:12px;padding:6px 0 0}
            .fp-back{width:42px;height:42px;border-radius:14px;border:1px solid rgba(245,195,90,.35);background:rgba(44,75,181,.22);color:#e8ecff;display:flex;align-items:center;justify-content:center;padding:0;flex:none;cursor:pointer}
            .fp-top h2{font-size:19px;font-weight:900;margin:0;line-height:1.2}
            .fp-live{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#9aa6d6}
            .fp-live i{width:8px;height:8px;border-radius:50%;background:#14f195;animation:fpb 1.2s infinite}
            .fp-live b{color:#fff}
            @keyframes fpb{50%{opacity:.25}}
            .fp-box{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:12px;margin-top:12px}
            .fp-mcard{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border:1px solid rgba(20,241,149,.4);border-radius:20px;padding:10px 12px;margin-top:12px}
            .fp-ml{font-size:11px;font-weight:900;color:#14f195}
            .fp-mrow{display:flex;align-items:center;justify-content:space-between;margin-top:6px;gap:8px;font-weight:900;font-size:14px}
            .fp-sc{font-weight:700;font-size:22px;color:#14f195;direction:ltr;letter-spacing:2px}
            .fp-chips2{display:flex;gap:8px;margin-top:8px;overflow-x:auto}
            .fp-chips{display:flex;gap:7px;margin-bottom:10px;overflow-x:auto}
            .fp-chip{flex:none;border:1px solid var(--c,#f5c35a);background:transparent;color:var(--c,#f5c35a);padding:5px 13px;border-radius:999px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer}
            .fp-chip[aria-pressed="true"]{background:var(--c,#f5c35a);color:#0a1033;font-weight:900}
            .fp-map{border-radius:14px;background:#070c2b;border:1px solid rgba(255,255,255,.06);overflow-x:auto;overflow-y:hidden}
            .fp-map canvas{display:block}
            .fp-detail{margin-top:10px;padding:9px 12px;border-radius:12px;background:rgba(0,0,0,.28);font-size:12px;color:#cfd8ff;line-height:1.7;border:1px solid transparent}
            .fp-detail strong{color:#fff}
            .fp-detail p{margin:2px 0 0}
            .fp-h{font-weight:900;font-size:15px;margin-bottom:8px}
            .fp-side{margin-top:14px}
            .fp-sidebtns{display:flex;gap:8px}
            .fp-sidebtn{flex:1;text-align:center;padding:11px 4px;border-radius:14px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#cfd8ff}
            .fp-sidebtn[aria-pressed="true"]{background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033;font-weight:900;border-color:transparent}
            .fp-vwrap{margin-top:14px}
            .fp-vote{display:flex;gap:10px}
            .fp-vote.off{opacity:.45;pointer-events:none}
            .fp-vbtn{flex:1;text-align:center;padding:14px 4px 12px;border-radius:18px;background:color-mix(in srgb,var(--c) 12%,transparent);border:1.5px solid color-mix(in srgb,var(--c) 55%,transparent);color:var(--c);font-family:inherit;font-weight:900;font-size:14px;cursor:pointer}
            .fp-vbtn span{display:block;font-size:28px;line-height:1;margin-bottom:6px}
            .fp-vbtn small{display:block;font-weight:600;color:#9aa6d6;font-size:10.5px;margin-top:2px}
            .fp-vbtn.hit{animation:fph .25s}
            @keyframes fph{50%{transform:scale(.92)}}
            .fp-card{margin-top:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:14px}
            .fp-card h3{font-size:15px;font-weight:900;margin:0 0 10px}
            .fp-bar{display:flex;height:14px;border-radius:99px;overflow:hidden}
            .fp-bar div{transition:width .8s}
            .fp-leg{display:flex;justify-content:space-between;margin-top:10px;font-size:12.5px;font-weight:800}
            .fp-leg b{font-size:17px}
            .fp-trow{margin-bottom:12px}
            .fp-trow .fp-bar{height:10px}
            .fp-tname{font-weight:900;font-size:13px;margin-bottom:6px}
            .fp-tname span{color:#9aa6d6;font-weight:600;font-size:11px;margin-inline-start:6px}
            .fp-trow .fp-leg{font-size:11px;font-weight:600;color:#9aa6d6;margin-top:5px}
            .fp-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,.07)}
            .fp-ic{width:36px;height:36px;border-radius:50%;background:rgba(245,195,90,.12);border:1px solid;display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}
            .fp-rt{flex:1;min-width:0}
            .fp-rt b{display:block;font-weight:900;font-size:13px}
            .fp-rt small{color:#9aa6d6;font-size:11.5px}
            .fp-row>span{color:#f5c35a;font-size:12px}
            .fp-empty{color:#9aa6d6;font-size:.85rem;flex:1}
        </style>
        <div class="fp-wrap">
            <div class="fp-top">
                <button class="fp-back" id="fp-back" aria-label="${T('رجوع', 'Back')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:${window.zA('none', 'scaleX(-1)')}"><path d="M9 6l6 6-6 6"/></svg></button>
                <div style="flex:1"><h2>${T('رادار نبض المشجعين', 'Fan Pulse Radar')}</h2>
                <div class="fp-live"><i></i>${T('مباشر', 'Live')} · <b id="fp-fans">0</b> ${T('تفاعل', 'reactions')}</div></div>
            </div>
            <div id="fp-matches"></div>
            <div class="fp-box">
                <div class="fp-chips" id="fp-chips">
                    <button class="fp-chip" data-f="all" aria-pressed="true">${T('الكل', 'All')}</button>
                    <button class="fp-chip" data-f="joy" style="--c:${COL.joy}" aria-pressed="false">${T('فرح', 'Joy')}</button>
                    <button class="fp-chip" data-f="hype" style="--c:${COL.hype}" aria-pressed="false">${T('حماس', 'Hype')}</button>
                    <button class="fp-chip" data-f="rage" style="--c:${COL.rage}" aria-pressed="false">${T('غضب', 'Anger')}</button>
                </div>
                <div class="fp-map" id="fp-map" dir="ltr"><canvas id="fp-canvas"></canvas></div>
                <div class="fp-detail" id="fp-detail"><strong>${T('اضغط على أي نبضة في الخريطة', 'Tap any pulse on the map')}</strong><p>${T('ستظهر تفاصيل الحدث ونسب مشاعر الجمهور.', 'See the event and the crowd’s emotion mix.')}</p></div>
            </div>
            <div class="fp-side" id="fp-side"></div>
            <div class="fp-vwrap">
                <div class="fp-h">${T('كيف تشعر الآن؟', 'How do you feel?')}</div>
                <div class="fp-vote off" id="fp-vote">
                    <button class="fp-vbtn" data-e="joy" style="--c:${COL.joy}"><span>😍</span>${T('فرح', 'Joy')}<small>${T('اضغط للتفاعل', 'tap to react')}</small></button>
                    <button class="fp-vbtn" data-e="hype" style="--c:${COL.hype}"><span>🔥</span>${T('حماس', 'Hype')}<small>${T('اضغط للتفاعل', 'tap to react')}</small></button>
                    <button class="fp-vbtn" data-e="rage" style="--c:${COL.rage}"><span>😡</span>${T('غضب', 'Anger')}<small>${T('اضغط للتفاعل', 'tap to react')}</small></button>
                </div>
            </div>
            <div class="fp-card">
                <h3>${T('مزاج الجماهير حول العالم الآن', 'Global fan mood right now')}</h3>
                <div class="fp-bar"><div id="fp-bj" style="background:${COL.joy}"></div><div id="fp-bh" style="background:${COL.hype}"></div><div id="fp-br" style="background:${COL.rage}"></div></div>
                <div class="fp-leg"><div style="color:${COL.joy}"><b id="fp-pj">0%</b> ${T('فرح', 'Joy')}</div><div style="color:${COL.hype}"><b id="fp-ph">0%</b> ${T('حماس', 'Hype')}</div><div style="color:${COL.rage}"><b id="fp-pr">0%</b> ${T('غضب', 'Anger')}</div></div>
            </div>
            <div class="fp-card"><h3>${T('مزاج جمهور كل فريق', 'Mood of each team’s fans')}</h3><div id="fp-teams-body"></div></div>
            <div class="fp-card" style="padding-bottom:4px"><h3 style="margin-bottom:6px">${T('آخر الأحداث', 'Latest events')}</h3><div id="fp-feed"></div></div>
            <div style="height:20px"></div>
        </div>`;
        const bk = document.getElementById('fp-back'); if (bk) bk.onclick = () => { stop(); window.showPage('home'); };

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
            const b = e.target.closest('#fp-chips .fp-chip'); if (!b) return;
            S.filt = b.dataset.f;
            document.querySelectorAll('#fp-chips .fp-chip').forEach(c => c.setAttribute('aria-pressed', c === b));
        });

        box.querySelectorAll('.fp-vbtn').forEach(b => b.addEventListener('click', () => tap(b.dataset.e, b)));
        if (sb()) startLive(); else startDemo();
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
