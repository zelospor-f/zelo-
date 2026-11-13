/* ============================================================
 * search.js — شاشة البحث (فرق + لاعبون)
 * - window.openSearchScreen()  يفتح الشاشة (أيقونة البحث في الصفحة الرئيسية)
 * - الفرق: من ملف الأندية allWorldCupCountriesClubs (عربي + إنجليزي) → تفتح جمهور النادي
 * - اللاعبون: من دالة قاعدة البيانات search_users → تفتح الملف الشخصي
 * ============================================================ */
(function () {
    'use strict';

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => window.zT(ar, en);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = id => document.getElementById(id);
    const sdb = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;

    const CSS = `
        .zsr { position:fixed; inset:0; z-index:2600; display:flex; flex-direction:column;
            background:radial-gradient(520px 420px at 85% -5%,#22369f 0%,var(--bg-dark,#0a1033) 70%);
            color:var(--text-main,#fff); font-family:inherit; padding-top:env(safe-area-inset-top,0px);
            animation:zsrIn .22s ease-out; }
        @keyframes zsrIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .zsr-top { display:flex; align-items:center; gap:10px; padding:14px 18px 0; }
        .zsr-back { width:42px; height:42px; border-radius:14px; flex:none; padding:0; cursor:pointer;
            border:1px solid rgba(245,195,90,.35); background:rgba(44,75,181,.22); color:#e8ecff;
            display:flex; align-items:center; justify-content:center; }
        .zsr-box { flex:1; min-width:0; height:42px; border-radius:14px; display:flex; align-items:center; gap:8px; padding:0 12px;
            background:rgba(255,255,255,.07); border:1px solid rgba(245,195,90,.45); color:#9aa6d6; }
        .zsr-box input { flex:1; min-width:0; background:transparent; border:none; outline:none; color:#fff;
            font-size:14px; font-weight:700; font-family:inherit; }
        .zsr-box input::-webkit-search-cancel-button, .zsr-box input::-webkit-search-decoration { -webkit-appearance:none; display:none; }
        .zsr-box input::placeholder { color:#9aa6d6; font-weight:600; }
        .zsr-x { width:20px; height:20px; border-radius:50%; border:none; padding:0; cursor:pointer;
            background:rgba(255,255,255,.14); color:#fff; display:none; align-items:center; justify-content:center; }
        .zsr-tabs { display:flex; gap:7px; margin:12px 18px 0; }
        .zsr-tab { padding:6px 16px; border-radius:999px; font-size:12.5px; font-weight:800; font-family:inherit; cursor:pointer;
            border:1px solid rgba(255,255,255,.18); background:transparent; color:#cfd8ff; }
        .zsr-tab[aria-pressed="true"] { background:#f5c35a; color:#0a1033; font-weight:900; border-color:#f5c35a; }
        .zsr-body { flex:1; overflow-y:auto; padding:0 18px 24px; overscroll-behavior:contain; }
        .zsr-sec { margin:16px 2px 8px; display:flex; justify-content:space-between; font-size:12px; font-weight:900; color:#9aa6d6; }
        .zsr-card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); border-radius:20px; overflow:hidden; }
        .zsr-row { width:100%; display:flex; align-items:center; gap:12px; padding:11px 14px; background:transparent; border:none;
            border-bottom:1px solid rgba(255,255,255,.07); color:inherit; font-family:inherit; text-align:start; cursor:pointer; }
        .zsr-row:last-child { border-bottom:none; }
        .zsr-row:active { background:rgba(245,195,90,.08); }
        .zsr-av { width:42px; height:42px; border-radius:50%; flex:none; object-fit:cover; background:#0a1033; border:2px solid #f5c35a;
            display:flex; align-items:center; justify-content:center; color:#f5c35a; font-weight:900; overflow:hidden; box-sizing:border-box; }
        .zsr-av img { width:100%; height:100%; object-fit:contain; }
        .zsr-av.p { object-fit:cover; }
        .zsr-tx { flex:1; min-width:0; }
        .zsr-tx b { display:block; font-size:14px; font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .zsr-tx small { display:block; font-size:11.5px; color:#9aa6d6; margin-top:1px; }
        .zsr-tx small.ltr { direction:ltr; text-align:start; }
        .zsr-msg { text-align:center; color:#9aa6d6; font-size:13px; font-weight:700; padding:40px 10px; line-height:1.8; }
        .zsr-hint { margin-top:16px; font-size:11.5px; color:#6f7bb8; text-align:center; }
    `;

    const S = { q: '', tab: 'all', seq: 0, timer: null };

    // تطبيع النص للبحث: عربي/إنجليزي، بدون تشكيل ولا اختلاف الهمزات
    function norm(s) {
        return String(s || '').toLowerCase()
            .replace(/[ً-ْـ]/g, '')
            .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
            .replace(/\s+/g, ' ').trim();
    }

    function searchTeams(q) {
        const nq = norm(q);
        if (nq.length < 2 || typeof allWorldCupCountriesClubs === 'undefined') return [];
        const out = [], seen = new Set();
        for (const country in allWorldCupCountriesClubs) {
            for (const c of (allWorldCupCountriesClubs[country] || [])) {
                if (seen.has(c.id)) continue;
                if (norm(c.nameAr).includes(nq) || norm(c.nameEn).includes(nq)) {
                    seen.add(c.id);
                    out.push({ club: c, country });
                    if (out.length >= 20) return out;
                }
            }
        }
        return out;
    }

    async function searchPlayers(q) {
        const c = sdb();
        const clean = q.trim().replace(/^@+/, '');
        if (!c || clean.length < 2) return { rows: [], error: false };
        const { data, error } = await c.rpc('search_users', { p_q: clean });
        if (error) return { rows: [], error: true };
        const me = String(window.userState?.userId || '');
        let blocked = new Set();
        try {
            const b = await c.from('user_blocks').select('blocked_id').eq('user_id', me);
            blocked = new Set((b.data || []).map(r => String(r.blocked_id)));
        } catch (e) {}
        return { rows: (data || []).filter(r => String(r.user_id) !== me && !blocked.has(String(r.user_id))), error: false };
    }

    const CHEV = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6f7bb8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:${window.zA('none', 'scaleX(-1)')}"><path d="M15 6l-6 6 6 6"/></svg>`;

    function teamRow(t) {
        const c = t.club;
        const name = isAr() ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr);
        const sub = isAr() ? (c.nameEn || '') : (c.nameAr || '');
        const letter = esc((name || '?').charAt(0).toUpperCase());
        const logo = c.logo ? `<img src="${esc(c.logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${letter}'))">` : letter;
        return `<button class="zsr-row" data-club="${esc(c.id)}"><span class="zsr-av">${logo}</span>
            <span class="zsr-tx"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${CHEV()}</button>`;
    }

    function playerRow(r) {
        const nick = (isAr() ? (r.nickname_ar || r.nickname_en) : (r.nickname_en || r.nickname_ar)) || r.username || '';
        const letter = esc((nick || '?').charAt(0).toUpperCase());
        const av = r.photo_url ? `<img class="p" src="${esc(r.photo_url)}" alt="" style="object-fit:cover" onerror="this.replaceWith(document.createTextNode('${letter}'))">` : letter;
        return `<button class="zsr-row" data-uid="${esc(r.user_id)}"><span class="zsr-av">${av}</span>
            <span class="zsr-tx"><b>${esc(nick)}</b><small class="ltr">${r.username ? '@' + esc(r.username) : ''}</small></span>${CHEV()}</button>`;
    }

    function section(title, count, rowsHtml) {
        return `<div class="zsr-sec"><span>${title}</span><span>${count}</span></div><div class="zsr-card">${rowsHtml}</div>`;
    }

    async function run() {
        const body = $('zsr-body');
        if (!body) return;
        const q = S.q.trim();
        const my = ++S.seq;
        if (norm(q).length < 2) {
            body.innerHTML = `<div class="zsr-msg">${esc(L('اكتب اسم فريق أو لاعب للبحث', 'Type a team or player name to search'))}</div>`;
            return;
        }
        const wantTeams = S.tab !== 'players', wantPlayers = S.tab !== 'teams';
        body.innerHTML = `<div class="zsr-msg">${esc(L('جارٍ البحث…', 'Searching…'))}</div>`;
        const teams = wantTeams ? searchTeams(q) : [];
        const pl = wantPlayers ? await searchPlayers(q) : { rows: [], error: false };
        if (my !== S.seq || !$('zsr-body')) return;
        let html = '';
        if (teams.length) html += section(L('فرق', 'Teams'), teams.length, teams.map(teamRow).join(''));
        if (pl.rows.length) html += section(L('لاعبون', 'Players'), pl.rows.length, pl.rows.map(playerRow).join(''));
        if (!html) {
            const msg = pl.error ? L('تعذّر البحث الآن', 'Search unavailable') : L('لا نتائج', 'No results');
            html = `<div class="zsr-msg">${esc(msg)}</div>`;
        } else {
            html += `<div class="zsr-hint">${esc(L('اضغط على فريق لفتح جمهوره، أو على لاعب لفتح ملفه', 'Tap a team to open its fans, or a player to open the profile'))}</div>`;
        }
        body.innerHTML = html;
    }

    function close() { $('zsr')?.remove(); }

    function open() {
        close();
        if (!$('zsr-css')) {
            const st = document.createElement('style');
            st.id = 'zsr-css'; st.textContent = CSS;
            document.head.appendChild(st);
        }
        S.q = ''; S.tab = 'all'; S.seq = 0;
        const ar = isAr();
        const el = document.createElement('div');
        el.id = 'zsr'; el.className = 'zsr'; el.dir = window.zA('rtl', 'ltr');
        el.innerHTML = `
            <div class="zsr-top">
                <button class="zsr-back" id="zsr-back" aria-label="${esc(L('رجوع', 'Back'))}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:${ar ? 'none' : 'scaleX(-1)'}"><path d="M9 6l6 6-6 6"/></svg></button>
                <div class="zsr-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                    <input id="zsr-in" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(L('ابحث عن فريق أو لاعب…', 'Search teams or players…'))}">
                    <button class="zsr-x" id="zsr-x" aria-label="clear"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
                </div>
            </div>
            <div class="zsr-tabs" id="zsr-tabs">
                <button class="zsr-tab" data-t="all" aria-pressed="true">${esc(L('الكل', 'All'))}</button>
                <button class="zsr-tab" data-t="players" aria-pressed="false">${esc(L('لاعبون', 'Players'))}</button>
                <button class="zsr-tab" data-t="teams" aria-pressed="false">${esc(L('فرق', 'Teams'))}</button>
            </div>
            <div class="zsr-body" id="zsr-body"></div>`;
        document.body.appendChild(el);

        const inp = $('zsr-in'), x = $('zsr-x');
        inp.addEventListener('input', () => {
            S.q = inp.value;
            x.style.display = inp.value ? 'flex' : 'none';
            clearTimeout(S.timer);
            S.timer = setTimeout(run, 300);
        });
        x.addEventListener('click', () => { inp.value = ''; S.q = ''; x.style.display = 'none'; run(); inp.focus(); });
        $('zsr-back').addEventListener('click', close);
        $('zsr-tabs').addEventListener('click', e => {
            const b = e.target.closest('[data-t]'); if (!b) return;
            S.tab = b.dataset.t;
            el.querySelectorAll('.zsr-tab').forEach(t => t.setAttribute('aria-pressed', t === b));
            run();
        });
        $('zsr-body').addEventListener('click', e => {
            const t = e.target.closest('[data-club]');
            if (t) {
                const id = t.dataset.club;
                close();
                if (typeof window.openSpecificClubFans === 'function') window.openSpecificClubFans(id);
                return;
            }
            const u = e.target.closest('[data-uid]');
            if (u) {
                const uid = u.dataset.uid;
                close();
                if (typeof window.openUserProfile === 'function') window.openUserProfile(uid);
            }
        });
        run();
        setTimeout(() => inp.focus(), 120);
    }

    window.openSearchScreen = open;
    window.closeSearchScreen = close;
})();
