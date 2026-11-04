/* ticker.js — شريط الأخبار المتحرك في الشريط العلوي (من جدول matches فقط) */
(function () {
    'use strict';
    const SHOW_LOGOS = false; // true لإظهار شعارات الأندية
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function inText(mins) {
        const ar = isAr();
        if (mins < 60) return ar ? `بعد ${Math.max(mins, 1)} دقيقة` : `in ${Math.max(mins, 1)} min`;
        const h = Math.round(mins / 60);
        if (ar) return h === 1 ? 'بعد ساعة' : (h === 2 ? 'بعد ساعتين' : `بعد ${h} ساعات`);
        return `in ${h} h`;
    }


    // شعارات الأندية: مطابقة اسم الفريق في جدول المباريات مع clubsData.js (إن لم يوجد شعار يُعرض الاسم فقط)
    const STOP = new Set(['fc','cf','sk','af','fk','sc','ac','as','cd','sd','ud','club','de','the','sv','bv','rb','ca','cs','fa','afc','ssc','us','ss']);
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join(' ');
    let logoMap = null;
    function logos() {
        if (logoMap) return logoMap;
        const m = {};
        try {
            if (typeof allWorldCupCountriesClubs !== 'undefined') {
                Object.values(allWorldCupCountriesClubs).forEach(list => list.forEach(c => {
                    if (c.logo && c.nameEn) m[norm(c.nameEn)] = c.logo;
                }));
            }
        } catch (e) {}
        logoMap = m; return m;
    }
    const logoCache = {};
    function logoFor(name) {
        const n = norm(name); if (!n) return '';
        if (n in logoCache) return logoCache[n];
        const m = logos(); let url = m[n] || '';
        if (!url) {
            let best = '';
            Object.keys(m).forEach(k => { if (k.length >= 6 && n.length >= 6 && (n.includes(k) || k.includes(n)) && k.length > best.length) best = k; });
            if (best) url = m[best];
        }
        return (logoCache[n] = url);
    }
    function team(name, right) {
        const u = SHOW_LOGOS ? logoFor(name) : '';
        const img = u ? `<img class="nt-logo" src="${esc(u)}" alt="" width="18" height="18" style="width:18px;height:18px;max-width:18px;max-height:18px;object-fit:contain;flex:none" onerror="this.style.display='none'">` : '';
        const nm = `<span class="nt-nm" dir="auto">${esc(name)}</span>`;
        return `<span class="nt-t">${right ? nm + img : img + nm}</span>`;
    }
    const item = (lab, A, mid, B) => `<b class="nt-lab" dir="auto">${lab}</b>${team(A, false)}<span class="nt-mid" dir="ltr">${mid}</span>${team(B, true)}`;
    (function css() {
        if (document.getElementById('nt-css')) return;
        const s = document.createElement('style'); s.id = 'nt-css';
        s.textContent = '.news-ticker .nt-item{display:inline-flex;align-items:center;gap:7px;direction:ltr;unicode-bidi:isolate;white-space:nowrap}' +
            '.news-ticker .nt-t{display:inline-flex;align-items:center;gap:5px;unicode-bidi:isolate}' +
            '.news-ticker .nt-lab{unicode-bidi:isolate;margin:0;color:#f5c35a;font-weight:900}.news-ticker .nt-item.live .nt-lab{color:#ff5d7a}' +
            '.news-ticker .nt-mid{color:#fff;font-weight:900;unicode-bidi:isolate}';
        document.head.appendChild(s);
    })();

    function build(rows) {
        const ar = isAr(), now = Date.now();
        const ed = new Date(); ed.setHours(23, 59, 59, 999); const eod = ed.getTime();
        const live = [], soon = [], done = [];
        rows.forEach(m => {
            const t = new Date(m.match_date).getTime();
            const a = m.team_a, b = m.team_b;
            if (m.status === 'FINISHED' && m.home_score != null && m.away_score != null) {
                if (now - t < 24 * 3600e3) done.push({ t, html: item(ar ? 'انتهت' : 'FT', a, m.home_score + ' - ' + m.away_score, b) });
            } else if (m.live_status && m.live_home != null && m.live_away != null) {
                live.push({ t, cls: 'live', html: item(ar ? 'مباشر' : 'LIVE', a, m.live_home + ' - ' + m.live_away, b) });
            } else if (m.status === 'NOT_STARTED' && t > now && t <= eod) {
                const hm = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                soon.push({ t, html: item((ar ? 'الساعة ' : 'at ') + hm, a, '×', b) });
            }
        });
        soon.sort((x, y) => x.t - y.t); done.sort((x, y) => y.t - x.t);
        return [...live, ...soon.slice(0, 12), ...done.slice(0, 6)];
    }

    function paint(items) {
        const tr = document.getElementById('nt-track');
        if (!tr) return;
        tr.dir = 'ltr';
        if (!items.length) {
            tr.className = 'nt-track static';
            tr.innerHTML = `<span class="nt-item"><b>ZELO SPORT</b>${isAr() ? 'أهلًا بك في عالم الكرة' : 'Welcome to the world of football'}</span>`;
            return;
        }
        tr.className = 'nt-track';
        const html = items.map(i => `<span class="nt-item ${i.cls || ''}">${i.html}</span>`).join('<span class="nt-sep">&#9679;</span>');
        tr.innerHTML = html;
        const len = tr.textContent.length;
        tr.style.setProperty('--nt-dur', Math.max(20, Math.round(len * 0.3) + 8) + 's');
    }

    let busy = false;
    async function refresh() {
        const c = db();
        if (!c || busy || document.hidden) return;
        busy = true;
        try {
            const from = new Date(Date.now() - 24 * 3600e3).toISOString();
            const to = new Date(Date.now() + 24 * 3600e3).toISOString();
            const { data, error } = await c.from('matches')
                .select('id,team_a,team_b,match_date,status,home_score,away_score,live_status,live_home,live_away')
                .gte('match_date', from).lte('match_date', to)
                .order('match_date', { ascending: true }).limit(60);
            if (!error) paint(build(data || []));
        } catch (e) { /* تجاهل */ } finally { busy = false; }
    }

    const wait = setInterval(() => {
        if (document.getElementById('nt-track') && db() && window.userState && window.userState.userId) {
            clearInterval(wait);
            refresh();
            setInterval(refresh, 60000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
        }
    }, 1500);
})();
