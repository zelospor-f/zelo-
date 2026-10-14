window.escapeHTML = str => str ? str.replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t)) : '';

window.renderLeaderboardPage = async function(container) {
    const isAr = (typeof userState !== 'undefined' && userState?.lang === 'ar');
    const tFunc = typeof t === 'function' ? t : k => k;
    
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#00FF87; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
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

        let leaderboardHtml = allClubsFlat
            .sort((a, b) => b.points - a.points)
            .slice(0, 100)
            .map((club, idx) => {
                const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];
                const rankBadges = ['👑', '🥈', '🥉'];
                const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;

                return `
                <div class="glass-leader-row ${rankClasses[idx] || ''}" onclick="window.openSpecificClubFans('${club.id}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="rank-number">${rankBadges[idx] || `#${idx + 1}`}</div>
                        <div class="stat-icon-box">
                            <img src="${club.logo}" onerror="this.style.display='none'" style="width: 26px; height: 26px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: #fff; font-weight: 900; font-size: 0.95rem; text-shadow: 0 2px 4px rgba(0,0,0,0.4);">${clubName}</span>
                            <span style="color: #00FF87; font-size: 0.72rem; font-weight: bold; background: rgba(0, 255, 135, 0.12); border: 1px solid rgba(0, 255, 135, 0.25); padding: 2px 8px; border-radius: 6px; width: fit-content; margin-top: 3px;">
                                👥 ${club.members.toLocaleString('en-US')} ${tFunc('fansLabel') || (isAr ? 'مشجع' : 'Fans')}
                            </span>
                        </div>
                    </div>
                    
                    <div style="text-align: ${isAr ? 'left' : 'right'};">
                        <div class="points-badge">${club.points.toLocaleString('en-US')} <span style="font-size: 0.8rem;">🏆</span></div>
                        <div style="color: #8b5cf6; font-size: 0.72rem; font-weight: 900; margin-top: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 4px; text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);">
                            ${tFunc('viewFansLabel') || (isAr ? 'عرض المشجعين' : 'View Fans')} <span style="font-size: 0.8rem; color: #2AABEE;">${isAr ? '👈' : '👉'}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');

        container.innerHTML = `
            <style>
                .glass-leader-row { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    background: linear-gradient(135deg, rgba(20, 20, 30, 0.85), rgba(10, 10, 15, 0.95)); 
                    backdrop-filter: blur(16px); 
                    -webkit-backdrop-filter: blur(16px); 
                    margin: 10px 0; 
                    padding: 12px 16px; 
                    border-radius: 16px; 
                    border: 1px solid rgba(139, 92, 246, 0.3); 
                    cursor: pointer; 
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease; 
                }
                .glass-leader-row:hover { 
                    transform: translateY(-2px); 
                    border-color: rgba(42, 171, 238, 0.6); 
                    box-shadow: 0 8px 30px rgba(42, 171, 238, 0.25); 
                }
                .glass-leader-row:active { transform: scale(0.98); }
                
                .stat-icon-box {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .rank-gold { 
                    border-${isAr ? 'right' : 'left'}: 4px solid #ffd700; 
                    background: linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(15, 15, 22, 0.9)); 
                }
                .rank-silver { 
                    border-${isAr ? 'right' : 'left'}: 4px solid #c0c0c0; 
                    background: linear-gradient(135deg, rgba(192, 192, 192, 0.12), rgba(15, 15, 22, 0.9)); 
                }
                .rank-bronze { 
                    border-${isAr ? 'right' : 'left'}: 4px solid #cd7f32; 
                    background: linear-gradient(135deg, rgba(205, 127, 50, 0.12), rgba(15, 15, 22, 0.9)); 
                }
                
                .rank-number { font-size: 1.1rem; font-weight: 900; color: #94a3b8; width: 30px; text-align: center; font-family: monospace; }
                .rank-gold .rank-number { font-size: 1.3rem; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
                
                .points-badge { 
                    background: rgba(0, 255, 135, 0.12); 
                    color: #00FF87; 
                    font-weight: 900; 
                    font-family: monospace; 
                    font-size: 1rem; 
                    padding: 6px 12px; 
                    border-radius: 12px; 
                    border: 1px solid rgba(0, 255, 135, 0.3); 
                    display: inline-block; 
                    text-shadow: 0 0 8px rgba(0, 255, 135, 0.4);
                    box-shadow: 0 4px 15px rgba(0, 255, 135, 0.15);
                }
            </style>

            <div style="margin-bottom: 20px; text-align: center;">
                <h2 style="background: linear-gradient(135deg, #2AABEE, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 6px 0; font-size: 1.4rem; font-weight: 900;">
                    🌍 ${tFunc('leaderTitle') || (isAr ? 'ترتيب الأندية' : 'Club Rankings')}
                </h2>
                <p style="color: #94a3b8; font-size: 0.82rem; margin: 0; font-weight: bold;">${tFunc('leaderSub') || (isAr ? 'الأندية الأكثر جمعاً للنقاط عبر مشجعيها' : 'Top clubs ranked by total fan points')}</p>
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
    
    contentDiv.innerHTML = `<div style="text-align:center; padding:40px; color:#00FF87; font-weight:800; font-size:1rem; animation: pulse 1.5s infinite;">
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
                    <div class="fan-glass-row ${isMe ? 'me-row' : ''}">
                        <div class="fan-rank" style="color: ${colors[idx] || '#94a3b8'};">${badges[idx] || `#${idx + 1}`}</div>
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
                fansTableRows = `<div style="text-align:center; padding: 30px; color: #94a3b8; background: rgba(20, 20, 30, 0.65); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem; font-weight: bold;">
                    ${tFunc('noFansYet') || (isAr ? 'لا يوجد مشجعين مسجلين في هذا النادي حتى الآن. كن أنت الأول! 🚀' : 'No fans registered for this club yet. Be the first! 🚀')}
                </div>`;
            }
        }

        contentDiv.innerHTML = `
            <style>
                .club-hero-banner { 
                    position: relative; 
                    background: linear-gradient(135deg, rgba(20, 20, 30, 0.85), rgba(10, 10, 15, 0.95)); 
                    border-radius: 16px; 
                    padding: 16px; 
                    display: flex; 
                    align-items: center; 
                    gap: 14px; 
                    border: 1px solid rgba(139, 92, 246, 0.4); 
                    margin-bottom: 16px; 
                    box-shadow: 0 8px 25px rgba(0,0,0,0.7);
                }
                .fan-glass-row { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    background: linear-gradient(135deg, rgba(20, 20, 30, 0.85), rgba(10, 10, 15, 0.95)); 
                    backdrop-filter: blur(14px); 
                    padding: 12px 16px; 
                    margin-bottom: 10px; 
                    border-radius: 14px; 
                    border: 1px solid rgba(255,255,255,0.06); 
                    transition: transform 0.2s, border-color 0.2s; 
                }
                .fan-glass-row:hover { border-color: rgba(42, 171, 238, 0.4); }
                .me-row { 
                    background: linear-gradient(135deg, rgba(42, 171, 238, 0.18), rgba(139, 92, 246, 0.12)); 
                    border: 1px solid rgba(42, 171, 238, 0.5); 
                }
                .fan-rank { font-size: 1rem; font-weight: 900; width: 32px; text-align: center; font-family: monospace; }
                .fan-info { flex-grow: 1; display: flex; align-items: center; gap: 10px; }
                .fan-name { color: #fff; font-weight: 900; font-size: 0.9rem; }
                .you-badge { font-size: 0.7rem; background: linear-gradient(135deg, #2AABEE, #8B5CF6); color: white; padding: 2px 8px; border-radius: 8px; font-weight: bold; box-shadow: 0 2px 8px rgba(42,171,238,0.4); }
                .fan-stats { text-align: ${isAr ? 'left' : 'right'}; }
                .stat-pts { color: #00FF87; font-weight: 900; font-family: monospace; font-size: 0.95rem; text-shadow: 0 0 8px rgba(0,255,135,0.4); }
                .stat-ref { color: #94a3b8; font-size: 0.7rem; font-weight: bold; margin-top: 2px; }
                .btn-back-compact { background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255, 255, 255, 0.12); padding: 8px 16px; border-radius: 12px; font-weight: bold; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; margin-bottom: 16px; }
                .btn-back-compact:hover { background: rgba(139, 92, 246, 0.2); border-color: rgba(139, 92, 246, 0.4); }
            </style>

            <button class="btn-back-compact" onclick="window.showPage('leaderboard')">
                <span>🔙</span> ${tFunc('btnBack') || (isAr ? 'العودة للترتيب العام' : 'Back to Leaderboard')}
            </button>
            
            <div class="club-hero-banner">
                <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                    <img src="${club.logo}" onerror="this.style.display='none'" style="width: 44px; height: 44px; object-fit: contain;"> 
                </div>
                <div>
                    <h3 style="margin: 0; color: #fff; font-weight: 900; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
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
