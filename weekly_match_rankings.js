const generateLegendaryAvatar = (name, photoUrl, size = '50px') => {
    const safeUrl = (typeof photoUrl === 'string' && /^(https:\/\/|data:image\/)/.test(photoUrl) && !/["'<>\s]/.test(photoUrl)) ? photoUrl : '';
    name = String(name ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    if (safeUrl) {
        return `<img src="${safeUrl}" style="width:${size}; height:${size}; border-radius:50%; object-fit:cover; border:2px solid var(--accent-gold, #f5c35a); margin: 0 auto; display: block; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">`;
    }
    const initial = name ? String(name).charAt(0).toUpperCase() : '👤';
    return `<div style="width:${size}; height:${size}; border-radius:50%; background: linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a); color:white; display:flex; align-items:center; justify-content:center; font-size:calc(${size} / 2.2); font-weight:bold; margin: 0 auto; border:2px solid var(--accent-gold, #f5c35a); box-shadow: 0 4px 15px rgba(0,0,0,0.4);">${initial}</div>`;
};

/* ===== شاشة «نقاطي» ===== */
window.zeloPtsGo = function(fn) {
    const s = document.getElementById('ranking-full-screen'); if (s) s.remove();
    const sub = document.getElementById('ranking-sub-screen'); if (sub) sub.remove();
    try { fn && fn(); } catch (e) { console.error('[ZELO] pts-go', e); }
};

// لعبة «خمّن اللاعب»: يُحمَّل ملفها عند أول فتح فقط
window.zeloOpenGuess = function() {
    if (typeof window.openGuessPlayer === 'function') return window.openGuessPlayer();
    const s = document.createElement('script');
    s.src = 'guess-player.js?v=1';
    s.onload = () => { try { window.openGuessPlayer && window.openGuessPlayer(); } catch (e) { console.error('[ZELO] guess', e); } };
    s.onerror = () => { try { window.showToast && window.showToast(window.zT('تعذّر تحميل اللعبة', 'Could not load the game')); } catch (e) {} };
    document.head.appendChild(s);
};

window.openChallengesRanking = function() {
    const old = document.getElementById('ranking-sub-screen'); if (old) old.remove();
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const navEl = document.getElementById('bottom-nav');
    const navH = (navEl && navEl.getBoundingClientRect().height > 0) ? Math.max(0, Math.round(window.innerHeight - navEl.getBoundingClientRect().top)) : 0;
    const sub = document.createElement('div');
    sub.id = 'ranking-sub-screen';
    sub.style.cssText = `position:fixed !important;top:0;left:0;right:0;bottom:${navH}px !important;z-index:100000;background:var(--bg-dark, #0a1033);color:#fff;display:flex;flex-direction:column;padding:20px 20px 0;box-sizing:border-box;direction:${window.zA('rtl', 'ltr')};text-align:${window.zA('right', 'left')};`;
    sub.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-shrink:0;">
            ${window.zeloBackBtn("document.getElementById('ranking-sub-screen').remove()", isAr)}
            <h2 style="margin:0;flex:1;color:#f5c35a;font-weight:900;">🏆 ${window.zT('ترتيب التحديات', 'Challenges Ranking')}</h2>
        </div>
        <style>#sub-ranking-container .legendary-stats-grid{display:none !important}</style>
        <div style="flex-shrink:0;height:max(0px, calc(var(--zelo-ad-h, 0px) - 10px));"></div>
        <div id="sub-ranking-container" style="flex:1;overflow-y:auto;padding-bottom:16px;"><div id="rank-loading" style="text-align:center;color:#8fa0b8;padding:40px;">${window.zT('⏳ جاري جلب البيانات...', '⏳ Fetching data...')}</div></div>`;
    document.body.appendChild(sub);
    window.renderHomeRankingWidget('sub-ranking-container');
};

window.openLegendaryRankingScreen = function() {
    const existingScreen = document.getElementById('ranking-full-screen');
    if (existingScreen) existingScreen.remove();

    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');

    const screen = document.createElement('div');
    screen.id = 'ranking-full-screen';

    // نترك مكان الشريط السفلي ظاهرًا (أزرار الصفحات)
    const navEl = document.getElementById('bottom-nav');
    const navShown = !!(navEl && getComputedStyle(navEl).display !== 'none' && navEl.getBoundingClientRect().height > 0);
    const navH = navShown ? Math.max(0, Math.round(window.innerHeight - navEl.getBoundingClientRect().top)) : 0;

    // نترك الشريط العلوي (الاسم والصورة) ظاهرًا أيضًا
    const barEl = document.getElementById('top-bar');
    const barShown = !!(barEl && getComputedStyle(barEl).display !== 'none' && barEl.getBoundingClientRect().height > 0);
    const topH = barShown ? Math.max(0, Math.round(barEl.getBoundingClientRect().bottom)) : 0;

    screen.style.cssText = `
        position: fixed !important; top: ${topH}px !important; left: 0 !important; right: 0 !important;
        bottom: ${navH}px !important; width: 100vw !important; height: auto !important;
        background: var(--bg-dark, #0a1033) !important; z-index: 99999 !important;
        padding: 0; box-sizing: border-box; display: flex; flex-direction: column;
        overflow: hidden; color: white;
        direction: ${window.zA('rtl', 'ltr')}; text-align: ${window.zA('right', 'left')};
    `;

    screen.innerHTML = `
        <div style="flex-shrink: 0; height: max(0px, calc(var(--zelo-ad-h, 0px) - 10px));"></div>
        <div style="flex-shrink:0;padding:16px 20px 12px;text-align:center;border-bottom:1px solid rgba(245,195,90,.15);">
            <h2 style="margin:0;color:#fff;font-weight:900;font-size:1.5rem;">${window.zT('نقاطي', 'My Points')}</h2>
        </div>
        <div id="full-ranking-container" style="flex:1;overflow-y:auto;padding:14px 16px 20px;">
            <div id="rank-loading" style="text-align:center; color:#8fa0b8; padding: 50px; font-size: 1.1rem;">
                ${window.zT('⏳ جاري جلب البيانات...', '⏳ Fetching data...')}
            </div>
        </div>
    `;

    document.body.appendChild(screen);

    // زر «نقاطي» يصبح مضاءً ما دامت الشاشة مفتوحة، وأي زر آخر في الشريط يغلقها
    const ptsBtn = document.getElementById('nav-points');
    if (navEl) {
        navEl.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        if (ptsBtn) ptsBtn.classList.add('active');
        const onNav = (e) => {
            const b = e.target && e.target.closest && e.target.closest('.nav-item');
            if (b && (!ptsBtn || b.id !== 'nav-points')) { screen.remove(); const s = document.getElementById('ranking-sub-screen'); if (s) s.remove(); }
        };
        navEl.addEventListener('click', onNav, true);
        new MutationObserver((m, ob) => {
            if (document.body.contains(screen)) return;
            ob.disconnect();
            navEl.removeEventListener('click', onNav, true);
            if (document.getElementById('ranking-full-screen')) return;   // فُتحت نسخة جديدة
            if (ptsBtn) ptsBtn.classList.remove('active');
            if (!navEl.querySelector('.nav-item.active')) {
                const home = Array.from(navEl.querySelectorAll('.nav-item')).find(b => (b.getAttribute('onclick') || '').includes("'home'"));
                if (home) home.classList.add('active');
            }
        }).observe(document.body, { childList: true });
    }

    const done = window.renderPointsScreen('full-ranking-container');
    // شبكة أمان: إن بقيت الشاشة على "جاري الجلب" أكثر من 10 ثوانٍ نُظهر السبب وزر إعادة المحاولة
    setTimeout(() => {
        const box = document.getElementById('full-ranking-container');
        if (box && document.getElementById('rank-loading')) {
            box.innerHTML = `<div style="text-align:center; color:#ff9d9d; padding:30px 16px; font-size:1rem;">${window.zT('تأخّر التحميل. تأكد من الإنترنت ثم أعد المحاولة.', 'Loading took too long. Check your connection and retry.')}<br><button onclick="window.openLegendaryRankingScreen()" style="margin-top:14px;padding:10px 22px;border:none;border-radius:12px;background:#f5c35a;color:#0a1033;font-weight:bold;font-size:1rem;">${window.zT('إعادة المحاولة', 'Retry')}</button></div>`;
        }
    }, 10000);
    return done;
};

window.renderPointsScreen = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const uid = (typeof userState !== 'undefined' && userState?.userId) ? userState.userId : null;
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const T = (ar, en) => window.zT(ar, en);
    const fmt = n => Number(n || 0).toLocaleString('en-US');
    const cacheKey = 'zelo_pts_v2_' + String(uid || '') + '_' + ((localStorage.getItem('app_lang') || 'ar'));
    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) { const d = JSON.parse(raw); if (d && d.html && Date.now() - d.t < 3 * 86400000) container.innerHTML = d.html; }
    } catch (e) {}

    try {
        let balance = 0, lifetime = null, rank = null, correct = 0, wrong = 0, pending = 0;
        if (typeof supabaseClient !== 'undefined' && supabaseClient && uid) {
            const [balRes, rankRes, predRes, sumRes] = await Promise.all([
                supabaseClient.from('users').select('points').eq('user_id', String(uid)).maybeSingle(),
                supabaseClient.rpc('get_user_rank', { p_user_id: uid, p_category: 'weekly' }).then(r => r, () => ({})),
                supabaseClient.from('match_predictions').select('prediction_status').eq('user_id', uid),
                supabaseClient.rpc('my_points_summary').then(r => r, () => ({}))
            ]);
            if (sumRes && sumRes.data && Number.isFinite(Number(sumRes.data.lifetime))) lifetime = Number(sumRes.data.lifetime);
            if (balRes && balRes.data) { balance = Number(balRes.data.points) || 0; if (typeof userState !== 'undefined') userState.points = balance; }
            rank = rankRes && rankRes.data;
            ((predRes && predRes.data) || []).forEach(p => {
                if (p.prediction_status === 'correct') correct++;
                else if (p.prediction_status === 'wrong') wrong++;
                else pending++;
            });
        }

        // المستوى من مجموع ما كسبه المستخدم (لا ينزل عند الإنفاق): كل 1000 كورة = مستوى
        const STEP = 1000;
        const base = Math.max(balance, lifetime == null ? 0 : lifetime);
        const level = Math.floor(base / STEP) + 1;
        const into = base % STEP;
        const pct = Math.round(into / STEP * 100);
        const names = [window.zT('برونزية', 'Bronze'), window.zT('فضية', 'Silver'), window.zT('ذهبية', 'Gold'), window.zT('بلاتينية', 'Platinum'), window.zT('الماسة', 'Diamond')];
        const tierName = level >= 10 ? names[4] : level >= 7 ? names[3] : level >= 5 ? names[2] : level >= 3 ? names[1] : names[0];

        const G = '#f5c35a', G2 = '#f5c35a', GREY = 'rgba(255,255,255,0.62)';
        const card = 'background:linear-gradient(160deg,rgba(26,38,104,.85),rgba(17,26,74,.85));border:1px solid rgba(245,195,90,.22);border-radius:18px;';
        const chev = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${G}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;${window.zA('', 'transform:scaleX(-1);')}"><path d="M15 5l-7 7 7 7"/></svg>`;
        const ico = (p) => `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${G}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">${p}</svg>`;
        const ball = `<svg width="38" height="38" viewBox="0 0 24 24" fill="#0a1033" stroke="${G}" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5" fill="${G}" stroke="none"/><path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="#0a1033" stroke="none"/><path d="M12 7.5V3M15.6 10.1l4.2-1.4M14.2 14.3l2.6 3.6M9.8 14.3l-2.6 3.6M8.4 10.1L4.2 8.7" stroke="#0a1033"/></svg>`;
        const diamond = `<img src="zelo-coin.png" alt="" style="width:78px;height:78px;flex-shrink:0;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45));" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png';}else{this.style.display='none';}">`;

        const stat = (n, label, color, iconSvg) => `
            <div style="${card}border-radius:14px;padding:12px 8px 10px;">
                <div style="display:flex;align-items:center;gap:7px;color:${GREY};font-size:.85rem;font-weight:700;">${iconSvg}<span>${label}</span></div>
                <div style="font-size:2.3rem;font-weight:900;color:#fff;line-height:1.1;margin-top:4px;text-align:center;">${n}</div>
            </div>`;
        const okI = `<span style="width:24px;height:24px;border-radius:50%;background:#22b455;display:inline-flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>`;
        const noI = `<span style="width:24px;height:24px;border-radius:50%;background:#e03535;display:inline-flex;align-items:center;justify-content:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span>`;
        const waI = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${GREY}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/></svg>`;

        const row = (icon, title, sub, onclick, last, chip) => `
            <div onclick="${onclick}" style="display:flex;align-items:center;gap:12px;padding:13px 14px;cursor:pointer;${last ? '' : 'border-bottom:1px solid rgba(245,195,90,.14);'}">
                <div style="width:46px;height:46px;border-radius:50%;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon}</div>
                <div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:1rem;color:#fff;">${title}</div><div style="font-size:.78rem;color:${GREY};margin-top:2px;line-height:1.4;">${sub}</div></div>
                <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">${chip ? `<span style="padding:3px 10px;border-radius:999px;font-size:.7rem;font-weight:900;color:#0a1033;background:linear-gradient(135deg,#ffe7ad,#f5c35a);white-space:nowrap;">${chip}</span>` : ''}${chev}</div>
            </div>`;

        const useCard = (emoji, title, sub, onclick) => `
            <div style="${card}padding:12px 6px 12px;text-align:center;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:2.6rem;line-height:1.1;height:50px;">${emoji}</div>
                <div style="font-weight:800;font-size:.92rem;margin-top:4px;color:#fff;">${title}</div>
                <div style="font-size:.7rem;color:${GREY};margin:2px 0 8px;min-height:1em;">${sub}</div>
                <button onclick="${onclick}" style="background:linear-gradient(135deg,#f5c35a,#ffd98a);color:#0a1033;border:0;border-radius:999px;font-weight:900;font-size:.9rem;padding:6px 0;width:88%;cursor:pointer;font-family:inherit;">${T('افتح', 'Open')}</button>
            </div>`;

        const html = `
            <div style="${card}padding:16px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div style="text-align:center;flex:1;">
                    <div style="color:${G};font-weight:800;font-size:1.05rem;">${T('كورة', 'Kora')}</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;direction:ltr;">
                        <span style="font-size:${String(fmt(balance)).length > 6 ? '2.3rem' : '3rem'};font-weight:900;color:${G2};line-height:1.15;">${fmt(balance)}</span>${ball}
                    </div>
                    <div style="color:${GREY};font-size:.9rem;font-weight:700;margin-top:2px;">${T('نقاطك الحالية', 'Your current points')}</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;flex:0 0 auto;">
                    ${diamond}
                    <div style="text-align:center;min-width:58px;">
                        <span style="display:inline-block;border:1px solid rgba(245,195,90,.35);border-radius:999px;padding:1px 8px;font-size:.72rem;color:#cfd8e6;">${T('المستوى', 'Level')}</span>
                        <div style="font-size:2.2rem;font-weight:900;color:${G2};line-height:1.1;">${level}</div>
                        <div style="font-size:.85rem;font-weight:800;color:${G};">${tierName}</div>
                    </div>
                </div>
            </div>
            <div style="padding:10px 4px 0;">
                <div style="height:8px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f5c35a,#ffd98a);border-radius:99px;"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:.75rem;color:${GREY};margin-top:5px;"><span>${T('النقاط التالية', 'Next level')}</span><span style="direction:ltr;">${fmt(into)} / ${fmt(STEP)}</span></div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 4px;">
                ${stat(correct, T('صحيح', 'Correct'), '#22b455', okI)}
                ${stat(wrong, T('أخطاء', 'Wrong'), '#e03535', noI)}
                ${stat(pending, T('انتظار', 'Pending'), GREY, waI)}
            </div>

            <div style="font-weight:900;font-size:1.25rem;margin:16px 4px 8px;color:#fff;">${T('كيف تكسب المزيد؟', 'How to earn more?')}</div>
            <div style="${card}overflow:hidden;">
                ${row(ico('<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z"/>'), T('تنبّأ بنتائج المباريات', 'Predict match results'), T('احصل على نقاط لكل توقع صحيح', 'Earn points for each correct pick'), "window.zeloPtsGo(function(){showPage('matches')})", false, T('حتى 3 كورة', 'Up to 3 Kora'))}
                ${row(ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'), T('شاهد إعلانًا', 'Watch an ad'), T('نقاط مكافأة بعد كل إعلان', 'Bonus points after each ad'), "window.zeloPtsGo(function(){window.openAdsPage&&window.openAdsPage()})", false, T('مكافأة', 'Bonus'))}
                ${row(ico('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.5a2.8 2.8 0 1 1 4 2.5c-.8.5-1.2 1-1.2 1.9"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'), T('خمّن اللاعب', 'Guess the player'), T('لغز جديد كل يوم واكسب نقاطاً', 'A new puzzle every day'), "window.zeloPtsGo(function(){window.zeloOpenGuess()})", false, T('كل يوم', 'Daily'))}
                ${row(ico('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.6.2 4.5 2.1 4.5 5"/>'), T('ادعُ أصدقاءك', 'Invite friends'), T('لكل صديق ينضم ويتنبأ، احصل على نقاط', 'Earn points for each friend who joins'), "window.zeloPtsGo(function(){window.openShareSheet&&window.openShareSheet()})", false, T('لكل صديق', 'Per friend'))}
                ${row(ico('<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>'), T('انشر واستقبل الدعم', 'Post and receive support'), T('فيديوهاتك ومنشوراتك يدعمها المتابعون بالنقاط', 'Followers support your posts with points'), "window.zeloPtsGo(function(){showPage('videos')})", true, T('من المتابعين', 'From followers'))}
            </div>

            <div style="margin:16px 4px 8px;"><div style="font-weight:900;font-size:1.25rem;color:#fff;">${T('استخدم نقاطك', 'Use your points')}</div><div style="font-size:.8rem;color:${GREY};">${T('استبدل نقاطك بمكافآت رائعة', 'Spend your points on great rewards')}</div></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-bottom:10px;">
                ${useCard('🃏', T('سوق NFT', 'NFT market'), T('بطاقات اللاعبين', 'Player cards'), "window.zeloPtsGo(function(){window.renderNftMarketPage&&window.renderNftMarketPage()})")}
                ${useCard('🎁', T('المتجر', 'Store'), T('عناصر ومزايا', 'Items & perks'), "window.zeloPtsGo(function(){window.openStorePage&&window.openStorePage()})")}
                ${useCard('🏆', T('المحفظة', 'Wallet'), T('الرصيد والسحب', 'Balance & cashout'), "window.zeloPtsGo(function(){if(window.openWithdrawWallet&&typeof supabaseClient!=='undefined')window.openWithdrawWallet(supabaseClient)})")}
            </div>`;
        container.innerHTML = html;
        try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), html })); } catch (e) {}
    } catch (e) {
        console.error('[ZELO] points:', e);
        if (container.querySelector('.zelo-pts-ok') || !document.getElementById('rank-loading')) return;
        container.innerHTML = `<div style="text-align:center;color:#ff4d4d;padding:20px;">${T('حدث خطأ في تحميل البيانات', 'Error loading data')}</div>`;
    }
};

window.renderHomeRankingWidget = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentUserId = (typeof userState !== 'undefined' && userState?.userId) ? userState.userId : null;
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar'); 
    const anonymousName = window.zT('مستخدم', 'User');

    // عرض آخر نسخة محفوظة فورًا ثم التحديث بصمت
    const cacheKey = 'zelo_rank_v1_' + containerId + '_' + String(currentUserId || '') + '_' + ((localStorage.getItem('app_lang') || 'ar'));
    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
            const d = JSON.parse(raw);
            if (d && d.html && Date.now() - d.t < 3 * 86400000) container.innerHTML = d.html;
        }
    } catch (e) {}

    try {
        let rankings = [];
        let myRank = null;
        let myData = null;
        let myBalance = 0;
        let predictions = [];

        if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
            const { data: topData, error: topError } = await supabaseClient
                .from('weekly_match_rankings')
                .select('*')
                .eq('is_eliminated', false)
                .eq('category', 'weekly') 
                .order('points_earned', { ascending: false })
                .limit(50);

            if (!topError) rankings = topData || [];

            // الصورة من الملف الشخصي الحالي (الجدول يحفظ نسخة قديمة)، بالتوازي مع باقي الطلبات
            const photoJob = (async () => {
                try {
                    const ids = [...new Set(rankings.map(r => String(r.user_id)))];
                    if (!ids.length) return;
                    const { data: pp } = await supabaseClient.from('public_profiles').select('user_id,photo_url').in('user_id', ids);
                    const m = {};
                    (pp || []).forEach(x => { if (x.photo_url) m[String(x.user_id)] = x.photo_url; });
                    rankings = rankings.map(r => ({ ...r, photo_url: m[String(r.user_id)] || r.photo_url }));
                } catch (e) {}
            })();

            if (currentUserId) {
                const uid = String(currentUserId);
                const balJob = supabaseClient.from('users').select('points').eq('user_id', uid).maybeSingle();
                const rankJob = supabaseClient.rpc('get_user_rank', { p_user_id: currentUserId, p_category: 'weekly' }).then(r => r, () => ({}));
                const mineJob = supabaseClient.from('weekly_match_rankings').select('points_earned').eq('user_id', currentUserId).eq('category', 'weekly').maybeSingle();
                const predJob = supabaseClient.from('match_predictions').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
                const [balRes2, rankRes2, mineRes2, predRes2] = await Promise.all([balJob, rankJob, mineJob, predJob]);
                const balRes = balRes2 && balRes2.data;
                if (balRes) {
                    myBalance = Number(balRes.points) || 0;
                    if (typeof userState !== 'undefined') userState.points = myBalance;
                }
                myRank = rankRes2 && rankRes2.data;
                myData = mineRes2 && mineRes2.data;
                predictions = (predRes2 && predRes2.data) || [];
            }
            await photoJob;
        }

        let matches = [];
        if (predictions?.length > 0 && typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
            const matchIds = predictions.map(p => p.match_id);
            const { data: matchesData } = await supabaseClient
                .from('matches')
                .select('*')
                .in('id', matchIds);
            matches = matchesData || [];
        }

        let correctCount = 0, wrongCount = 0, pendingCount = 0;
        if (predictions?.length > 0) {
            predictions.forEach(p => {
                if (p.prediction_status === 'correct') correctCount++;
                else if (p.prediction_status === 'wrong') wrongCount++;
                else pendingCount++;
            });
        }

        let htmlStyles = `
            <style>
                @keyframes floatAvatar {
                    0% { transform: translate(-50%, 0px); }
                    50% { transform: translate(-50%, -6px); }
                    100% { transform: translate(-50%, 0px); }
                }
                @keyframes glowPulse {
                    0% { box-shadow: 0 0 15px rgba(245, 195, 90, 0.4), inset 0 0 10px rgba(245, 195, 90, 0.1); }
                    50% { box-shadow: 0 0 30px rgba(44, 75, 181, 0.6), inset 0 0 20px rgba(44, 75, 181, 0.2); }
                    100% { box-shadow: 0 0 15px rgba(245, 195, 90, 0.4), inset 0 0 10px rgba(245, 195, 90, 0.1); }
                }
                .legendary-card {
                    position: relative;
                    background: rgba(17, 26, 74, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-radius: 25px;
                    padding: 55px 20px 25px 20px; 
                    margin: 55px 0 15px 0; 
                    border: 1px solid rgba(245, 195, 90, 0.12);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 2px 15px rgba(255,255,255,0.05);
                    text-align: center;
                    width: 100%;
                    box-sizing: border-box;
                }
                .legendary-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: radial-gradient(circle at 50% 0%, rgba(44, 75, 181, 0.25) 0%, transparent 70%);
                    border-radius: 25px;
                    pointer-events: none;
                    z-index: 0;
                }
                .legendary-rank-badge {
                    position: absolute;
                    top: -10px;
                    ${window.zA('left: -5px;', 'right: -5px;')}
                    color: white;
                    font-weight: 900;
                    font-size: 1rem;
                    padding: 5px 12px;
                    border-radius: 12px;
                    border: 3px solid rgba(255,255,255,0.9);
                    transform: rotate(${window.zA('-8deg', '8deg')});
                    z-index: 10;
                    letter-spacing: 1px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                    text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                }
                .badge-top { background: linear-gradient(135deg, #f5c35a 0%, #ffd98a 100%); box-shadow: 0 8px 25px rgba(245, 195, 90, 0.5); color: #0a1033; text-shadow: none; }
                .badge-normal { background: linear-gradient(135deg, #14206b 0%, #2c4bb5 100%); box-shadow: 0 8px 25px rgba(44, 75, 181, 0.5); }
                .legendary-name {
                    position: relative;
                    z-index: 1;
                    font-size: 1.1rem;
                    font-weight: 900;
                    color: #fff;
                    margin: 0;
                    text-shadow: 0 3px 15px rgba(0,0,0,0.8);
                }
                .legendary-points {
                    position: relative;
                    z-index: 1;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(0, 0, 0, 0.4);
                    padding: 5px 20px;
                    border-radius: 10px;
                    border: 1px solid rgba(245, 195, 90, 0.3);
                }
                .legendary-stats-grid {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 6px;
                }
                .legendary-stat-box {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 12px;
                    padding: 4px 2px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .stat-correct { border-bottom: 3px solid #14F195; }
                .stat-pending { border-bottom: 3px solid #f5c35a; }
                .stat-wrong   { border-bottom: 3px solid #fd1d1d; }
                .podium-container { display: flex; flex-direction: column; gap: 8px; margin: 22px 0; width: 100%; }
                .podium-card { background: linear-gradient(135deg, rgba(17, 26, 74, 0.95), rgba(10, 16, 51, 0.95)); border-radius: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; direction: ltr; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .rank-1 { border: 1px solid rgba(245, 195, 90, 0.5); }
                .rank-2 { border: 1px solid rgba(192, 192, 192, 0.4); }
                .rank-3 { border: 1px solid rgba(205, 127, 50, 0.4); }
                .podium-user-block { display: flex; align-items: center; gap: 10px; }
                .podium-name { font-size: 0.9rem; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 5px; }
                .podium-right-box { display: flex; align-items: center; gap: 12px; }
                .podium-col { display: flex; flex-direction: column; align-items: center; }
                .podium-sub-label { font-size: 0.6rem; color: rgba(255,255,255,0.5); font-weight: bold; margin-bottom: 2px; }
                .podium-pts-pill { background: rgba(0, 0, 0, 0.4); padding: 2px 8px; border-radius: 6px; font-weight: 900; font-size: 0.85rem; }
            </style>
        `;

        let topHtml = `<div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; width: 100%;">`;
        
        if (rankings?.length > 0) {
            const [firstPlace, secondPlace, thirdPlace] = rankings;
            topHtml += `<div class="podium-container">`;

            if (firstPlace) {
                const name1 = firstPlace.username || anonymousName;
                topHtml += `
                    <div class="podium-card rank-1">
                        <div class="podium-user-block">
                            ${generateLegendaryAvatar(name1, firstPlace.photo_url, '40px')}
                            <div class="podium-name">🏆 ${name1}</div>
                        </div>
                        <div class="podium-right-box">
                            <div class="podium-col">
                                <span class="podium-sub-label">${window.zT('النقاط', 'Pts')}</span>
                                <div class="podium-pts-pill" style="color: #f5c35a;">${firstPlace.points_earned}</div>
                            </div>
                            <div class="podium-col">
                                <span class="podium-sub-label">${window.zT('الترتيب', 'Rank')}</span>
                                <span style="font-size: 1.3rem; line-height: 1;">👑</span>
                            </div>
                        </div>
                    </div>`;
            }

            if (secondPlace) {
                const name2 = secondPlace.username || anonymousName;
                topHtml += `
                    <div class="podium-card rank-2">
                        <div class="podium-user-block">
                            ${generateLegendaryAvatar(name2, secondPlace.photo_url, '36px')}
                            <div class="podium-name">🥈 ${name2}</div>
                        </div>
                        <div class="podium-right-box">
                            <div class="podium-col">
                                <span class="podium-sub-label">${window.zT('النقاط', 'Pts')}</span>
                                <div class="podium-pts-pill" style="color: #c0c0c0;">${secondPlace.points_earned}</div>
                            </div>
                            <div class="podium-col">
                                <span class="podium-sub-label">${window.zT('الترتيب', 'Rank')}</span>
                                <span style="font-size: 1.2rem; line-height: 1;">🥈</span>
                            </div>
                        </div>
                    </div>`;
            }

            if (thirdPlace) {
                const name3 = thirdPlace.username || anonymousName;
                topHtml += `
                    <div class="podium-card rank-3">
                        <div class="podium-user-block">
                            ${generateLegendaryAvatar(name3, thirdPlace.photo_url, '36px')}
                            <div class="podium-name">🥉 ${name3}</div>
                        </div>
                        <div class="podium-right-box">
                            <div class="podium-col">
                                <span class="podium-sub-label">${window.zT('النقاط', 'Pts')}</span>
                                <div class="podium-pts-pill" style="color: #cd7f32;">${thirdPlace.points_earned}</div>
                            </div>
                            <div class="podium-col">
                                <span class="podium-sub-label">${window.zT('الترتيب', 'Rank')}</span>
                                <span style="font-size: 1.2rem; line-height: 1;">🥉</span>
                            </div>
                        </div>
                    </div>`;
            }
            topHtml += `</div>`;
        } else {
            topHtml += `<div style="text-align:center; color:#888; padding: 5px 0; margin-bottom: 10px; font-size: 0.95rem;">${window.zT('لا توجد بيانات ترتيب حالياً', 'No ranking data available')}</div>`;
        }

        const displayRank = myRank || '-';
        const badgeClass = (myRank && myRank <= 3) ? 'badge-top' : 'badge-normal';
        const userName = (typeof userState !== 'undefined' && userState.username) ? userState.username : anonymousName;
        const userPhoto = (typeof userState !== 'undefined' && userState.photoUrl) ? userState.photoUrl : null;

        topHtml += `
            <div class="legendary-card" style="margin-top: -10px; padding-top: 12px;">
                <div class="legendary-rank-badge ${badgeClass}">#${displayRank}</div>
                
                <div style="display: flex; justify-content: center; margin-bottom: 6px;">
                    ${generateLegendaryAvatar(userName, userPhoto, '50px')}
                </div>
                
                <div class="legendary-info-row" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                    <div class="legendary-name" style="font-size: 1rem; margin: 0;">${userName}</div>
                    <div class="legendary-points" style="padding: 3px 8px; margin: 0;">
                        <span style="font-size: 0.85rem;">🪙</span>
                        <span style="color: var(--accent-gold, #f5c35a); font-weight: 900; font-size: 0.95rem;">${myBalance.toLocaleString('en-US')}</span>
                        <span style="color: rgba(255,255,255,0.7); font-size: 0.7rem; font-weight: bold;">${window.zT('كورة', 'Kora')}</span>
                    </div>
                </div>
                
                <div class="legendary-stats-grid" style="margin-top: 6px;">
                    <div class="legendary-stat-box stat-correct" style="padding: 4px 2px;">
                        <div style="font-size: 0.9rem; margin-bottom: 1px;">✅</div>
                        <div style="color: #14F195; font-size: 0.95rem; font-weight: 900; line-height: 1;">${correctCount}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 0.6rem; font-weight: bold; margin-top: 1px;">${window.zT('صحيح', 'Correct')}</div>
                    </div>
                    <div class="legendary-stat-box stat-pending" style="padding: 4px 2px;">
                        <div style="font-size: 0.9rem; margin-bottom: 1px;">⏳</div>
                        <div style="color: #f5c35a; font-size: 0.95rem; font-weight: 900; line-height: 1;">${pendingCount}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 0.6rem; font-weight: bold; margin-top: 1px;">${window.zT('انتظار', 'Pending')}</div>
                    </div>
                    <div class="legendary-stat-box stat-wrong" style="padding: 4px 2px;">
                        <div style="font-size: 0.9rem; margin-bottom: 1px;">❌</div>
                        <div style="color: #fff; font-size: 0.95rem; font-weight: 900; line-height: 1;">${wrongCount}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 0.6rem; font-weight: bold; margin-top: 1px;">${window.zT('أخطاء', 'Wrong')}</div>
                    </div>
                </div>
            </div>
        </div>`;

        topHtml += `<div style="display:flex; justify-content:center; margin: 0 0 15px 0;"><button onclick="window.openShareCard && window.openShareCard()" style="width:100%; max-width:420px; padding:12px; background:var(--gradient-primary, linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a)); border:none; color:white; border-radius:12px; font-weight:bold; font-size:1rem; cursor:pointer;">${tr('shareBtn', '📤 شارك إنجازك', '📤 Share your win')}</button></div>`;
        container.innerHTML = htmlStyles + topHtml;
        try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), html: htmlStyles + topHtml })); } catch (e) {}
    } catch (e) {
        console.error('[ZELO] ranking:', e);
        if (container.querySelector('.podium-container, .legendary-card')) return;   // النسخة المحفوظة تبقى ظاهرة
        const why = String((e && e.message) || e || '').replace(/[<>&]/g, '').slice(0, 120);
        container.innerHTML = `<div style="text-align:center; color: #ff4d4d; padding: 20px;">${window.zT('حدث خطأ في تحميل البيانات', 'Error loading ranking data')}<div style="direction:ltr;color:#9aa3cf;font-size:.75rem;margin-top:8px;">${why}</div></div>`;
    }
};
