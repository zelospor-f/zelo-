window.escapeHTML = str => str ? str.replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t)) : '';

window.renderLeaderboardPage = async function(container) {
    const isAr = userState?.lang === 'ar';
    const tFunc = typeof t === 'function' ? t : k => k;
    
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#00FF87; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
        ${tFunc('loadingRankings') || (isAr ? '⏳ جاري جلب الترتيب المباشر...' : '⏳ Fetching Live Rankings...')}
    </div>`;

    try {
        let clubPointsMap = {}, clubMembersMap = {};

        if (typeof supabaseClient !== 'undefined') {
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

        let leaderboardHtml = allClubsFlat
            .sort((a, b) => b.points - a.points)
            .slice(0, 100)
            .map((club, idx) => {
                const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];
                const rankBadges = ['👑', '🥈', '🥉'];
                const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;

                return `
                <div class="glass-leader-row ${rankClasses[idx] || ''}" onclick="window.openSpecificClubFans('${club.id}')">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="rank-number">${rankBadges[idx] || `#${idx + 1}`}</div>
                        <img src="${club.logo}" onerror="this.style.display='none'" style="width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: #fff; font-weight: 800; font-size: 0.95rem;">${clubName}</span>
                            <span style="color: #00FF87; font-size: 0.72rem; font-weight: bold; background: rgba(0, 255, 135, 0.08); padding: 1px 6px; border-radius: 4px; width: fit-content; margin-top: 2px;">
                                👥 ${club.members.toLocaleString('en-US')} ${tFunc('fansLabel') || (isAr ? 'مشجع' : 'Fans')}
                            </span>
                        </div>
                    </div>
                    
                    <div style="text-align: ${isAr ? 'left' : 'right'};">
                        <div class="points-badge">${club.points.toLocaleString('en-US')} <span style="font-size: 0.8rem;">🏆</span></div>
                        <div style="color: #64748b; font-size: 0.7rem; font-weight: bold; margin-top: 3px; display: flex; align-items: center; justify-content: flex-end; gap: 3px;">
                            ${tFunc('viewFansLabel') || (isAr ? 'عرض المشجعين' : 'View Fans')} <span style="font-size: 0.75rem; color: #00FF87;">${isAr ? '👈' : '👉'}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');

        container.innerHTML = `
            <style>
                .glass-leader-row { display: flex; justify-content: space-between; align-items: center; background: rgba(20, 20, 28, 0.65); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); margin: 8px 0; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: transform 0.2s, background 0.2s; }
                .glass-leader-row:hover { transform: translateY(-2px); background: rgba(30, 30, 42, 0.8); border-color: rgba(0, 255, 135, 0.2); }
                .glass-leader-row:active { transform: scale(0.98); }
                .rank-gold { border-${isAr ? 'right' : 'left'}: 3px solid #ffd700; background: linear-gradient(90deg, rgba(255, 215, 0, 0.06), rgba(20, 20, 28, 0.7)); }
                .rank-silver { border-${isAr ? 'right' : 'left'}: 3px solid #c0c0c0; background: linear-gradient(90deg, rgba(192, 192, 192, 0.06), rgba(20, 20, 28, 0.7)); }
                .rank-bronze { border-${isAr ? 'right' : 'left'}: 3px solid #cd7f32; background: linear-gradient(90deg, rgba(205, 127, 50, 0.06), rgba(20, 20, 28, 0.7)); }
                .rank-number { font-size: 1rem; font-weight: 800; color: #64748b; width: 28px; text-align: center; }
                .rank-gold .rank-number { font-size: 1.2rem; }
                .points-badge { background: rgba(0, 255, 135, 0.1); color: #00FF87; font-weight: 800; font-family: monospace; font-size: 0.95rem; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(0, 255, 135, 0.25); display: inline-block; }
            </style>

            <div style="margin-bottom: 18px; text-align: center;">
                <h2 style="background: linear-gradient(135deg, #2AABEE, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 4px 0; font-size: 1.3rem; font-weight: 900;">
                    🌍 ${tFunc('leaderTitle') || (isAr ? 'ترتيب الأندية' : 'Club Rankings')}
                </h2>
                <p style="color: #94a3b8; font-size: 0.8rem; margin: 0; font-weight: bold;">${tFunc('leaderSub') || (isAr ? 'الأندية الأكثر جمعاً للنقاط عبر مشجعيها' : 'Top clubs ranked by total fan points')}</p>
            </div>
            <div class="leaderboard-list">${leaderboardHtml}</div>
            <div style="height: 20px;"></div>`;
    } catch (error) {
        console.error("Leaderboard error:", error);
    }
};

window.openSpecificClubFans = async function(clubId) {
    const isAr = userState?.lang === 'ar';
    const tFunc = typeof t === 'function' ? t : k => k;
    let club = null;

    if (typeof allWorldCupCountriesClubs !== 'undefined') {
        Object.values(allWorldCupCountriesClubs).some(country => club = country.find(c => c.id === clubId));
    }

    if (!club) return;

    const contentDiv = document.getElementById("main-content");
    const clubNameStr = typeof getClubName === 'function' ? getClubName(club) : club.name;
    
    contentDiv.innerHTML = `<div style="text-align:center; padding:40px; color:#00FF87; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
        ${tFunc('loadingFans') || (isAr ? `⏳ جاري استدعاء أبطال ${clubNameStr}...` : `⏳ Fetching ${clubNameStr} fans...`)}
    </div>`;

    try {
        let fansTableRows = "";
        
        if (typeof supabaseClient !== 'undefined') {
            const { data: fansList } = await supabaseClient
                .from('club_fans_rankings')
                .select('telegram_id, total_fan_points, referrals_count, users!inner(username)')
                .eq('club_id', clubId)
                .order('total_fan_points', { ascending: false })
                .limit(100);

            if (fansList?.length) {
                const currentUserId = userState?.userId;
                const badges = ['👑', '🥈', '🥉'];
                const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];

                fansTableRows = fansList.map((fan, idx) => {
                    const isMe = fan.telegram_id == currentUserId;
                    const safeName = window.escapeHTML(fan.users?.username || tFunc('anonymousFan') || (isAr ? 'مشجع مجهول' : 'Anonymous Fan'));

                    return `
                    <div class="fan-glass-row ${isMe ? 'me-row' : ''}">
                        <div class="fan-rank" style="color: ${colors[idx] || '#64748b'};">${badges[idx] || `#${idx + 1}`}</div>
                        <div class="fan-info">
                            <span class="fan-name">👤 ${safeName}</span>
                            ${isMe ? `<span class="you-badge">${tFunc('youLabel') || (isAr ? 'أنت' : 'You')}</span>` : ''}
                        </div>
                        <div class="fan-stats">
                            <div class="stat-pts">${(fan.total_fan_points || 0).toLocaleString('en-US')} 🏆</div>
                            <div class="stat-ref">${(fan.referrals_count || 0).toLocaleString('en-US')} 👥</div>
                        </div>
                    </div>`;
                }).join('');
            } else {
                fansTableRows = `<div style="text-align:center; padding: 25px; color: #64748b; background: rgba(20, 20, 28, 0.4); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; font-weight: bold;">
                    ${tFunc('noFansYet') || (isAr ? 'لا يوجد مشجعين مسجلين في هذا النادي حتى الآن. كن أنت الأول! 🚀' : 'No fans registered for this club yet. Be the first! 🚀')}
                </div>`;
            }
        }

        contentDiv.innerHTML = `
            <style>
                .club-hero-banner { position: relative; background: linear-gradient(135deg, rgba(20, 20, 28, 0.85), rgba(10, 10, 15, 0.95)); border-radius: 14px; padding: 16px 14px; display: flex; align-items: center; gap: 14px; border: 1px solid rgba(0, 255, 135, 0.2); margin-bottom: 16px; }
                .fan-glass-row { display: flex; justify-content: space-between; align-items: center; background: rgba(20, 20, 28, 0.65); backdrop-filter: blur(10px); padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04); transition: transform 0.2s, background 0.2s; }
                .fan-glass-row:hover { background: rgba(30, 30, 42, 0.8); }
                .me-row { background: linear-gradient(90deg, rgba(42, 171, 238, 0.15), rgba(20, 20, 28, 0.8)); border: 1px solid rgba(42, 171, 238, 0.4); }
                .fan-rank { font-size: 0.95rem; font-weight: 800; width: 30px; text-align: center; }
                .fan-info { flex-grow: 1; display: flex; align-items: center; gap: 8px; }
                .fan-name { color: #fff; font-weight: 800; font-size: 0.85rem; }
                .you-badge { font-size: 0.65rem; background: #2AABEE; color: white; padding: 1px 6px; border-radius: 6px; font-weight: bold; }
                .fan-stats { text-align: ${isAr ? 'left' : 'right'}; }
                .stat-pts { color: #00FF87; font-weight: 800; font-family: monospace; font-size: 0.9rem; }
                .stat-ref { color: #64748b; font-size: 0.7rem; font-weight: bold; margin-top: 2px; }
                .btn-back-compact { background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255, 255, 255, 0.1); padding: 6px 14px; border-radius: 8px; font-weight: bold; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; margin-bottom: 14px; }
                .btn-back-compact:hover { background: rgba(0, 255, 135, 0.15); border-color: rgba(0, 255, 135, 0.3); }
            </style>

            <button class="btn-back-compact" onclick="window.showPage('leaderboard')">
                <span>🔙</span> ${tFunc('btnBack') || (isAr ? 'العودة للترتيب العام' : 'Back to Leaderboard')}
            </button>
            
            <div class="club-hero-banner">
                <div style="background: rgba(0,0,0,0.4); padding: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
                    <img src="${club.logo}" onerror="this.style.display='none'" style="width: 44px; height: 44px; object-fit: contain;"> 
                </div>
                <div>
                    <h3 style="margin: 0; color: #fff; font-weight: 800; font-size: 1.1rem;">
                        ${tFunc('topFansOf') || (isAr ? 'أبطال' : 'Top Fans of')} ${clubNameStr}
                    </h3>
                    <p style="color: #00FF87; font-size: 0.78rem; font-weight: bold; margin: 4px 0 0 0;">
                        ${tFunc('topFansSub') || (isAr ? 'تنافس لتكون المشجع الأول لناديك!' : 'Compete to be the #1 fan for your club!')} 🚀
                    </p>
                </div>
            </div>
            
            <div class="fans-list-container">${fansTableRows}</div>
            <div style="height: 20px;"></div>`;
    } catch (error) {
        console.error("Club details error:", error);
    }
};
