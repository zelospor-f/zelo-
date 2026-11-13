window.escapeHTML = str => str ? String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t)) : '';

// ترجمة آمنة: إن لم يوجد المفتاح في i18n (يرجع المفتاح نفسه) نستخدم النص الاحتياطي بدل ظهور "fansLabel"
function lbTr(key, ar, en, params) {
    if (window.tr) return window.tr(key, ar, en, params);   // من i18n-helpers.js
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    return String(isAr ? ar : en).replace(/\{(\w+)\}/g, (m, p) => (params && params[p] !== undefined) ? params[p] : m);
}

// شعار عملة ZELO (ملف محلي، وإن لم يوجد يُحمَّل من GitHub)
const LB_COIN_IMG = `<img class="coin" src="zelo-coin.png" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png';}else{this.style.display='none';}">`;

// رابط صورة آمن فقط (http/https/data:image)
function lbSafePhoto(url) {
    url = String(url || '').trim();
    return /^(https?:\/\/|data:image\/)/i.test(url) ? url : '';
}

/* ===========================================================
   شاشة «المتصدرون»: تبويبان — الأندية | التحديات
   تفتح من دائرة المتصدرين في صفحة المباريات
   =========================================================== */
(function () {
    const isAr = () => (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const L = (ar, en) => isAr() ? ar : en;
    const esc = s => window.escapeHTML(s);
    const COIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5c35a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9 9h6l-6 6h6"/></svg>';
    const MED = [
        { c: '#c9d3e6', m: '🥈', size: 46, h: 70 },   // الثاني (يسار)
        { c: '#f5c35a', m: '👑', size: 56, h: 104 },  // الأول (وسط)
        { c: '#cd7f32', m: '🥉', size: 44, h: 54 }    // الثالث
    ];
    let box = null, tab = 'clubs';
    const num = n => Number(n || 0).toLocaleString('en-US');

    function css() {
        if (document.getElementById('ldr-css')) return;
        const st = document.createElement('style');
        st.id = 'ldr-css';
        st.textContent = `
        .ldr{padding-bottom:110px;color:#f4f6ff}
        .ldr-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .ldr-title{flex:1;font-weight:900;font-size:1.3rem}
        .ldr-tabs{display:flex;padding:4px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);margin-bottom:14px}
        .ldr-tabs div{flex:1;text-align:center;padding:9px 0;border-radius:999px;color:#9aa6d6;font-weight:800;font-size:.9rem;cursor:pointer}
        .ldr-tabs div.on{background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033;font-weight:900}
        .ldr-pod{display:flex;align-items:flex-end;gap:8px;margin-bottom:12px;min-height:196px}
        .ldr-p{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;justify-content:flex-end;cursor:pointer}
        .ldr-av{border-radius:50%;background:#0a1033;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;position:relative;font-weight:900;color:#fff}
        .ldr-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .ldr-av.logo img{object-fit:contain;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px)}
        .ldr-pn{font-weight:900;font-size:.8rem;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
        .ldr-pb{width:100%;border-radius:16px 16px 0 0;border-bottom:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
        .ldr-pb b{font-weight:900;font-size:.95rem;direction:ltr}
        .ldr-pb small{font-size:.65rem;color:#9aa6d6}
        .ldr-r{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;cursor:pointer}
        .ldr-r.me{background:linear-gradient(135deg,rgba(245,195,90,.16),rgba(44,75,181,.2));border-color:#f5c35a}
        .ldr-rk{width:30px;text-align:center;font-weight:900;font-size:.95rem;color:#9aa6d6;flex:none}
        .ldr-nm{flex:1;min-width:0}
        .ldr-nm b{display:block;font-weight:900;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ldr-chip{display:inline-block;margin-top:3px;padding:1px 8px;border-radius:7px;font-size:.68rem;font-weight:700;color:#ffd98a;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.25)}
        .ldr-me{margin-top:3px;font-size:.68rem;font-weight:900;color:#f5c35a}
        .ldr-pt{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:12px;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.4);font-weight:900;font-size:.85rem;color:#f5c35a;direction:ltr;flex:none}
        .ldr-wk{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-radius:14px;background:rgba(44,75,181,.25);border:1px solid rgba(245,195,90,.35);margin-bottom:12px;font-size:.8rem}
        .ldr-bar{position:fixed;left:12px;right:12px;bottom:var(--ldr-bot,80px);z-index:60;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:18px;background:linear-gradient(135deg,rgba(245,195,90,.22),rgba(44,75,181,.3)),#0a1033;border:1px solid #f5c35a;box-shadow:0 -8px 24px rgba(0,0,0,.35)}
        .ldr-empty{text-align:center;color:#9aa6d6;padding:40px 10px;font-weight:800}
        `;
        document.head.appendChild(st);
    }

    function avatar(url, ini, size, col, logo) {
        const u = lbSafePhoto(url);
        return `<span class="ldr-av ${logo ? 'logo' : ''}" style="width:${size}px;height:${size}px;border:2px solid ${col};font-size:${Math.round(size * .4)}px">${esc(ini)}${u ? `<img src="${esc(u)}" alt="" onerror="this.remove()">` : ''}</span>`;
    }

    // items: [{key,name,sub,pts,photo,logo,me,click}]
    function podiumHtml(items) {
        if (!items.length) return '';
        const order = [items[1], items[0], items[2]];   // 2 - 1 - 3
        return `<div class="ldr-pod">${order.map((it, k) => {
            if (!it) return '<div class="ldr-p"></div>';
            const md = MED[k];
            return `<div class="ldr-p" ${it.click ? `onclick="${it.click}"` : ''}>
                <div style="font-size:${k === 1 ? 22 : 18}px">${md.m}</div>
                ${avatar(it.photo, String(it.name || '?').trim().charAt(0).toUpperCase(), md.size, md.c, it.logo)}
                <div class="ldr-pn">${esc(it.name)}</div>
                <div class="ldr-pb" style="height:${md.h}px;background:linear-gradient(180deg,${md.c}33,${md.c}0d);border:1px solid ${md.c}66"><b style="color:${md.c}">${num(it.pts)}</b><small>${esc(it.unit)}</small></div></div>`;
        }).join('')}</div>`;
    }
    function rowsHtml(items, from) {
        return items.map((it, i) => `<div class="ldr-r ${it.me ? 'me' : ''}" ${it.click ? `onclick="${it.click}"` : ''}>
            <div class="ldr-rk">#${from + i}</div>
            ${avatar(it.photo, String(it.name || '?').trim().charAt(0).toUpperCase(), 40, '#9fb2ff', it.logo)}
            <div class="ldr-nm"><b>${esc(it.name)}</b>${it.me ? `<div class="ldr-me">⭐ ${esc(it.meText)}</div>` : (it.sub ? `<span class="ldr-chip">${esc(it.sub)}</span>` : '')}</div>
            <div class="ldr-pt">${num(it.pts)}${COIN}</div></div>`).join('');
    }

    async function clubsData() {
        let clubPts = {}, clubMem = {}, myClub = null, myPts = 0;
        const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
        if (c) {
            const { data } = await c.from('club_fans_rankings').select('user_id, club_id, total_fan_points');
            (data || []).forEach(f => {
                if (typeof userState !== 'undefined' && userState?.userId && String(f.user_id) === String(userState.userId)) { myClub = f.club_id; myPts = f.total_fan_points || 0; }
                clubPts[f.club_id] = (clubPts[f.club_id] || 0) + (f.total_fan_points || 0);
                clubMem[f.club_id] = (clubMem[f.club_id] || 0) + 1;
            });
        }
        let flat = [];
        if (typeof allWorldCupCountriesClubs !== 'undefined') Object.values(allWorldCupCountriesClubs).forEach(a => flat.push(...a));
        const list = flat.filter(x => clubMem[x.id] > 0)
            .map(x => ({ club: x, pts: clubPts[x.id] || 0, mem: clubMem[x.id] || 0 }))
            .sort((a, b) => (b.pts - a.pts) || (b.mem - a.mem)).slice(0, 100);
        const items = list.map((o, i) => ({
            name: typeof getClubName === 'function' ? getClubName(o.club) : o.club.name,
            sub: `👥 ${num(o.mem)} ${lbTr('fansLabel', 'مشجع', 'Fans')}`,
            pts: o.pts, photo: o.club.logo, logo: true, unit: L('نقطة', 'pts'),
            me: o.club.id === myClub, meText: `${lbTr('yourClub', 'ناديك', 'Your club')} · ${lbTr('yourPts', 'نقاطك', 'Your points')}: ${num(myPts)}`,
            click: `window.openSpecificClubFans('${String(o.club.id).replace(/'/g, '')}')`
        }));
        const mine = items.findIndex(x => x.me);
        return { items, barRank: mine >= 0 ? mine + 1 : null, bar: mine >= 0 ? `${lbTr('yourClub', 'ناديك', 'Your club')}: ${items[mine].name}` : '', barSub: mine >= 0 ? `${lbTr('yourPts', 'نقاطك', 'Your points')}: ${num(myPts)}` : '', barPts: mine >= 0 ? items[mine].pts : 0 };
    }

    async function challengesData() {
        const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
        let rows = [];
        const uid = (typeof userState !== 'undefined' && userState?.userId) ? String(userState.userId) : '';
        if (c) {
            const r = await c.from('weekly_match_rankings').select('user_id,username,photo_url,points_earned')
                .eq('is_eliminated', false).eq('category', 'weekly').order('points_earned', { ascending: false }).limit(50);
            rows = r.data || [];
            try {
                const ids = [...new Set(rows.map(x => String(x.user_id)))];
                if (ids.length) {
                    const pp = await c.from('public_profiles').select('user_id,photo_url').in('user_id', ids);
                    const m = {}; (pp.data || []).forEach(x => { if (x.photo_url) m[String(x.user_id)] = x.photo_url; });
                    rows = rows.map(x => ({ ...x, photo_url: m[String(x.user_id)] || x.photo_url }));
                }
            } catch (e) {}
        }
        const anon = L('مستخدم', 'User');
        const items = rows.map(x => ({
            name: x.username || anon, sub: '', pts: x.points_earned || 0, photo: x.photo_url, unit: L('نقطة', 'pts'),
            me: uid && String(x.user_id) === uid, meText: L('أنت', 'You')
        }));
        const mine = items.findIndex(x => x.me);
        return { items, barRank: mine >= 0 ? mine + 1 : null, bar: L('مركزك في التحدّي', 'Your rank'), barSub: '', barPts: mine >= 0 ? items[mine].pts : 0 };
    }

    async function draw() {
        if (!box) return;
        css();
        const holder = document.getElementById('ldr-body');
        if (holder) holder.innerHTML = `<div class="ldr-empty">⏳ ${L('جاري التحميل...', 'Loading...')}</div>`;
        let d;
        try { d = tab === 'clubs' ? await clubsData() : await challengesData(); }
        catch (e) { console.error('Leaders error:', e); if (holder) holder.innerHTML = `<div class="ldr-empty">${L('تعذّر تحميل البيانات', 'Could not load data')}</div>`; return; }
        const h = document.getElementById('ldr-body');
        if (!h) return;
        const wk = tab === 'challenges' ? `<div class="ldr-wk"><b>${L('تحدّي هذا الأسبوع', "This week's challenge")}</b></div>` : '';
        h.innerHTML = d.items.length
            ? wk + podiumHtml(d.items.slice(0, 3)) + rowsHtml(d.items.slice(3), 4)
            : `<div class="ldr-empty">${tab === 'clubs' ? lbTr('noClubsYet', 'لا توجد أندية بعد. كن أول من يختار ناديه!', 'No clubs yet. Be the first to pick yours!') : L('لا توجد نتائج هذا الأسبوع بعد', 'No results this week yet')}</div>`;
        document.getElementById('ldr-bar')?.remove();
        if (d.barRank) {
            const nav = document.getElementById('bottom-nav');
            const navH = (nav && nav.getBoundingClientRect().height > 0) ? Math.round(window.innerHeight - nav.getBoundingClientRect().top) : 0;
            const bar = document.createElement('div');
            bar.id = 'ldr-bar'; bar.className = 'ldr-bar'; bar.style.setProperty('--ldr-bot', (navH + 8) + 'px');
            bar.style.direction = isAr() ? 'rtl' : 'ltr';
            bar.innerHTML = `<div style="font-weight:900;font-size:1rem;color:#ffe7ad;width:34px;text-align:center">#${d.barRank}</div>
                <div style="flex:1;min-width:0"><div style="font-weight:900;font-size:.9rem">${esc(d.bar)}</div>${d.barSub ? `<div style="font-size:.72rem;color:#cfd8ff">${esc(d.barSub)}</div>` : ''}</div>
                <div class="ldr-pt" style="background:none;border:0;padding:0">${num(d.barPts)}${COIN}</div>`;
            document.body.appendChild(bar);
        }
    }

    function shell() {
        box.innerHTML = `<div class="ldr">
            <div class="ldr-head">${window.zeloBackBtn ? window.zeloBackBtn("window.closeLeaders()", isAr()) : ''}<div class="ldr-title">${L('المتصدرون', 'Leaders')}</div></div>
            <div class="ldr-tabs"><div class="${tab === 'clubs' ? 'on' : ''}" onclick="window.ldrTab('clubs')">${L('الأندية', 'Clubs')}</div><div class="${tab === 'challenges' ? 'on' : ''}" onclick="window.ldrTab('challenges')">${L('التحديات', 'Challenges')}</div></div>
            <div id="ldr-body"></div></div>`;
    }

    window.renderLeaders = function (container, which) {
        box = container || document.getElementById('main-content');
        if (!box) return;
        if (which) tab = which;
        css();
        box.style.direction = isAr() ? 'rtl' : 'ltr';
        shell();
        draw();
    };
    window.ldrTab = function (t) { tab = t; shell(); draw(); };
    window.openLeaders = function (which) { window.renderLeaders(document.getElementById('main-content'), which || 'clubs'); };
    window.closeLeaders = function () {
        document.getElementById('ldr-bar')?.remove();
        if (typeof window.showPage === 'function') window.showPage('points');
    };
    // الصفحة القديمة (showPage('leaderboard')) تفتح الشاشة الجديدة
    window.renderLeaderboardPage = function (container) { window.renderLeaders(container, 'clubs'); };

    // إزالة الشريط السفلي عند مغادرة الشاشة
    document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('#bottom-nav')) document.getElementById('ldr-bar')?.remove();
    }, true);

})();

window.openSpecificClubFans = async function(clubId) {
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    let club = null;

    if (typeof allWorldCupCountriesClubs !== 'undefined') {
        Object.values(allWorldCupCountriesClubs).some(country => club = country.find(c => c.id === clubId));
    }

    if (!club) return;

    const contentDiv = document.getElementById("main-content");
    const clubNameStr = typeof getClubName === 'function' ? getClubName(club) : club.name;

    contentDiv.innerHTML = `<style>@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }</style>
    <div style="text-align:center; padding:40px; color:#f5c35a; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
        ${lbTr('loadingFans', '⏳ جاري استدعاء أبطال {club}...', '⏳ Fetching {club} fans...', { club: clubNameStr })}
    </div>`;

    try {
        let fansTableRows = "";

        if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
            const { data: fansList } = await supabaseClient
                .from('club_fans_rankings')
                .select('user_id, total_fan_points, referrals_count')
                .eq('club_id', clubId)
                .order('total_fan_points', { ascending: false })
                .limit(100);

            if (fansList?.length) {
                const currentUserId = userState?.userId;
                const badges = ['👑', '🥈', '🥉'];

                // الصور الحقيقية من الملف الشخصي (نفس المصدر الذي تستخدمه صفحة المتابعين)
                const profiles = {};
                try {
                    const ids = fansList.map(f => String(f.user_id));
                    const pr = await supabaseClient.from('public_profiles').select('user_id, photo_url, username').in('user_id', ids);
                    (pr.data || []).forEach(p => profiles[String(p.user_id)] = p);
                } catch (e) {}

                fansTableRows = fansList.map((fan, idx) => {
                    const isMe = String(fan.user_id) === String(currentUserId);
                    const prof = profiles[String(fan.user_id)] || {};
                    const uname = prof.username || (isMe ? (userState?.username || '') : '');
                    const safeName = window.escapeHTML(uname);
                    const photo = lbSafePhoto(prof.photo_url || (isMe ? userState?.photoUrl : ''));
                    const initial = window.escapeHTML((uname || '?').charAt(0).toUpperCase());
                    const nameHtml = uname ? '@' + safeName : lbTr('anonymousFan', 'مشجع مجهول', 'Anonymous Fan');

                    return `
                    <div class="fan-row ${isMe ? 'me-row' : ''} ${idx < 3 ? 'top-' + (idx + 1) : ''}">
                        <div class="fan-rank">${badges[idx] || `#${idx + 1}`}</div>
                        <div class="fan-info">
                            <span class="fan-av">
                                <span class="fan-av-ph">${initial}</span>
                                ${photo ? `<img src="${window.escapeHTML(photo)}" alt="" onerror="this.remove()">` : ''}
                            </span>
                            <span class="fan-name">${nameHtml}</span>
                            ${isMe ? `<span class="you-badge">${lbTr('youLabel', 'أنت', 'You')}</span>` : ''}
                        </div>
                        <div class="fan-stats">
                            <div class="fan-pts"><span>${(fan.total_fan_points || 0).toLocaleString('en-US')}</span>${LB_COIN_IMG}</div>
                            <div class="stat-ref"><span>${(fan.referrals_count || 0).toLocaleString('en-US')}</span> 👥</div>
                        </div>
                    </div>`;
                }).join('');
            } else {
                fansTableRows = `<div class="empty-box">
                    ${lbTr('noFansYet', 'لا يوجد مشجعين مسجلين في هذا النادي حتى الآن. كن أنت الأول! 🚀', 'No fans registered for this club yet. Be the first! 🚀')}
                </div>`;
            }
        }

        contentDiv.innerHTML = `
            <style>
                .btn-back-compact {
                    background: rgba(255,255,255,0.08); color: #f5c35a;
                    border: 1px solid rgba(245, 195, 90,0.25);
                    padding: 8px 16px; border-radius: 20px;
                    font-weight: 800; font-size: 0.82rem; cursor: pointer;
                    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
                }
                .club-hero-banner {
                    background: linear-gradient(135deg, rgba(17, 26, 74, 0.95), rgba(10, 16, 51, 0.95));
                    border-radius: 18px; padding: 14px;
                    display: flex; align-items: center; gap: 12px;
                    border: 1px solid rgba(245, 195, 90, 0.3);
                    box-shadow: 0 0 14px rgba(245, 195, 90, 0.1);
                    margin-bottom: 16px;
                }
                .club-hero-logo {
                    width: 56px; height: 56px; min-width: 56px; border-radius: 14px;
                    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                }
                .fan-row {
                    direction: ltr;
                    display: flex; justify-content: space-between; align-items: center; gap: 10px;
                    background: linear-gradient(135deg, rgba(17, 26, 74, 0.95), rgba(10, 16, 51, 0.95));
                    border: 1px solid rgba(44, 75, 181, 0.3);
                    border-radius: 18px; padding: 10px 14px; margin-bottom: 10px;
                    box-shadow: 0 0 10px rgba(80, 100, 255, 0.1);
                }
                .fan-row.top-1 { border-color: rgba(255,215,0,0.4); }
                .fan-row.top-2 { border-color: rgba(192,192,192,0.35); }
                .fan-row.top-3 { border-color: rgba(205,127,50,0.35); }
                .me-row {
                    border: 1px solid rgba(74, 108, 255, 0.6);
                    background: linear-gradient(135deg, rgba(74, 108, 255, 0.2), rgba(44, 75, 181, 0.15));
                    box-shadow: 0 0 14px rgba(74, 108, 255, 0.25);
                }
                .fan-rank { font-size: 1.1rem; font-weight: 900; width: 32px; text-align: center; font-family: monospace; flex-shrink: 0; color: #94a3b8; }
                .fan-info { flex-grow: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
                .fan-av {
                    position: relative; width: 38px; height: 38px; min-width: 38px; border-radius: 50%;
                    overflow: hidden; border: 1.5px solid rgba(255,255,255,0.18); background: #0a1033;
                }
                .fan-av img, .fan-av-ph { position: absolute; inset: 0; width: 100%; height: 100%; }
                .fan-av img { object-fit: cover; }
                .fan-av-ph {
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1rem; font-weight: 900; color: #fff;
                    background: linear-gradient(135deg, #4a6cff, #2c4bb5);
                }
                .fan-name { color: #fff; font-weight: 800; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; }
                .you-badge {
                    font-size: 0.66rem; background: linear-gradient(135deg, #4a6cff, #2c4bb5);
                    color: #fff; padding: 2px 8px; border-radius: 8px; font-weight: 800; flex-shrink: 0;
                }
                .fan-stats { text-align: end; flex-shrink: 0; }
                .fan-pts {
                    display: flex; align-items: center; justify-content: flex-end; gap: 6px; direction: ltr;
                    color: #f5c35a; font-size: 1.1rem; font-weight: 900; letter-spacing: 1px;
                    font-variant-numeric: tabular-nums;
                }
                .fan-pts .coin { width: 20px; height: 20px; object-fit: contain; display: block; flex-shrink: 0; }
                .stat-ref { color: #94a3b8; font-size: 0.8rem; font-weight: 700; margin-top: 3px; direction: ltr; }
                .empty-box {
                    text-align: center; padding: 30px; color: #94a3b8;
                    background: rgba(17, 26, 74, 0.8); border-radius: 16px;
                    border: 1px solid rgba(44, 75, 181, 0.3); font-size: 0.85rem; font-weight: bold;
                }
            </style>

            ${window.zeloBackBtn("window.openLeaders('clubs')")}

            <div class="club-hero-banner">
                <div class="club-hero-logo">
                    <img src="${club.logo}" onerror="this.style.display='none'" style="width: 40px; height: 40px; object-fit: contain;">
                </div>
                <div>
                    <h3 style="margin: 0; color: #fff; font-weight: 900; font-size: 1.1rem;">
                        ${lbTr('topFansOf', 'أبطال {club}', 'Top Fans of {club}', { club: clubNameStr })}
                    </h3>
                    <p style="color: #f5c35a; font-size: 0.8rem; font-weight: 700; margin: 4px 0 0 0;">
                        ${lbTr('topFansSub', 'تنافس لتكون المشجع الأول لناديك!', 'Compete to be the #1 fan for your club!')} 🚀
                    </p>
                </div>
            </div>

            <div class="fans-list-container">${fansTableRows}</div>
            <div style="height: 20px;"></div>`;
    } catch (error) {
        console.error("Club details error:", error);
    }
};


/* ===========================================================
   شاشة الترتيب: جدول الدوري + الهدّافون (تفتح من دائرة "الترتيب")
   البيانات من جدولي standings و scorers في Supabase
   =========================================================== */
(function () {
    const LEAGUES = [
        { code: 'PD',  ar: 'الدوري الإسباني',     en: 'La Liga',          top: 4, mid: 1, bot: 3 },
        { code: 'PL',  ar: 'الدوري الإنجليزي',    en: 'Premier League',   top: 4, mid: 1, bot: 3 },
        { code: 'SA',  ar: 'الدوري الإيطالي',     en: 'Serie A',          top: 4, mid: 1, bot: 3 },
        { code: 'BL1', ar: 'الدوري الألماني',     en: 'Bundesliga',       top: 4, mid: 1, bot: 2 },
        { code: 'FL1', ar: 'الدوري الفرنسي',      en: 'Ligue 1',          top: 3, mid: 1, bot: 2 },
        { code: 'CL',  ar: 'دوري أبطال أوروبا',   en: 'Champions League', top: 8, mid: 16, bot: 12, cl: true },
        { code: 'PPL', ar: 'الدوري البرتغالي',    en: 'Primeira Liga',    top: 2, mid: 1, bot: 2 },
        { code: 'DED', ar: 'الدوري الهولندي',     en: 'Eredivisie',       top: 2, mid: 1, bot: 2 },
        { code: 'ELC', ar: 'تشامبيونشيب إنجلترا', en: 'Championship',     top: 2, mid: 4, bot: 3 },
        { code: 'BSA', ar: 'الدوري البرازيلي',    en: 'Brasileirão',      top: 4, mid: 2, bot: 4 }
    ];
    const KEY = 'zelo_league_last';
    let cur = 'PD', tab = 0;

    const isAr = () => (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const L = (ar, en) => isAr() ? ar : en;
    const esc = s => window.escapeHTML(s);
    const lg = () => LEAGUES.find(l => l.code === cur) || LEAGUES[0];
    const safeImg = u => lbSafePhoto(u);

    function crest(url, size) {
        const u = safeImg(url);
        return `<span style="width:${size}px;height:${size}px;flex:none;display:inline-flex;align-items:center;justify-content:center">${u ? `<img src="${esc(u)}" alt="" onerror="this.style.visibility='hidden'" style="width:100%;height:100%;object-fit:contain">` : ''}</span>`;
    }

    function css() {
        return `<style>
        .lgp{direction:${isAr() ? 'rtl' : 'ltr'};padding-bottom:20px;color:#f4f6ff}
        .lgp-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .lgp-back{width:42px;height:42px;border-radius:14px;border:1px solid rgba(245,195,90,.35);background:rgba(44,75,181,.22);color:#e8ecff;display:flex;align-items:center;justify-content:center;padding:0;flex:none;font-size:22px;cursor:pointer}
        .lgp-title{flex:1;font-weight:900;font-size:1.3rem}
        .lgp-pick{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;background:rgba(44,75,181,.25);border:1px solid rgba(245,195,90,.35);cursor:pointer;margin-bottom:12px}
        .lgp-pick b{flex:1;font-weight:900;font-size:1rem}
        .lgp-pick small{font-size:.72rem;color:#cfd8ff}
        .lgp-tabs{display:flex;padding:4px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);margin-bottom:12px}
        .lgp-tabs div{flex:1;text-align:center;padding:9px 0;border-radius:999px;color:#9aa6d6;font-weight:800;font-size:.9rem;cursor:pointer}
        .lgp-tabs div.on{background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033;font-weight:900}
        .lgp-box{padding:0 8px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
        .lgp-th,.lgp-tr{display:flex;align-items:center;box-sizing:border-box}
        .lgp-th{height:34px;font-size:.72rem;color:#9aa6d6;font-weight:800}
        .lgp-tr{height:46px;border-top:1px solid rgba(255,255,255,.06);position:relative}
        .lgp-z{position:absolute;inset-inline-start:0;top:6px;bottom:6px;width:4px;border-radius:4px}
        .lgp .c1{width:34px;text-align:center;flex:none}
        .lgp .c2{flex:1;display:flex;align-items:center;gap:9px;min-width:0}
        .lgp .c2 span.n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:800;font-size:.85rem}
        .lgp .c3{width:34px;text-align:center;flex:none}
        .lgp .c4{width:40px;text-align:center;flex:none;direction:ltr}
        .lgp .c5{width:40px;text-align:center;flex:none}
        .lgp .num{font-variant-numeric:tabular-nums;font-size:.82rem;color:#cfd8ff}
        .lgp .pts{font-weight:900;font-size:.95rem;color:#ffd98a}
        .lgp-leg{display:flex;flex-wrap:wrap;gap:8px 16px;padding:12px 4px}
        .lgp-leg div{display:flex;align-items:center;gap:6px;font-size:.7rem;color:#cfd8ff}
        .lgp-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}
        .lgp-sc{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);margin-bottom:8px}
        .lgp-sc.first{background:linear-gradient(135deg,rgba(245,195,90,.22),rgba(44,75,181,.28));border-color:#f5c35a}
        .lgp-sc .rk{width:24px;text-align:center;font-weight:900;font-size:.95rem}
        .lgp-sc .nm{font-weight:900;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .lgp-sc .tm{display:flex;align-items:center;gap:6px;font-size:.72rem;color:#9aa6d6;margin-top:3px}
        .lgp-sc .g{text-align:center;min-width:44px}
        .lgp-sc .g b{display:block;font-size:1.35rem;color:#f5c35a;line-height:1;font-weight:900}
        .lgp-sc .g small{font-size:.65rem;color:#9aa6d6}
        .lgp-sheet{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.6);display:flex;align-items:flex-end}
        .lgp-sheet>div{width:100%;max-height:70vh;overflow:auto;background:#0a1033;border-radius:22px 22px 0 0;border:1px solid rgba(245,195,90,.35);padding:14px 16px 24px;direction:${isAr() ? 'rtl' : 'ltr'}}
        .lgp-sheet .it{padding:13px 10px;border-radius:12px;font-weight:800;color:#f4f6ff;cursor:pointer}
        .lgp-sheet .it.on{background:rgba(245,195,90,.15);color:#ffd98a}
        .lgp-empty{text-align:center;padding:30px;color:#94a3b8;font-weight:800}
        </style>`;
    }

    function zoneColor(pos, total, l) {
        if (l.cl) {
            if (pos <= 8) return '#14f195';
            if (pos <= 24) return '#6aa8ff';
            return '#ff5a6e';
        }
        if (pos <= l.top) return '#14f195';
        if (pos <= l.top + l.mid && !(l.code === 'ELC' && false)) return '#6aa8ff';
        if (pos > total - l.bot) return '#ff5a6e';
        return 'transparent';
    }

    function legend(l) {
        const it = (c, t) => `<div><i style="background:${c}"></i>${t}</div>`;
        if (l.cl) return it('#14f195', L('مباشرة لدور الـ16', 'Last 16')) + it('#6aa8ff', L('الملحق', 'Play-offs')) + it('#ff5a6e', L('خروج', 'Out'));
        if (l.code === 'ELC') return it('#14f195', L('صعود مباشر', 'Promotion')) + it('#6aa8ff', L('ملحق الصعود', 'Play-offs')) + it('#ff5a6e', L('الهبوط', 'Relegation'));
        return it('#14f195', L('دوري الأبطال', 'Champions League')) + it('#6aa8ff', L('أوروبا', 'Europe')) + it('#ff5a6e', L('الهبوط', 'Relegation'));
    }

    async function load() {
        const root = document.getElementById('lgp-body');
        if (!root) return;
        root.innerHTML = `<div class="lgp-empty">${L('⏳ جاري التحميل...', '⏳ Loading...')}</div>`;
        const l = lg();
        try {
            if (tab === 0) {
                const { data } = await supabaseClient.from('standings').select('*').eq('competition_code', cur).order('position', { ascending: true });
                if (!data || !data.length) { root.innerHTML = `<div class="lgp-empty">${L('لا توجد بيانات لهذا الدوري بعد', 'No data for this league yet')}</div>`; return; }
                const rows = data.map(t => {
                    const gd = t.gd > 0 ? '+' + t.gd : String(t.gd ?? 0);
                    return `<div class="lgp-tr"><div class="lgp-z" style="background:${zoneColor(t.position, data.length, l)}"></div>
                        <div class="c1 num">${t.position}</div>
                        <div class="c2">${crest(t.crest, 26)}<span class="n">${esc(t.team_name)}</span></div>
                        <div class="c3 num">${t.played ?? 0}</div><div class="c4 num">${gd}</div><div class="c5 pts">${t.points ?? 0}</div></div>`;
                }).join('');
                root.innerHTML = `<div class="lgp-box"><div class="lgp-th"><div class="c1">#</div><div class="c2">${L('الفريق', 'Team')}</div><div class="c3">${L('لعب', 'P')}</div><div class="c4">${L('فرق', 'GD')}</div><div class="c5">${L('نقاط', 'Pts')}</div></div>${rows}</div><div class="lgp-leg">${legend(l)}</div>`;
            } else {
                const { data } = await supabaseClient.from('scorers').select('*').eq('competition_code', cur).order('goals', { ascending: false }).limit(20);
                if (!data || !data.length) { root.innerHTML = `<div class="lgp-empty">${L('لا توجد بيانات لهذا الدوري بعد', 'No data for this league yet')}</div>`; return; }
                const medal = ['#ffd98a', '#c9d3e6', '#d9965b'];
                root.innerHTML = data.map((p, i) => {
                    const col = medal[i] || '#9aa6d6';
                    const ast = (p.assists != null) ? ` · ${p.assists} ${L('تمريرة حاسمة', 'assists')}` : '';
                    return `<div class="lgp-sc ${i === 0 ? 'first' : ''}"><div class="rk" style="color:${col}">${i + 1}</div>
                        <div style="flex:1;min-width:0"><div class="nm">${esc(p.player_name)}</div><div class="tm">${crest(p.team_crest, 16)}<span>${esc(p.team_name)}${ast}</span></div></div>
                        <div class="g"><b>${p.goals ?? 0}</b><small>${L('هدف', 'goals')}</small></div></div>`;
                }).join('');
            }
        } catch (e) {
            console.error('League screen error:', e);
            root.innerHTML = `<div class="lgp-empty">${L('تعذّر تحميل البيانات', 'Could not load data')}</div>`;
        }
    }

    function draw() {
        const c = document.getElementById('main-content');
        if (!c) return;
        const l = lg();
        c.innerHTML = css() + `<div class="lgp">
            <div class="lgp-head"><button class="lgp-back" onclick="window.showPage('home')" aria-label="back">${isAr() ? '›' : '‹'}</button><div class="lgp-title">${L('الترتيب', 'Ranking')}</div></div>
            <div class="lgp-pick" onclick="window.lgpPick()"><b>${esc(L(l.ar, l.en))}</b><small>${L('تغيير الدوري', 'Change league')}</small><span style="color:#f5c35a">▾</span></div>
            <div class="lgp-tabs"><div class="${tab === 0 ? 'on' : ''}" onclick="window.lgpTab(0)">${L('الترتيب', 'Table')}</div><div class="${tab === 1 ? 'on' : ''}" onclick="window.lgpTab(1)">${L('الهدّافون', 'Top scorers')}</div></div>
            <div id="lgp-body"></div></div>`;
        load();
    }

    window.openLeagueTable = function () {
        try { const s = localStorage.getItem(KEY); if (s && LEAGUES.some(x => x.code === s)) cur = s; } catch (e) {}
        tab = 0;
        draw();
    };
    window.lgpTab = function (i) { tab = i; draw(); };
    window.lgpPick = function () {
        const old = document.getElementById('lgp-sheet'); if (old) old.remove();
        const d = document.createElement('div');
        d.id = 'lgp-sheet'; d.className = 'lgp-sheet';
        d.onclick = e => { if (e.target === d) d.remove(); };
        d.innerHTML = `<div>${LEAGUES.map(x => `<div class="it ${x.code === cur ? 'on' : ''}" data-c="${x.code}">${esc(L(x.ar, x.en))}</div>`).join('')}</div>`;
        d.querySelectorAll('.it').forEach(el => el.onclick = () => {
            cur = el.dataset.c;
            try { localStorage.setItem(KEY, cur); } catch (e) {}
            d.remove(); draw();
        });
        document.body.appendChild(d);
        if (!document.getElementById('lgp-sheet-css')) { /* الأنماط تأتي من css() */ }
    };
})();
