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

window.renderLeaderboardPage = async function(container) {
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');

    container.innerHTML = `<style>@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }</style>
    <div style="text-align:center; padding:40px; color:#f5c35a; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
        ${lbTr('loadingRankings', '⏳ جاري جلب الترتيب المباشر...', '⏳ Fetching Live Rankings...')}
    </div>`;

    try {
        let clubPointsMap = {}, clubMembersMap = {}, myClubId = null, myPts = 0;

        if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
            const { data } = await supabaseClient.from('club_fans_rankings').select('user_id, club_id, total_fan_points');
            data?.forEach(fan => {
                if (typeof userState !== 'undefined' && userState?.userId && String(fan.user_id) === String(userState.userId)) { myClubId = fan.club_id; myPts = fan.total_fan_points || 0; }
                clubPointsMap[fan.club_id] = (clubPointsMap[fan.club_id] || 0) + (fan.total_fan_points || 0);
                clubMembersMap[fan.club_id] = (clubMembersMap[fan.club_id] || 0) + 1;
            });
        }

        let allClubsFlat = [];
        if (typeof allWorldCupCountriesClubs !== 'undefined') {
            Object.values(allWorldCupCountriesClubs).forEach(c => allClubsFlat.push(...c));
        }

        allClubsFlat.forEach(c => {
            c.points = clubPointsMap[c.id] || 0;
            c.members = clubMembersMap[c.id] || 0;
        });

        const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];
        const rankBadges = ['👑', '🥈', '🥉'];
        const fansWord = lbTr('fansLabel', 'مشجع', 'Fans');
        const viewWord = lbTr('viewFansLabel', 'عرض المشجعين', 'View fans');

        // نعرض فقط الأندية التي اختارها مشجعون (لا فائدة من عرض 240 نادياً فارغاً)
        const activeClubs = allClubsFlat
            .filter(c => c.members > 0)
            .sort((a, b) => (b.points - a.points) || (b.members - a.members));

        const leaderboardHtml = activeClubs
            .slice(0, 100)
            .map((club, idx) => {
                const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;

                return `
                <div class="lb-row ${rankClasses[idx] || ''} ${club.id === myClubId ? 'my-club' : ''}" onclick="window.openSpecificClubFans('${club.id}')">
                    <div class="lb-main">
                        <div class="rank-number">${rankBadges[idx] || `#${idx + 1}`}</div>
                        <div class="club-logo-box">
                            <img src="${club.logo}" onerror="this.style.display='none'" style="width: 40px; height: 40px; object-fit: contain;">
                        </div>
                        <div class="lb-name-box">
                            <div class="lb-club-name">${clubName}</div>
                            <div class="lb-fans-chip">👥 ${club.members.toLocaleString('en-US')} ${fansWord}</div>
                            ${club.id === myClubId ? `<div class="my-chip">⭐ ${lbTr('yourClub', 'ناديك', 'Your club')} · ${lbTr('yourPts', 'نقاطك', 'Your points')}: ${myPts.toLocaleString('en-US')}</div>` : ''}
                        </div>
                    </div>
                    <div class="lb-side">
                        <div class="pts-pill"><span>${club.points.toLocaleString('en-US')}</span>${LB_COIN_IMG}</div>
                        <div class="view-link">${viewWord}</div>
                    </div>
                </div>`;
            }).join('');

        const emptyHtml = `<div style="text-align:center;padding:40px 16px;color:#94a3b8;font-weight:800;">${lbTr('noClubsYet', 'لا توجد أندية بعد. كن أول من يختار ناديه!', 'No clubs yet. Be the first to pick yours!')}</div>`;
        container.innerHTML = `
            <style>
                .lb-row {
                    display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    background: linear-gradient(135deg, rgba(17, 26, 74, 0.95), rgba(10, 16, 51, 0.95));
                    border: 1px solid rgba(44, 75, 181, 0.35);
                    border-radius: 22px;
                    padding: 12px 14px;
                    margin-bottom: 12px;
                    cursor: pointer;
                    box-shadow: 0 0 12px rgba(80, 100, 255, 0.12), inset 0 0 10px rgba(0,0,0,0.3);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .lb-row.my-club { border-color: #f5c35a; box-shadow: 0 0 18px rgba(245, 195, 90, 0.4); }
                .my-chip { margin-top: 4px; color: #f5c35a; font-size: 0.72rem; font-weight: 900; }
                .lb-row:hover { transform: translateY(-2px); box-shadow: 0 0 18px rgba(74, 108, 255, 0.25); }
                .lb-row:active { transform: scale(0.985); }
                .lb-row.rank-gold   { border-color: rgba(255, 215, 0, 0.45);  border-inline-start: 4px solid #ffd700; box-shadow: 0 0 14px rgba(255, 215, 0, 0.18); }
                .lb-row.rank-silver { border-color: rgba(192, 192, 192, 0.4); border-inline-start: 4px solid #c0c0c0; box-shadow: 0 0 12px rgba(192, 192, 192, 0.15); }
                .lb-row.rank-bronze { border-color: rgba(205, 127, 50, 0.4);  border-inline-start: 4px solid #cd7f32; box-shadow: 0 0 12px rgba(205, 127, 50, 0.15); }

                .lb-main { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
                .rank-number {
                    font-size: 1.1rem; font-weight: 900; color: #94a3b8;
                    width: 30px; text-align: center; font-family: monospace; flex-shrink: 0;
                }
                .rank-gold .rank-number, .rank-silver .rank-number, .rank-bronze .rank-number { font-size: 1.5rem; }
                .rank-gold .rank-number { text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
                .club-logo-box {
                    width: 46px; height: 46px; min-width: 46px;
                    display: flex; align-items: center; justify-content: center;
                }
                .lb-name-box { min-width: 0; text-align: start; }
                .lb-club-name { color: #fff; font-weight: 800; font-size: 0.95rem; line-height: 1.3; }
                .lb-fans-chip {
                    display: inline-block; margin-top: 4px;
                    color: #ffd98a; font-size: 0.72rem; font-weight: 700;
                    background: rgba(245, 195, 90, 0.1);
                    border: 1px solid rgba(245, 195, 90, 0.25);
                    padding: 2px 8px; border-radius: 7px;
                }
                .lb-side { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
                .pts-pill {
                    display: inline-flex; align-items: center; gap: 6px; direction: ltr;
                    background: rgba(245, 195, 90, 0.10);
                    border: 1px solid rgba(245, 195, 90, 0.45);
                    color: #f5c35a; font-size: 1.05rem; font-weight: 900; letter-spacing: 1px;
                    padding: 6px 12px; border-radius: 14px;
                    font-variant-numeric: tabular-nums;
                }
                .pts-pill .coin { width: 20px; height: 20px; object-fit: contain; display: block; flex-shrink: 0; }
                .view-link { margin-top: 6px; color: #94a3b8; font-size: 0.72rem; font-weight: 700; }
            </style>

            <div style="margin-bottom: 18px; text-align: center;">
                <h2 style="background: linear-gradient(135deg, #4a6cff, #2c4bb5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 6px 0; font-size: 1.4rem; font-weight: 900;">
                    🌍 ${lbTr('leaderTitle', 'ترتيب الأندية', 'Club Rankings')}
                </h2>
                <p style="color: #94a3b8; font-size: 0.82rem; margin: 0; font-weight: bold;">${lbTr('leaderSub', 'الأندية الأكثر جمعاً للنقاط عبر مشجعيها', 'Top clubs ranked by total fan points')}</p>
            </div>

            <div class="leaderboard-list">${leaderboardHtml || emptyHtml}</div>
            <div style="height: 20px;"></div>`;
        const meRow = container.querySelector('.my-club');
        if (meRow) setTimeout(() => meRow.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
    } catch (error) {
        console.error("Leaderboard error:", error);
    }
};

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

            ${window.zeloBackBtn("window.showPage('leaderboard')")}

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
