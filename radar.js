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
    function matchXY(m) {
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
        if (!ll) ll = find(m.team_a) || find(m.team_b) || [10, 30];
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
            (pr.data || []).forEach(x => { S.last[String(x.match_id)] = { joy: x.joy, hype: x.hype, rage: x.rage }; });
        }
    }

    function renderChips() {
        const el = document.getElementById('fp-matches'); if (!el) return;
        if (!S.matches.length) {
            el.innerHTML = `<div class="fp-empty">${T('لا توجد مباراة مباشرة الآن.', 'No live match right now.')}
                <button class="fp-chip" id="fp-demo">${T('عرض تجريبي', 'Demo mode')}</button></div>`;
            const d = document.getElementById('fp-demo'); if (d) d.onclick = startDemo;
            return;
        }
        el.innerHTML = S.matches.map(m => `<button class="fp-chip" data-m="${m.id}" aria-pressed="${String(m.id) === String(S.curr)}">${m.team_a} × ${m.team_b}</button>`).join('');
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => selectMatch(b.dataset.m));
    }
    function selectMatch(id) {
        S.curr = String(id);
        renderChips();
        const v = document.getElementById('fp-vote'); if (v) v.classList.remove('off');
    }

    // ضغطة المشجع: تُجمَّع ثم تُرسل كل ~1.2 ثانية (الحد الأقصى 20 لكل إرسال حسب cast_pulse)
    function tap(emotion, btn) {
        if (!S.curr) return toast(T('اختر مباراة مباشرة أولاً', 'Pick a live match first'));
        S.pend[emotion]++;
        if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
        try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    }
    let flushErr = false;
    async function flush() {
        const c = sb(), n = S.pend;
        if (!c || !S.curr || n.joy + n.hype + n.rage === 0) return;
        S.pend = { joy: 0, hype: 0, rage: 0 };
        try {
            const { error } = await c.rpc('cast_pulse', { p_match: S.curr, p_joy: n.joy, p_hype: n.hype, p_rage: n.rage });
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
        const id = String(row.match_id), prev = S.last[id];
        S.last[id] = { joy: row.joy, hype: row.hype, rage: row.rage };
        if (!prev) return;
        const a = S.acc[id] || (S.acc[id] = { joy: 0, hype: 0, rage: 0 });
        ['joy', 'hype', 'rage'].forEach(k => { a[k] += Math.max(0, row[k] - prev[k]); });
    }
    function drainAcc() {
        Object.keys(S.acc).forEach(id => {
            const a = S.acc[id], sum = a.joy + a.hype + a.rage;
            if (!sum) return;
            S.acc[id] = { joy: 0, hype: 0, rage: 0 };
            const m = S.byId[id]; if (!m) return;
            const mix = { joy: Math.round(a.joy / sum * 100), hype: Math.round(a.hype / sum * 100), rage: Math.round(a.rage / sum * 100) };
            const xy = matchXY(m);
            push({ x: xy.x, y: xy.y, city: m.team_a, match: m.team_a + ' × ' + m.team_b,
                ev: T('تفاعل الجماهير', 'Fan reaction'), mix, fans: sum, silent: true });
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
        S.last = {}; S.acc = {}; S.byId = {}; S.matches = []; S.curr = null; S.pend = { joy: 0, hype: 0, rage: 0 }; S.demo = false;
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
            .fp-matches{display:flex;gap:8px;margin-bottom:10px;overflow-x:auto;align-items:center}
            .fp-empty{color:#98a2d6;font-size:.85rem;display:flex;gap:10px;align-items:center}
            .fp-vote{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
            .fp-vote.off{opacity:.4;pointer-events:none}
            .fp-vbtn{border:1px solid var(--c);background:rgba(17,26,74,.9);color:#fff;border-radius:16px;padding:14px 4px;font-size:1rem;font-weight:900;font-family:inherit;cursor:pointer;box-shadow:0 0 14px -4px var(--c)}
            .fp-vbtn small{display:block;font-weight:600;color:#98a2d6;font-size:.7rem;margin-top:2px}
            .fp-vbtn.hit{animation:fph .25s}
            @keyframes fph{50%{transform:scale(.92);background:var(--c)}}
            .fp-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:8px}
        </style>
        <div class="fp-wrap">
            <div class="fp-head"><div><h2>📡 ${T('رادار نبض المشجعين', 'Fan Pulse Radar')}</h2>
                <div class="fp-live"><i></i>${T('مباشر', 'Live')} · <span id="fp-fans">0</span> ${T('تفاعل', 'reactions')}</div></div></div>
            <div class="fp-chips" id="fp-chips">
                <button class="fp-chip" data-f="all" aria-pressed="true">${T('الكل', 'All')}</button>
                <button class="fp-chip" data-f="joy" style="--c:${COL.joy}" aria-pressed="false">${T('فرح', 'Joy')}</button>
                <button class="fp-chip" data-f="hype" style="--c:${COL.hype}" aria-pressed="false">${T('حماس', 'Hype')}</button>
                <button class="fp-chip" data-f="rage" style="--c:${COL.rage}" aria-pressed="false">${T('غضب', 'Anger')}</button>
            </div>
            <div class="fp-matches" id="fp-matches"></div>
            <div class="fp-map" id="fp-map" dir="ltr"><canvas id="fp-canvas"></canvas></div>
            <div class="fp-vote off" id="fp-vote">
                <button class="fp-vbtn" data-e="joy" style="--c:${COL.joy}">😍 ${T('فرح', 'Joy')}<small>${T('اضغط للتفاعل', 'tap to react')}</small></button>
                <button class="fp-vbtn" data-e="hype" style="--c:${COL.hype}">🔥 ${T('حماس', 'Hype')}<small>${T('اضغط للتفاعل', 'tap to react')}</small></button>
                <button class="fp-vbtn" data-e="rage" style="--c:${COL.rage}">😡 ${T('غضب', 'Anger')}<small>${T('اضغط للتفاعل', 'tap to react')}</small></button>
            </div>
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
