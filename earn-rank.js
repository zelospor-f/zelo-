/* earn-rank.js — شاشة «الترتيب العام» (الأندية + التحديات) من اختصار «الترتيب» في الرئيسية */
(function () {
    'use strict';
    const L = (a, e) => window.zT(a, e);
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = n => Number(n || 0).toLocaleString('en-US');
    const isAr = () => (typeof userState !== 'undefined' && userState && userState.lang === 'ar');
    const GOLD = '#f5c35a';

    const COIN = '<img src="zelo-coin.png" alt="" style="width:16px;height:16px;object-fit:contain;flex:none" onerror="if(!this.dataset.f){this.dataset.f=1;this.src=\'https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png\';}else{this.style.display=\'none\';}">';
    const CHEV = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;${window.zA ? window.zA('', 'transform:scaleX(-1);') : ''}"><path d="M15 5l-7 7 7 7"/></svg>`;

    function closeAll() {
        document.getElementById('zer-overlay')?.remove();
    }
    window.closeEarnRank = closeAll;

    function openOverlay() {
        closeAll();
        const ov = document.createElement('div');
        ov.id = 'zer-overlay';
        const nav = document.getElementById('bottom-nav');
        const navH = (nav && nav.getBoundingClientRect().height > 0) ? Math.round(window.innerHeight - nav.getBoundingClientRect().top) : 0;
        ov.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:${navH}px;z-index:450;background:radial-gradient(520px 420px at 85% -5%,#22369f 0%,#0a1033 70%),#0a1033;color:#fff;overflow-y:auto;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 24px;box-sizing:border-box;direction:${window.zA('rtl', 'ltr')};`;
        document.body.appendChild(ov);
        if (nav) {
            const onNav = () => { closeAll(); nav.removeEventListener('click', onNav, true); };
            nav.addEventListener('click', onNav, true);
        }
        return ov;
    }

    const header = (title, balance) => `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
            ${window.zeloBackBtn ? window.zeloBackBtn('window.closeEarnRank()', isAr()) : ''}
            <div style="flex:1;font-weight:900;font-size:1.25rem;">${title}</div>
            <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(245,195,90,.4);direction:ltr;">${COIN}<span style="font-weight:900;color:#ffd98a;font-variant-numeric:tabular-nums;">${fmt(balance)}</span></div>
        </div>`;

    /* ============================ الترتيب العام ============================ */
    let tab = 'clubs';

    function logoBox(club, size, col) {
        const img = club && club.logo ? `<img src="${esc(club.logo)}" alt="" style="width:${Math.round(size * 0.7)}px;height:${Math.round(size * 0.7)}px;object-fit:contain;" onerror="this.style.display='none'">` : '';
        return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#0a1033;border:2px solid ${col};display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;">${img}</div>`;
    }

    async function loadClubs() {
        const c = db();
        let pts = {}, mem = {}, myClub = null, myPts = 0;
        if (c) {
            const { data } = await c.from('club_fans_rankings').select('user_id, club_id, total_fan_points');
            (data || []).forEach(f => {
                if (typeof userState !== 'undefined' && userState && userState.userId && String(f.user_id) === String(userState.userId)) { myClub = f.club_id; myPts = f.total_fan_points || 0; }
                pts[f.club_id] = (pts[f.club_id] || 0) + (f.total_fan_points || 0);
                mem[f.club_id] = (mem[f.club_id] || 0) + 1;
            });
        }
        const all = [];
        if (typeof allWorldCupCountriesClubs !== 'undefined') Object.values(allWorldCupCountriesClubs).forEach(a => all.push(...a));
        const list = all.map(cl => ({ club: cl, points: pts[cl.id] || 0, members: mem[cl.id] || 0 }))
            .filter(x => x.members > 0)
            .sort((a, b) => (b.points - a.points) || (b.members - a.members))
            .slice(0, 100);
        return { list, myClub, myPts };
    }

    const cname = cl => (typeof getClubName === 'function' ? getClubName(cl) : cl.name);
    window.zerClub = function (id) { closeAll(); if (window.openSpecificClubFans) window.openSpecificClubFans(id); };

    function podCol(rank, x, h, col, size) {
        if (!x) return '<div style="flex:1;"></div>';
        const medal = { 1: '👑', 2: '🥈', 3: '🥉' }[rank];
        return `<div onclick="window.zerClub('${esc(x.club.id)}')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;justify-content:flex-end;cursor:pointer;min-width:0;">
            <div style="font-size:${rank === 1 ? 22 : 18}px;">${medal}</div>${logoBox(x.club, size, col)}
            <div style="font-weight:900;font-size:.78rem;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(cname(x.club))}</div>
            <div style="width:100%;height:${h}px;border-radius:16px 16px 0 0;background:linear-gradient(180deg,${col}33,${col}0d);border:1px solid ${col}66;border-bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                <div style="font-weight:900;font-size:.95rem;color:${col};direction:ltr;font-variant-numeric:tabular-nums;">${fmt(x.points)}</div>
                <div style="font-size:.65rem;color:#9aa6d6;">${L('كورة', 'Kora')}</div>
            </div></div>`;
    }

    function clubRow(x, i, d) {
        const me = x.club.id === d.myClub;
        const bg = me ? 'background:linear-gradient(135deg,rgba(245,195,90,.16),rgba(44,75,181,.2));border:1px solid ' + GOLD : 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)';
        const sub = me
            ? `<div style="margin-top:3px;font-size:.7rem;font-weight:900;color:${GOLD};">⭐ ${L('ناديك', 'Your club')} · ${L('نقاطك', 'Your points')} ${fmt(d.myPts)}</div>`
            : `<div style="display:inline-block;margin-top:3px;padding:1px 8px;border-radius:7px;font-size:.68rem;font-weight:700;color:#ffd98a;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.25);">👥 ${fmt(x.members)} ${L('مشجع', 'fans')}</div>`;
        return `<div ${me ? 'id="zer-me"' : ''} onclick="window.zerClub('${esc(x.club.id)}')" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:18px;${bg};margin-bottom:8px;cursor:pointer;">
            <div style="width:30px;text-align:center;font-weight:900;font-size:.95rem;color:#9aa6d6;flex:none;font-variant-numeric:tabular-nums;">#${i}</div>
            ${logoBox(x.club, 40, '#9fb2ff')}
            <div style="flex:1;min-width:0;"><div style="font-weight:900;font-size:.9rem;">${esc(cname(x.club))}</div>${sub}</div>
            <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:12px;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.4);font-weight:900;font-size:.88rem;color:${GOLD};direction:ltr;flex:none;font-variant-numeric:tabular-nums;">${fmt(x.points)}${COIN}</div>
        </div>`;
    }

    async function paintRanking() {
        const ov = document.getElementById('zer-overlay');
        if (!ov) return;
        const bal = (typeof userState !== 'undefined' && userState && Number(userState.points)) || 0;
        const seg = (k, label) => `<div onclick="window.zerTab('${k}')" style="flex:1;text-align:center;padding:9px 0;border-radius:999px;cursor:pointer;font-weight:${tab === k ? 900 : 800};font-size:.9rem;${tab === k ? `background:linear-gradient(135deg,#ffe7ad,${GOLD});color:#0a1033;` : 'color:#9aa6d6;'}">${label}</div>`;
        ov.innerHTML = `<div style="max-width:520px;margin:0 auto;">
            ${header(L('الترتيب العام', 'Ranking'), bal)}
            <div style="margin-bottom:14px;padding:4px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);display:flex;">${seg('clubs', L('الأندية', 'Clubs'))}${seg('challenges', L('التحديات', 'Challenges'))}</div>
            <div id="zer-body"><div style="text-align:center;color:#9aa6d6;padding:50px;">⏳</div></div>
        </div>`;
        const body = ov.querySelector('#zer-body');
        if (tab === 'challenges') {
            body.id = 'zer-players';
            if (typeof window.renderHomeRankingWidget === 'function') window.renderHomeRankingWidget('zer-players');
            return;
        }
        try {
            const d = await loadClubs();
            if (!document.getElementById('zer-overlay') || tab !== 'clubs') return;
            if (!d.list.length) { body.innerHTML = `<div style="text-align:center;color:#94a3b8;font-weight:800;padding:40px 10px;">${L('لا توجد أندية بعد. كن أول من يختار ناديه!', 'No clubs yet. Be the first to pick yours!')}</div>`; return; }
            const [a, b, c] = d.list;
            const pod = d.list.length >= 3 ? `<div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:14px;height:196px;direction:ltr;">${podCol(2, b, 70, '#c9d3e6', 46)}${podCol(1, a, 104, GOLD, 56)}${podCol(3, c, 54, '#cd7f32', 44)}</div>` : '';
            const rest = d.list.slice(d.list.length >= 3 ? 3 : 0).map((x, i) => clubRow(x, i + (d.list.length >= 3 ? 4 : 1), d)).join('');
            body.innerHTML = pod + rest;
            const me = body.querySelector('#zer-me');
            if (me && me.scrollIntoView) setTimeout(() => me.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
        } catch (e) {
            console.error('[ZELO] ranking:', e);
            body.innerHTML = `<div style="text-align:center;color:#ff6b6b;padding:40px;">${L('حدث خطأ في تحميل البيانات', 'Error loading data')}</div>`;
        }
    }

    window.zerTab = function (k) { if (k !== tab) { tab = k; paintRanking(); } };

    window.openGeneralRanking = function () {
        openOverlay();
        tab = 'clubs';
        paintRanking();
    };
})();
