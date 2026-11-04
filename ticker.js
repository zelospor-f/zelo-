/* ticker.js — شريط الأخبار المتحرك في الشريط العلوي (من جدول matches فقط) */
(function () {
    'use strict';
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

    function build(rows) {
        const ar = isAr(), now = Date.now();
        const ed = new Date(); ed.setHours(23, 59, 59, 999); const eod = ed.getTime();
        const live = [], soon = [], done = [];
        rows.forEach(m => {
            const t = new Date(m.match_date).getTime();
            const a = esc(m.team_a), b = esc(m.team_b);
            if (m.status === 'FINISHED' && m.home_score != null && m.away_score != null) {
                if (now - t < 24 * 3600e3) done.push({ t, html: `<b>${ar ? 'انتهت' : 'FT'}</b>${a} ${m.home_score} - ${m.away_score} ${b}` });
            } else if (m.live_status && m.live_home != null && m.live_away != null) {
                live.push({ t, cls: 'live', html: `<b>${ar ? 'مباشر' : 'LIVE'}</b>${a} ${m.live_home} - ${m.live_away} ${b}` });
            } else if (m.status === 'NOT_STARTED' && t > now && t <= eod) {
                const hm = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                soon.push({ t, html: `<b>${ar ? 'الساعة' : 'at'} ${hm}</b>${a} × ${b}` });
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
