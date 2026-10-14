window.escapeHTML = str => str ? str.replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t)) : '';

window.renderLeaderboardPage = async function(container) {
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const tFunc = typeof t === 'function' ? t : k => k;

    container.innerHTML = `<style>@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }</style>
    <div style="text-align:center; padding:40px; color:#00FF87; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
        ${tFunc('loadingRankings') || (isAr ? '⏳ جاري جلب الترتيب المباشر...' : '⏳ Fetching Live Rankings...')}
    </div>`;

    try {
        let clubPointsMap = {}, clubMembersMap = {};

        if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
            const { data } = await supabaseClient.from('club_fans_rankings').select('club_id, total_fan_points');
            data?.forEach(fan => {
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

        const leaderboardHtml = allClubsFlat
            .sort((a, b) => b.points - a.points)
            .slice(0, 100)
            .map((club, idx) => {
                const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;

                return `
                <div class="lb-row ${rankClasses[idx] || ''}" onclick="window.openSpecificClubFans('${club.id}')">
                    <div class="lb-main">
                        <div class="rank-number">${rankBadges[idx] || `#${idx + 1}`}</div>
                        <div class="club-logo-box">
                            <img src="${club.logo}" onerror="this.style.display='none'" style="width: 28px; height: 28px; object-fit: contain;">
                        </div>
                        <div class="lb-name-box" style="text-align: ${isAr ? 'right' : 'left'};">
                            <div class="lb-club-name">${clubName}</div>
                            <div class="lb-fans-chip">👥 ${club.members.toLocaleString('en-US')} ${tFunc('fansLabel') || (isAr ? 'مشجع' : 'Fans')}</div>
                        </div>
                    </div>
                    <div class="lb-points">
                        <div class="reward-num">${club.points.toLocaleString('en-US')}</div>
                        <div class="reward-unit">🏆 ZELO</div>
                    </div>
                    <div class="lb-action">
                        <span class="view-chip">${tFunc('viewFansLabel') || (isAr ? 'المشجعين' : 'Fans')} ${isAr ? '👈' : '👉'}</span>
                    </div>
                </div>`;
            }).join('');

        container.innerHTML = `
            <style>
                .lb-head {
                    display: grid;
                    grid-template-columns: 1fr 90px 74px;
                    gap: 8px;
                    padding: 0 12px 8px 12px;
                    font-size: 0.68rem;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    color: #7a7f9a;
                    text-align: center;
                }
                .lb-head .head-points { color: #7CF7C4; }
                .lb-row {
                    display: grid;
                    grid-template-columns: 1fr 90px 74px;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                    border: 1px solid rgba(90, 110, 255, 0.35);
                    border-radius: 16px;
                    padding: 10px 12px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    box-shadow: 0 0 12px rgba(80, 100, 255, 0.12), inset 0 0 10px rgba(0,0,0,0.3);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .lb-row:hover { transform: translateY(-2px); box-shadow: 0 0 18px rgba(42, 171, 238, 0.25); }
                .lb-row:active { transform: scale(0.985); }
                .lb-row.rank-gold   { border-color: rgba(255, 215, 0, 0.55); box-shadow: 0 0 14px rgba(255, 215, 0, 0.18); }
                .lb-row.rank-silver { border-color: rgba(192, 192, 192, 0.5); box-shadow: 0 0 12px rgba(192, 192, 192, 0.15); }
                .lb-row.rank-bronze { border-color: rgba(205, 127, 50, 0.5); box-shadow: 0 0 12px rgba(205, 127, 50, 0.15); }

                .lb-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
                .rank-number {
                    font-size: 1rem; font-weight: 900; color: #94a3b8;
                    width: 28px; text-align: center; font-family: monospace; flex-shrink: 0;
                }
                .rank-gold .rank-number { font-size: 1.2rem; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
                .club-logo-box {
                    width: 44px; height: 44px; min-width: 44px;
                    border-radius: 12px;
                    background: rgba(0,0,0,0.35);
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                }
                .lb-club-name { color: #fff; font-weight: 800; font-size: 0.82rem; line-height: 1.3; }
                .lb-fans-chip {
                    display: inline-block; margin-top: 3px;
                    color: #7CF7C4; font-size: 0.66rem; font-weight: 700;
                    background: rgba(0, 255, 135, 0.1);
                    border: 1px solid rgba(0, 255, 135, 0.25);
                    padding: 1px 6px; border-radius: 6px;
                }
                .lb-points { text-align: center; }
                .reward-num {
                    font-size: 1rem; font-weight: 900;
                    background: linear-gradient(90deg, #2AABEE, #8B5CF6, #00FF87);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .reward-unit { color: #94a3b8; font-size: 0.6rem; font-weight: 700; }
                .lb-action { display: flex; justify-content: center; }
                .view-chip {
                    width: 100%; text-align: center;
                    background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                    color: #fff; font-size: 0.66rem; font-weight: 900;
                    padding: 7px 4px; border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(42, 171, 238, 0.25);
                }
            </style>

            <div style="margin-bottom: 18px; text-align: center;">
                <h2 style="background: linear-gradient(135deg, #2AABEE, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 6px 0; font-size: 1.4rem; font-weight: 900;">
                    🌍 ${tFunc('leaderTitle') || (isAr ? 'ترتيب الأندية' : 'Club Rankings')}
                </h2>
                <p style="color: #94a3b8; font-size: 0.82rem; margin: 0; font-weight: bold;">${tFunc('leaderSub') || (isAr ? 'الأندية الأكثر جمعاً للنقاط عبر مشجعيها' : 'Top clubs ranked by total fan points')}</p>
            </div>

            <div class="lb-head">
                <div>${isAr ? 'النادي' : 'CLUB'}</div>
                <div class="head-points">${isAr ? 'النقاط' : 'POINTS'}</div>
                <div>${isAr ? 'التفاصيل' : 'DETAILS'}</div>
            </div>

            <div class="leaderboard-list">${leaderboardHtml}</div>
            <div style="height: 20px;"></div>`;
    } catch (error) {
        console.error("Leaderboard error:", error);
    }
};

window.openSpecificClubFans = async function(clubId) {
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const tFunc = typeof t === 'function' ? t : k => k;
    let club = null;

    if (typeof allWorldCupCountriesClubs !== 'undefined') {
        Object.values(allWorldCupCountriesClubs).some(country => club = country.find(c => c.id === clubId));
    }

    if (!club) return;

    const contentDiv = document.getElementById("main-content");
    const clubNameStr = typeof getClubName === 'function' ? getClubName(club) : club.name;

    contentDiv.innerHTML = `<style>@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }</style>
    <div style="text-align:center; padding:40px; color:#00FF87; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
        ${tFunc('loadingFans') || (isAr ? `⏳ جاري استدعاء أبطال ${clubNameStr}...` : `⏳ Fetching ${clubNameStr} fans...`)}
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
                const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];

                fansTableRows = fansList.map((fan, idx) => {
                    const isMe = String(fan.user_id) === String(currentUserId);
                    const safeName = window.escapeHTML(fan.users?.username || tFunc('anonymousFan') || (isAr ? 'مشجع مجهول' : 'Anonymous Fan'));

                    return `
                    <div class="fan-row ${isMe ? 'me-row' : ''}">
                        <div class="fan-rank" style="color: ${colors[idx] || '#94a3b8'};">${badges[idx] || `#${idx + 1}`}</div>
                        <div class="fan-info">
                            <span class="fan-name">👤 ${safeName}</span>
                            ${isMe ? `<span class="you-badge">${tFunc('youLabel') || (isAr ? 'أنت' : 'You')}</span>` : ''}
                        </div>
                        <div class="fan-stats">
                            <div class="reward-num">${(fan.total_fan_points || 0).toLocaleString('en-US')}</div>
                            <div class="stat-ref">${(fan.referrals_count || 0).toLocaleString('en-US')} 👥</div>
                        </div>
                    </div>`;
                }).join('');
            } else {
                fansTableRows = `<div class="empty-box">
                    ${tFunc('noFansYet') || (isAr ? 'لا يوجد مشجعين مسجلين في هذا النادي حتى الآن. كن أنت الأول! 🚀' : 'No fans registered for this club yet. Be the first! 🚀')}
                </div>`;
            }
        }

        contentDiv.innerHTML = `
            <style>
                .btn-back-compact {
                    background: rgba(255,255,255,0.08); color: #00FF87;
                    border: 1px solid rgba(0,255,135,0.25);
                    padding: 8px 16px; border-radius: 20px;
                    font-weight: 800; font-size: 0.82rem; cursor: pointer;
                    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
                }
                .club-hero-banner {
                    background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                    border-radius: 16px; padding: 14px;
                    display: flex; align-items: center; gap: 12px;
                    border: 1px solid rgba(90, 110, 255, 0.4);
                    box-shadow: 0 0 14px rgba(80, 100, 255, 0.18);
                    margin-bottom: 16px;
                }
                .club-hero-logo {
                    width: 52px; height: 52px; min-width: 52px; border-radius: 14px;
                    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                }
                .fans-head {
                    display: grid; grid-template-columns: 32px 1fr 90px; gap: 8px;
                    padding: 0 12px 8px 12px; font-size: 0.68rem; font-weight: 800;
                    letter-spacing: 0.5px; color: #7a7f9a; text-align: center;
                }
                .fan-row {
                    display: flex; justify-content: space-between; align-items: center; gap: 8px;
                    background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                    border: 1px solid rgba(90, 110, 255, 0.3);
                    border-radius: 14px; padding: 10px 12px; margin-bottom: 10px;
                    box-shadow: 0 0 10px rgba(80, 100, 255, 0.1);
                }
                .me-row {
                    border: 1px solid rgba(42, 171, 238, 0.6);
                    background: linear-gradient(135deg, rgba(42, 171, 238, 0.2), rgba(139, 92, 246, 0.15));
                    box-shadow: 0 0 14px rgba(42, 171, 238, 0.25);
                }
                .fan-rank { font-size: 1rem; font-weight: 900; width: 32px; text-align: center; font-family: monospace; flex-shrink: 0; }
                .fan-info { flex-grow: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
                .fan-name { color: #fff; font-weight: 800; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .you-badge {
                    font-size: 0.66rem; background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                    color: #fff; padding: 2px 8px; border-radius: 8px; font-weight: 800; flex-shrink: 0;
                }
                .fan-stats { text-align: center; width: 90px; flex-shrink: 0; }
                .stat-ref { color: #94a3b8; font-size: 0.66rem; font-weight: 700; margin-top: 2px; }
                .empty-box {
                    text-align: center; padding: 30px; color: #94a3b8;
                    background: rgba(20, 22, 48, 0.8); border-radius: 16px;
                    border: 1px solid rgba(90, 110, 255, 0.3); font-size: 0.85rem; font-weight: bold;
                }
            </style>

            <button class="btn-back-compact" onclick="window.showPage('leaderboard')">
                <span>🔙</span> ${tFunc('btnBack') || (isAr ? 'العودة للترتيب العام' : 'Back to Leaderboard')}
            </button>

            <div class="club-hero-banner">
                <div class="club-hero-logo">
                    <img src="${club.logo}" onerror="this.style.display='none'" style="width: 36px; height: 36px; object-fit: contain;">
                </div>
                <div>
                    <h3 style="margin: 0; color: #fff; font-weight: 900; font-size: 1.05rem;">
                        ${tFunc('topFansOf') || (isAr ? 'أبطال' : 'Top Fans of')} ${clubNameStr}
                    </h3>
                    <p style="color: #00FF87; font-size: 0.76rem; font-weight: 700; margin: 4px 0 0 0;">
                        ${tFunc('topFansSub') || (isAr ? 'تنافس لتكون المشجع الأول لناديك!' : 'Compete to be the #1 fan for your club!')} 🚀
                    </p>
                </div>
            </div>

            <div class="fans-head">
                <div>#</div>
                <div>${isAr ? 'المشجع' : 'FAN'}</div>
                <div style="color: #7CF7C4;">${isAr ? 'النقاط' : 'POINTS'}</div>
            </div>

            <div class="fans-list-container">${fansTableRows}</div>
            <div style="height: 20px;"></div>`;
    } catch (error) {
        console.error("Club details error:", error);
    }
};
