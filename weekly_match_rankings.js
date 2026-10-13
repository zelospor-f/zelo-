const generateLegendaryAvatar = (name, photoUrl, size = '50px') => {
    if (photoUrl) {
        return `<img src="${photoUrl}" style="width:${size}; height:${size}; border-radius:50%; object-fit:cover; border:2px solid var(--accent-gold, #fcb045); margin: 0 auto; display: block; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">`;
    }
    const initial = name ? String(name).charAt(0).toUpperCase() : '👤';
    return `<div style="width:${size}; height:${size}; border-radius:50%; background: linear-gradient(135deg, #833ab4, #fd1d1d); color:white; display:flex; align-items:center; justify-content:center; font-size:calc(${size} / 2.2); font-weight:bold; margin: 0 auto; border:2px solid var(--accent-gold, #fcb045); box-shadow: 0 4px 15px rgba(0,0,0,0.4);">${initial}</div>`;
};

window.openLegendaryRankingScreen = function() {
    const existingScreen = document.getElementById('ranking-full-screen');
    if (existingScreen) existingScreen.remove();

    const isAr = userState.lang === 'ar';
    const title = isAr ? 'ترتيب التحديات' : 'Challenges Ranking';

    const screen = document.createElement('div');
    screen.id = 'ranking-full-screen';
    
    screen.style.cssText = `
        position: fixed !important; 
        top: 0 !important; 
        left: 0 !important; 
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important; 
        height: 100vh !important; 
        background: var(--bg-dark, #0d0d12) !important; 
        z-index: 99999 !important; 
        padding: 20px 20px 0 20px; 
        box-sizing: border-box; 
        display: flex;
        flex-direction: column;
        overflow: hidden; 
        color: white;
        direction: ${isAr ? 'rtl' : 'ltr'}; 
        text-align: ${isAr ? 'right' : 'left'};
    `;

    screen.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; flex-shrink: 0;">
            <h2 style="margin:0; color:var(--accent-gold, #fcb045); font-weight: 900; letter-spacing: 0.5px;">🏆 ${title}</h2>
            <button onclick="document.getElementById('ranking-full-screen').remove()" style="background:none; border:none; color:white; font-size:1.8rem; cursor:pointer; transition: 0.2s;">✕</button>
        </div>
        <div id="full-ranking-container" style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
            <div style="text-align:center; color: #888; padding: 50px; font-size: 1.1rem;">
                ${isAr ? '⏳ جاري جلب البيانات...' : '⏳ Fetching data...'}
            </div>
        </div>
    `;

    document.body.appendChild(screen);
    window.renderHomeRankingWidget('full-ranking-container');
};

window.renderHomeRankingWidget = async function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentUserId = userState.userId || userState.telegram_id;
    const isAr = userState.lang === 'ar'; 

    try {
        const { data: rankings, error: topError } = await supabaseClient
            .from('weekly_match_rankings')
            .select('*')
            .eq('is_eliminated', false)
            .eq('category', 'weekly') 
            .order('points_earned', { ascending: false })
            .limit(50);

        if (topError) throw topError;

        const { data: myRank } = await supabaseClient.rpc('get_user_rank', {
            p_telegram_id: currentUserId,
            p_category: 'weekly'
        });

        const { data: myData } = await supabaseClient
            .from('weekly_match_rankings')
            .select('points_earned')
            .eq('telegram_id', currentUserId)
            .eq('category', 'weekly')
            .maybeSingle();

        const { data: predictions } = await supabaseClient
            .from('match_predictions')
            .select('*')
            .eq('telegram_id', currentUserId)
            .order('created_at', { ascending: false });

        let matches = [];
        if (predictions?.length > 0) {
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
                    0% { box-shadow: 0 0 15px rgba(252, 176, 69, 0.4), inset 0 0 10px rgba(252, 176, 69, 0.1); }
                    50% { box-shadow: 0 0 30px rgba(253, 29, 29, 0.6), inset 0 0 20px rgba(253, 29, 29, 0.2); }
                    100% { box-shadow: 0 0 15px rgba(252, 176, 69, 0.4), inset 0 0 10px rgba(252, 176, 69, 0.1); }
                }
                .legendary-card {
                    position: relative;
                    background: rgba(22, 22, 30, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-radius: 25px;
                    padding: 55px 20px 25px 20px; 
                    margin: 55px 0 15px 0; 
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 2px 15px rgba(255,255,255,0.05);
                    text-align: center;
                    width: 100%;
                    box-sizing: border-box;
                }
                .legendary-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: radial-gradient(circle at 50% 0%, rgba(131, 58, 180, 0.2) 0%, transparent 70%);
                    border-radius: 25px;
                    pointer-events: none;
                    z-index: 0;
                }
                .legendary-rank-badge {
                    position: absolute;
                    top: -10px;
                    ${isAr ? 'left: -5px;' : 'right: -5px;'}
                    color: white;
                    font-weight: 900;
                    font-size: 1rem;
                    padding: 5px 12px;
                    border-radius: 12px;
                    border: 3px solid rgba(255,255,255,0.9);
                    transform: rotate(${isAr ? '-8deg' : '8deg'});
                    z-index: 10;
                    letter-spacing: 1px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                    text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                }
                .badge-top { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); box-shadow: 0 8px 25px rgba(253, 160, 133, 0.5); color: #fff; }
                .badge-normal { background: linear-gradient(135deg, #ff0844 0%, #ffb199 100%); box-shadow: 0 8px 25px rgba(255, 8, 68, 0.5); }
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
                    border: 1px solid rgba(255, 215, 0, 0.3);
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
                .stat-correct { border-bottom: 3px solid #10b981; }
                .stat-pending { border-bottom: 3px solid #fcb045; }
                .stat-wrong   { border-bottom: 3px solid #fd1d1d; }
                .podium-container { display: flex; flex-direction: column; gap: 8px; margin: 22px 0; width: 100%; }
                .podium-card { background: linear-gradient(135deg, rgba(30, 30, 38, 0.95), rgba(20, 20, 26, 0.95)); border-radius: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; direction: ltr; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .rank-1 { border: 1px solid rgba(252, 176, 69, 0.5); }
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
                const name1 = firstPlace.username || firstPlace.telegram_id;
                topHtml += `
                    <div class="podium-card rank-1">
                        <div class="podium-user-block">
                            ${generateLegendaryAvatar(name1, firstPlace.photo_url, '40px')}
                            <div class="podium-name">🏆 ${name1}</div>
                        </div>
                        <div class="podium-right-box">
                            <div class="podium-col">
                                <span class="podium-sub-label">${isAr ? 'النقاط' : 'Pts'}</span>
                                <div class="podium-pts-pill" style="color: #fcb045;">${firstPlace.points_earned}</div>
                            </div>
                            <div class="podium-col">
                                <span class="podium-sub-label">${isAr ? 'الترتيب' : 'Rank'}</span>
                                <span style="font-size: 1.3rem; line-height: 1;">👑</span>
                            </div>
                        </div>
                    </div>`;
            }

            if (secondPlace) {
                const name2 = secondPlace.username || secondPlace.telegram_id;
                topHtml += `
                    <div class="podium-card rank-2">
                        <div class="podium-user-block">
                            ${generateLegendaryAvatar(name2, secondPlace.photo_url, '36px')}
                            <div class="podium-name">🥈 ${name2}</div>
                        </div>
                        <div class="podium-right-box">
                            <div class="podium-col">
                                <span class="podium-sub-label">${isAr ? 'النقاط' : 'Pts'}</span>
                                <div class="podium-pts-pill" style="color: #c0c0c0;">${secondPlace.points_earned}</div>
                            </div>
                            <div class="podium-col">
                                <span class="podium-sub-label">${isAr ? 'الترتيب' : 'Rank'}</span>
                                <span style="font-size: 1.2rem; line-height: 1;">🥈</span>
                            </div>
                        </div>
                    </div>`;
            }

            if (thirdPlace) {
                const name3 = thirdPlace.username || thirdPlace.telegram_id;
                topHtml += `
                    <div class="podium-card rank-3">
                        <div class="podium-user-block">
                            ${generateLegendaryAvatar(name3, thirdPlace.photo_url, '36px')}
                            <div class="podium-name">🥉 ${name3}</div>
                        </div>
                        <div class="podium-right-box">
                            <div class="podium-col">
                                <span class="podium-sub-label">${isAr ? 'النقاط' : 'Pts'}</span>
                                <div class="podium-pts-pill" style="color: #cd7f32;">${thirdPlace.points_earned}</div>
                            </div>
                            <div class="podium-col">
                                <span class="podium-sub-label">${isAr ? 'الترتيب' : 'Rank'}</span>
                                <span style="font-size: 1.2rem; line-height: 1;">🥉</span>
                            </div>
                        </div>
                    </div>`;
            }
            topHtml += `</div>`;
        } else {
            topHtml += `<div style="text-align:center; color:#888; padding: 5px 0; margin-bottom: 10px; font-size: 0.95rem;">${isAr ? 'لا توجد بيانات ترتيب حالياً' : 'No ranking data available'}</div>`;
        }

        const displayRank = myRank || '-';
        const badgeClass = (myRank && myRank <= 3) ? 'badge-top' : 'badge-normal';

        topHtml += `
            <div class="legendary-card" style="margin-top: -10px; padding-top: 12px;">
                <div class="legendary-rank-badge ${badgeClass}">#${displayRank}</div>
                
                <div style="display: flex; justify-content: center; margin-bottom: 6px;">
                    ${generateLegendaryAvatar(userState.username || 'User', userState.photoUrl, '50px')}
                </div>
                
                <div class="legendary-info-row" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                    <div class="legendary-name" style="font-size: 1rem; margin: 0;">${userState.username || 'User'}</div>
                    <div class="legendary-points" style="padding: 3px 8px; margin: 0;">
                        <span style="font-size: 0.85rem;">🏆</span>
                        <span style="color: var(--accent-gold, #fcb045); font-weight: 900; font-size: 0.95rem;">${myData ? myData.points_earned : 0}</span>
                        <span style="color: rgba(255,255,255,0.7); font-size: 0.7rem; font-weight: bold;">${isAr ? 'نقطة' : 'Pts'}</span>
                    </div>
                </div>
                
                <div class="legendary-stats-grid" style="margin-top: 6px;">
                    <div class="legendary-stat-box stat-correct" style="padding: 4px 2px;">
                        <div style="font-size: 0.9rem; margin-bottom: 1px;">✅</div>
                        <div style="color: #10b981; font-size: 0.95rem; font-weight: 900; line-height: 1;">${correctCount}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 0.6rem; font-weight: bold; margin-top: 1px;">${isAr ? 'صحيح' : 'Correct'}</div>
                    </div>
                    <div class="legendary-stat-box stat-pending" style="padding: 4px 2px;">
                        <div style="font-size: 0.9rem; margin-bottom: 1px;">⏳</div>
                        <div style="color: #fcb045; font-size: 0.95rem; font-weight: 900; line-height: 1;">${pendingCount}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 0.6rem; font-weight: bold; margin-top: 1px;">${isAr ? 'انتظار' : 'Pending'}</div>
                    </div>
                    <div class="legendary-stat-box stat-wrong" style="padding: 4px 2px;">
                        <div style="font-size: 0.9rem; margin-bottom: 1px;">❌</div>
                        <div style="color: #fff; font-size: 0.95rem; font-weight: 900; line-height: 1;">${wrongCount}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 0.6rem; font-weight: bold; margin-top: 1px;">${isAr ? 'أخطاء' : 'Wrong'}</div>
                    </div>
                </div>
            </div>
        </div>`;

        container.innerHTML = htmlStyles + topHtml;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center; color: #ff4d4d; padding: 20px;">${isAr ? 'حدث خطأ في تحميل البيانات' : 'Error loading ranking data'}</div>`;
    }
};
