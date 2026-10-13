function getT(key) {
    const lang = userState.lang || 'ar';
    return typeof i18n !== 'undefined' && i18n[lang][key] ? i18n[lang][key] : key;
}

const generateAvatar = (name, photoUrl, size = '50px') => {
    if (photoUrl) {
        return `<img src="${photoUrl}" style="width:${size}; height:${size}; border-radius:50%; object-fit:cover; border:2px solid var(--accent-gold, #fcb045); margin: 0 auto; display: block;">`;
    }
    const initial = name ? String(name).charAt(0).toUpperCase() : '👤';
    return `<div style="width:${size}; height:${size}; border-radius:50%; background: linear-gradient(135deg, #833ab4, #fd1d1d); color:white; display:flex; align-items:center; justify-content:center; font-size:calc(${size} / 2.2); font-weight:bold; margin: 0 auto; border:2px solid var(--accent-gold, #fcb045);">${initial}</div>`;
};

window.renderRankingScreen = async function(container) {
    const isAr = userState.lang === 'ar'; 
    const currentUserId = userState.userId;

    container.innerHTML = `<div style="text-align:center; padding:50px; color:#aaa;"><div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>${getT('loadingMatches')}</div>`;

    try {
        const { data: rankings } = await supabaseClient
            .from('weekly_match_rankings')
            .select('*')
            .eq('category', 'weekly')
            .order('points_earned', { ascending: false })
            .limit(3);

        const { data: myRank } = await supabaseClient.rpc('get_user_rank', {
            p_telegram_id: currentUserId,
            p_category: 'weekly'
        });

        const { data: predictions } = await supabaseClient
            .from('match_predictions')
            .select('*')
            .eq('telegram_id', currentUserId)
            .order('created_at', { ascending: false });

        let myExactPoints = 0;
        let errorCount = 0;
        let matches = [];

        if (predictions && predictions.length > 0) {
            predictions.forEach(p => {
                if (p.prediction_status === 'correct') {
                    myExactPoints += (p.points_awarded || 3);
                } else if (p.prediction_status === 'wrong') {
                    errorCount++;
                }
            });

            const matchIds = predictions.map(p => p.match_id);
            const { data: matchesData } = await supabaseClient
                .from('matches')
                .select('*')
                .in('id', matchIds);
            matches = matchesData || [];
        }

        const displayRank = myRank ? `#${myRank}` : getT('unranked');
        const rankFontSize = myRank ? '2.5rem' : '1.2rem'; 

        let html = `
            <style>
                .podium-container { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; margin-top: 20px; gap: 10px; }
                .podium-card { background: var(--bg-card, #1c1c22); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; text-align: center; padding: 15px 5px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
                .rank-1 { border-color: var(--accent-gold, #fcb045); background: rgba(252, 176, 69, 0.1); height: 180px; transform: translateY(-15px); }
                .rank-2 { border-color: #c0c0c0; background: rgba(192, 192, 192, 0.1); height: 150px; }
                .rank-3 { border-color: #cd7f32; background: rgba(205, 127, 50, 0.1); height: 140px; }
                .podium-name { font-size: 0.85rem; font-weight: bold; margin: 10px 0 5px 0; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; }
                .podium-pts { font-size: 1.1rem; font-weight: bold; }
                .my-rank-card { background: var(--gradient-primary, linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)); padding: 20px; border-radius: 16px; margin-top: 20px; text-align: center; box-shadow: 0 5px 15px rgba(253, 29, 29, 0.3); border: 1px solid rgba(255,255,255,0.2); }
            </style>
            
            <div style="padding: 20px; padding-bottom: 80px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="color: white; margin: 0; font-size: 1.5rem;">🏆 ${getT('leaderboard')}</h2>
                    <button onclick="showPage('home')" style="background: none; border: none; color: #aaa; font-size: 1.5rem; cursor: pointer;">✖</button>
                </div>
        `;

        if (rankings && rankings.length > 0) {
            const [firstPlace, secondPlace, thirdPlace] = rankings;

            html += `<div class="podium-container">`;
            
            if (secondPlace) {
                const name2 = secondPlace.username || 'ID: ' + String(secondPlace.telegram_id).slice(-4);
                html += `
                    <div class="podium-card rank-2">
                        <div style="font-size: 1.5rem; margin-bottom: 5px;">🥈</div>
                        ${generateAvatar(name2, null, '50px')}
                        <div class="podium-name">${name2}</div>
                        <div class="podium-pts" style="color: #c0c0c0;">${secondPlace.points_earned || 0}</div>
                    </div>`;
            } else { html += `<div style="flex: 1;"></div>`; }

            if (firstPlace) {
                const name1 = firstPlace.username || 'ID: ' + String(firstPlace.telegram_id).slice(-4);
                html += `
                    <div class="podium-card rank-1">
                        <div style="font-size: 2rem; margin-bottom: 5px;">👑</div>
                        ${generateAvatar(name1, null, '65px')}
                        <div class="podium-name">${name1}</div>
                        <div class="podium-pts" style="color: var(--accent-gold, #fcb045);">${firstPlace.points_earned || 0}</div>
                    </div>`;
            }

            if (thirdPlace) {
                const name3 = thirdPlace.username || 'ID: ' + String(thirdPlace.telegram_id).slice(-4);
                html += `
                    <div class="podium-card rank-3">
                        <div style="font-size: 1.5rem; margin-bottom: 5px;">🥉</div>
                        ${generateAvatar(name3, null, '45px')}
                        <div class="podium-name">${name3}</div>
                        <div class="podium-pts" style="color: #cd7f32;">${thirdPlace.points_earned || 0}</div>
                    </div>`;
            } else { html += `<div style="flex: 1;"></div>`; }

            html += `</div>`;
        } else {
             html += `<div style="text-align:center; color:#666; padding: 20px;">${getT('noLeaderboardData')}</div>`;
        }

        html += `
            <div class="my-rank-card">
                <p style="margin: 0 0 10px 0; font-size: 0.95rem; color: rgba(255,255,255,0.9);">${getT('yourCurrentRank')}</p>
                <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
                    <div style="font-size: ${rankFontSize}; font-weight: bold; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${displayRank}</div>
                    ${generateAvatar(userState.username, userState.photoUrl, '60px')}
                    <div style="text-align: ${isAr ? 'right' : 'left'};">
                        <div style="font-weight: bold; font-size: 1.2rem;">${userState.username || 'User'}</div>
                        <div style="color: #fff; font-weight: bold; font-size: 1.1rem; margin-top: 3px; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 8px; display: inline-block;">
                            ${myExactPoints} ${getT('pts')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        let historyHtml = '';
        if (predictions && predictions.length > 0) {
            historyHtml = predictions.map(pred => {
                const match = matches.find(m => m.id === pred.match_id);
                if (!match) return ''; 

                let statusUi = '';
                let resultUi = '';

                if (pred.prediction_status === 'correct') {
                    statusUi = `<span style="background:rgba(16, 185, 129, 0.2); color:#10b981; padding:5px 10px; border-radius:8px; font-weight:bold; font-size:0.85rem;">+${pred.points_awarded || 3} ${getT('pts')} ✅</span>`;
                    resultUi = `<div style="color:#10b981; font-size:0.85rem; margin-top:8px;">${getT('finalScore')} ${match.home_score} - ${match.away_score}</div>`;
                } else if (pred.prediction_status === 'wrong') {
                    statusUi = `<span style="background:rgba(253, 29, 29, 0.2); color:var(--accent-red, #fd1d1d); padding:5px 10px; border-radius:8px; font-weight:bold; font-size:0.85rem;">${getT('wrong')} ❌</span>`;
                    resultUi = `<div style="color:var(--accent-red, #fd1d1d); font-size:0.85rem; margin-top:8px;">${getT('finalScore')} ${match.home_score} - ${match.away_score}</div>`;
                } else {
                    statusUi = `<span style="background:rgba(252, 176, 69, 0.2); color:var(--accent-gold, #fcb045); padding:5px 10px; border-radius:8px; font-weight:bold; font-size:0.85rem;">${getT('pending')} ⏳</span>`;
                }

                return `
                    <div style="background:var(--bg-card, #1c1c22); padding:15px; border-radius:12px; margin-bottom:15px; border: 1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; font-size:1rem; margin-bottom:5px; color:#fff;">${match.team_a} vs ${match.team_b}</div>
                            <div style="color:#aaa; font-size:0.9rem;">
                                ${getT('yourPrediction')} <b style="color:#fff;">${pred.predicted_home} - ${pred.predicted_away}</b>
                            </div>
                            ${resultUi}
                        </div>
                        <div>${statusUi}</div>
                    </div>
                `;
            }).join('');
        } else {
            historyHtml = `<div style="text-align:center; color:#888; padding:30px; background:var(--bg-card, #1c1c22); border-radius:12px; border: 1px solid rgba(255,255,255,0.05);">${getT('noPredictionsYet')}</div>`;
        }

        html += `
            <div style="margin-top: 35px; margin-bottom: 25px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="margin:0; color:#fff;">📜 ${getT('myPredictions')}</h3>
                    <div style="background:var(--bg-card, #1c1c22); padding:5px 12px; border-radius:20px; font-size:0.85rem; border:1px solid rgba(255,255,255,0.1);">
                        <span style="color:#aaa;">${getT('errors')}</span> 
                        <span style="font-weight:bold; color:${errorCount > 0 ? 'var(--accent-red, #fd1d1d)' : '#10b981'};">${errorCount}</span>
                    </div>
                </div>
                ${historyHtml}
            </div>
        </div>`;

        container.innerHTML = html;

    } catch (err) {
        console.error("Error fetching leaderboard data:", err);
        container.innerHTML = `
            <div style="text-align:center; padding:50px; color:#ff4d4d;">
                <h3>${getT('errorTitle')}</h3>
                <p>${getT('connectionError')}</p>
                <button onclick="showPage('home')" class="btn-secondary" style="margin-top: 20px;">${getT('backBtn')}</button>
            </div>`;
    }
};

window.openRankingScreen = function() {
    const contentDiv = document.getElementById("main-content");
    if (contentDiv) renderRankingScreen(contentDiv);
};
