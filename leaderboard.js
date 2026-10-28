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

        const leaderboardHtml = allClubsFlat
            .sort((a, b) => b.points - a.points)
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

            <div class="leaderboard-list">${leaderboardHtml}</div>
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
                .select('user_id, total_fan_points, referrals_count, users!inner(username)')
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
                    const uname = fan.users?.username || prof.username || '';
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

            <button class="btn-back-compact" onclick="window.showPage('leaderboard')">
                <span>🔙</span> ${lbTr('btnBack', 'العودة للترتيب العام', 'Back to Leaderboard')}
            </button>

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
