function getT(key) {
    const lang = userState?.lang || 'ar';
    return (typeof i18n !== 'undefined' && i18n[lang] && i18n[lang][key]) ? i18n[lang][key] : key;
}

let globalMatches = [];
let globalPredictions = [];

window.openChallengesScreen = async function() {
    if (document.getElementById('challenges-overlay')) return;

    const isAr = (userState?.lang === 'ar'); 
    const overlay = document.createElement('div');
    overlay.id = 'challenges-overlay';
    
    overlay.style.cssText = `
        position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
        width: 100vw !important; height: 100vh !important; background: var(--bg-dark, #0a1033) !important; 
        z-index: 99999 !important; padding: 20px; box-sizing: border-box; overflow-y: auto; color: white;
        direction: ${isAr ? 'rtl' : 'ltr'}; text-align: ${isAr ? 'right' : 'left'};
    `;
    document.body.appendChild(overlay);

    overlay.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 25px;">
            <h2 style="margin:0; color:var(--accent-gold, #f5c35a);">🏆 ${getT('weeklyChallenges')}</h2>
            <button onclick="window.closeChallengesScreen()" style="background:none; border:none; color:white; font-size:1.8rem; cursor:pointer;">✕</button>
        </div>
        <div style="text-align:center; color:#9aa6d6; padding:50px;">⏳ ${getT('loadingMatches')}</div>
    `;

    if (!userState.predictedMatches) userState.predictedMatches = [];

    if (typeof supabaseClient !== 'undefined' && supabaseClient !== null && userState?.userId) {
        try {
            const { data: predData } = await supabaseClient
                .from('match_predictions')
                .select('*')
                .eq('user_id', userState.userId);
                
            if (predData) {
                globalPredictions = predData;
                userState.predictedMatches = predData.map(p => p.match_id);
            }

            const { data: matchesData } = await supabaseClient
                .from('matches')
                .select('*')
                .neq('status', 'FINISHED') 
                .order('match_date', { ascending: true });

            if (matchesData) globalMatches = matchesData;
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    }

    renderMatchList(overlay, isAr);
    if (window.attachRoomsHandle) window.attachRoomsHandle(overlay);
};

function renderMatchList(overlay, isAr, asPage) {
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 25px;">
            <h2 style="margin:0; color:var(--accent-gold, #f5c35a);">🏆 ${getT('weeklyChallenges')}</h2>
            ${asPage ? '' : '<button onclick="window.closeChallengesScreen()" style="background:none; border:none; color:white; font-size:1.8rem; cursor:pointer;">✕</button>'}
        </div>
        ${window.fcEntryHtml ? window.fcEntryHtml() : ''}
        <div id="matches-container">
    `;

    const upcomingMatches = globalMatches.filter(m => {
        const status = m.status ? m.status.toUpperCase().trim() : '';
        if (status !== 'NOT_STARTED') return false;

        const matchDate = new Date(m.match_date);
        const hoursPassed = (new Date() - matchDate) / (1000 * 60 * 60);
        return hoursPassed <= 4;
    });

    if (upcomingMatches.length === 0) {
        html += `<div style="text-align:center; color:#9aa6d6; padding:50px;">${getT('noMatchesAvailable')}</div>`;
    } else {
        const sortedMatches = upcomingMatches.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

        html += sortedMatches.map(m => {
            const matchDate = new Date(m.match_date);
            const now = new Date();
            now.setMinutes(now.getMinutes() + 60); 
            
            const isStarted = now >= matchDate; 
            const hasPredicted = userState.predictedMatches.includes(m.id);

            const formattedDate = !isNaN(matchDate.getTime()) ? matchDate.toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : '';
            const formattedTime = !isNaN(matchDate.getTime()) ? matchDate.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';

            const GEM = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#7fe3ff" stroke-width="1.8" stroke-linejoin="round" style="flex:none"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M9 3l3 6 3-6M12 21L9 9M12 21l3-12"/></svg>';
            const BALL = '<img src="zelo-coin.png" alt="" style="width:16px;height:16px;flex:none" onerror="if(!this.dataset.f){this.dataset.f=1;this.src=\'https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png\';}else{this.style.display=\'none\';}">';
            const winLine = `<div style="font-size:0.72rem; font-weight:700; margin-top:2px; display:flex; align-items:center; justify-content:center; gap:5px;">${isAr ? 'واكسب' : 'Win'} ${BALL} ${isAr ? 'أو' : 'or'} ${GEM}</div>`;
            let buttonHtml = '';
            if (hasPredicted) {
                buttonHtml = `<button disabled style="width:100%; padding:12px; background:rgba(245, 195, 90, 0.2); color:#f5c35a; border:1px solid #f5c35a; border-radius:12px; font-size:1rem; font-weight:bold;">${getT('btnPredicted')}</button>`;
            } else if (isStarted) {
                buttonHtml = `<button disabled style="width:100%; padding:12px; background:rgba(255,255,255,0.05); color:#9aa6d6; border:1px solid #14206b; border-radius:12px; font-size:0.95rem;">${getT('btnClosed')}</button>`;
            } else {
                buttonHtml = `<button id="btn-predict-${m.id}" onclick="window.showPredictionModal(${m.id}, '${m.team_a}', '${m.team_b}')" style="width:100%; padding:12px; background:var(--gradient-primary, linear-gradient(135deg, #2c4bb5, #14206b, #f5c35a)); border:none; color:white; border-radius:12px; font-weight:bold; font-size:1rem; cursor:pointer; line-height:1.3;">${getT('btnPredictNow')}${winLine}</button>`;
            }

            const fcBtn = (!isStarted && window.fcMatchButton) ? window.fcMatchButton(m.id) : '';
            if (fcBtn) buttonHtml = `<div style="display:flex; gap:10px;">${buttonHtml.replace('width:100%;', 'flex:1;')}${fcBtn}</div>`;

            return `
                <div class="card" style="position: relative; overflow: hidden; padding-top: 40px; margin-bottom: 15px; border-radius: 12px; background: var(--bg-card, #111a4a); border: 1px solid rgba(255,255,255,0.05);">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; background: rgba(255,255,255,0.05); padding: 8px 15px; box-sizing: border-box; display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="font-size: 0.8rem; font-weight:bold; color:#f5c35a;">${getT('matchStatus')} ${getT('statusNotStarted')}</span>
                        <span style="font-size: 0.8rem; color:#9aa6d6;">📅 ${formattedDate} | 🕒 ${formattedTime}</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin: 15px;">
                        <div style="text-align:center; flex:1;"><div style="font-weight:bold; font-size: 1.1rem; color:#fff;">${m.team_a}</div></div>
                        <div style="font-weight:bold; font-size: 1.2rem; color:var(--accent-gold, #f5c35a); margin: 0 15px;">VS</div>
                        <div style="text-align:center; flex:1;"><div style="font-weight:bold; font-size: 1.1rem; color:#fff;">${m.team_b}</div></div>
                    </div>
                    
                    <div id="btn-container-${m.id}" style="padding: 0 15px 15px 15px;">${buttonHtml}</div>
                </div>
            `;
        }).join('');
    }

    html += `</div>`;
    overlay.innerHTML = html;
    if (window.fcRefreshBadge) window.fcRefreshBadge();
}

// صفحة المباريات (تبويب Matches): نفس قائمة المباريات + أيقونة الغرف الجانبية
window.renderMatchesPage = async function(container) {
    container = container || document.getElementById('main-content');
    if (!container) return;
    const isAr = (userState?.lang === 'ar');
    container.innerHTML = `<div style="text-align:center; color:#9aa6d6; padding:50px;">⏳ ${getT('loadingMatches')}</div>`;

    if (!userState.predictedMatches) userState.predictedMatches = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient !== null && userState?.userId) {
        try {
            const { data: predData } = await supabaseClient
                .from('match_predictions').select('*').eq('user_id', userState.userId);
            if (predData) {
                globalPredictions = predData;
                userState.predictedMatches = predData.map(p => p.match_id);
            }
            const { data: matchesData } = await supabaseClient
                .from('matches').select('*').neq('status', 'FINISHED')
                .order('match_date', { ascending: true });
            if (matchesData) globalMatches = matchesData;
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    }

    container.style.direction = isAr ? 'rtl' : 'ltr';
    renderMatchList(container, isAr, true);

    // الزر يُربط بالصفحة كلها (وليس بالحاوية) حتى لا يُقص بسبب تأثيرات الحاوية
    if (window.attachRoomsHandle) window.attachRoomsHandle(document.body);
};

window.closeChallengesScreen = function() {
    const overlay = document.getElementById('challenges-overlay');
    if (overlay) overlay.remove();
};

window.showPredictionModal = function(matchId, team1, team2) {
    if (document.getElementById('prediction-modal')) return;

    const isAr = (userState?.lang === 'ar');
    const modal = document.createElement('div');
    modal.id = 'prediction-modal';
    
    modal.style.cssText = `
        position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important;
        background: #111a4a !important; padding: 25px; border-radius: 20px; z-index: 100000 !important; width: 90%; max-width: 400px; color: white;
        box-shadow: 0 0 0 100vw rgba(0,0,0,0.85), 0 10px 40px rgba(0,0,0,0.8) !important; border: 1px solid rgba(255,255,255,0.1);
        direction: ${isAr ? 'rtl' : 'ltr'}; box-sizing: border-box;
    `;

    modal.innerHTML = `
        <h3 style="margin:0 0 20px 0; text-align:center; color:var(--accent-gold, #f5c35a);">${getT('enterPredictionTitle')}</h3>
        <div style="background:rgba(0,0,0,0.2); padding:20px; border-radius:16px; margin-bottom:25px; border:1px solid rgba(255,255,255,0.05);">
            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size:1rem; margin-bottom:10px; font-weight:bold; color:#fff;">⚽ ${getT('goalsLabel')} <span style="color:var(--accent-blue, #4a6cff);">${team1}</span></label>
                <input type="number" id="score-team1" min="0" placeholder="0" style="width:100%; padding:15px; background:var(--bg-dark, #0a1033); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; text-align:center; font-size:1.3rem; font-weight:bold; box-sizing: border-box;">
            </div>
            <div>
                <label style="display:block; font-size:1rem; margin-bottom:10px; font-weight:bold; color:#fff;">⚽ ${getT('goalsLabel')} <span style="color:var(--accent-blue, #4a6cff);">${team2}</span></label>
                <input type="number" id="score-team2" min="0" placeholder="0" style="width:100%; padding:15px; background:var(--bg-dark, #0a1033); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; text-align:center; font-size:1.3rem; font-weight:bold; box-sizing: border-box;">
            </div>
        </div>
        <div style="display:flex; flex-direction: column; gap:12px;">
            <button id="submit-prediction-btn" onclick="window.submitPrediction(${matchId}, '${team1}', '${team2}');" style="width:100%; padding:15px; background:var(--gradient-primary, linear-gradient(135deg, #2c4bb5, #14206b, #f5c35a)); border:none; color:white; border-radius:12px; font-weight:bold; font-size:1.1rem; cursor:pointer;">${getT('submitPredictionBtn')}</button>
            <button onclick="document.getElementById('prediction-modal').remove()" style="width:100%; padding:15px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:#cbd5e1; border-radius:12px; font-weight:bold; font-size:1rem; cursor:pointer;">${getT('cancelBtn')}</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.submitPrediction = async function(matchId, team1, team2) {
    const score1 = document.getElementById('score-team1').value;
    const score2 = document.getElementById('score-team2').value;
    
    if (score1 === '' || score2 === '') {
        alert(getT('enterGoalsError'));
        return;
    }

    const t1Score = parseInt(score1);
    const t2Score = parseInt(score2);
    const autoWinner = t1Score > t2Score ? team1 : (t2Score > t1Score ? team2 : 'draw');
    const finalPredictedScore = `${team1} ${t1Score} - ${t2Score} ${team2} | ${getT('winnerLabel')} ${autoWinner === 'draw' ? getT('drawMatch') : autoWinner}`;
    
    const submitBtn = document.getElementById('submit-prediction-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = '⏳...';

    if (typeof supabaseClient !== 'undefined' && supabaseClient !== null && userState?.userId) {
        try {
            const { data, error } = await supabaseClient
                .from('match_predictions') 
                .insert([{ user_id: userState.userId, match_id: matchId, predicted_score: finalPredictedScore, predicted_home: t1Score, predicted_away: t2Score, points_awarded: 0 }])
                .select();

            if (error) throw error;
            if (data && data[0]) globalPredictions.push(data[0]);
            if (!userState.predictedMatches) userState.predictedMatches = [];
            userState.predictedMatches.push(matchId);
        } catch (err) {
            console.error("Error submitting prediction:", err);
            alert(err.message?.includes('Tampering rejected') || err.message?.includes('التلاعب') ? getT('matchStartedError') : getT('connectionError'));
            submitBtn.disabled = false;
            submitBtn.innerText = getT('submitPredictionBtn');
            return;
        }
    }

    alert(getT('predictionSuccess'));
    const modal = document.getElementById('prediction-modal');
    if (modal) modal.remove();

    const btnContainer = document.getElementById(`btn-container-${matchId}`);
    if (btnContainer) {
        const doneBtn = (w) => `<button disabled style="${w} padding:12px; background:rgba(245, 195, 90, 0.2); color:#f5c35a; border:1px solid #f5c35a; border-radius:12px; font-size:1rem; font-weight:bold;">${getT('btnPredicted')}</button>`;
        btnContainer.innerHTML = window.fcMatchButton
            ? `<div style="display:flex; gap:10px;">${doneBtn('flex:1;')}${window.fcMatchButton(matchId)}</div>`
            : doneBtn('width:100%;');
    }
    // إعادة تحميل صفحة تحدّياتي بعد التوقع من داخلها (إن كان ذلك مطلوباً)
    const fcw = window._fcAfterPredict;
    if (fcw && fcw.matchId === matchId) { window._fcAfterPredict = null; setTimeout(fcw.fn, 50); }
};

window.openPredictionHistoryScreen = function() {};


/* ============================================================
 * تحدّي الأصدقاء — مجاني، بدون ألماسات
 * كل المنطق والحدود داخل Supabase (friend_challenges.sql)
 * ============================================================ */
(function () {
    const isAr = () => (typeof userState !== 'undefined' && userState && userState.lang === 'ar');
    const L = (a, e) => (isAr() ? a : e);
    const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const uid = () => (typeof userState !== 'undefined' && userState && userState.userId) ? String(userState.userId) : '';
    const GOLD = '#f5c35a';
    let list = [], timer = null, filter = 'all', focusId = null;

    function toast(msg) {
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100200;background:#111a4a;color:#fff;border:1px solid rgba(245,195,90,.5);padding:10px 16px;border-radius:999px;font-weight:800;font-size:.85rem;max-width:90%;text-align:center;';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2600);
    }

    async function load() {
        const c = db();
        if (!c || !uid()) return list;
        try {
            const { data, error } = await c.rpc('get_my_challenges');
            if (error) { console.warn('challenges', error); return list; }
            list = Array.isArray(data) ? data : [];
        } catch (e) { console.warn('challenges', e); }
        return list;
    }
    const pendingCount = () => list.filter(x => x.my_status === 'invited' && x.state === 'open').length;

    const ICON_PPL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5"/><path d="M17 5.5a3 3 0 010 5.5M19 14.5c1.5.8 2.3 2.5 2.5 5"/></svg>';

    /* ---------- زر "تحدّياتي" أعلى قائمة المباريات + زر البطاقة ---------- */
    window.fcEntryHtml = function () {
        return `<button onclick="window.openFriendChallenges()" style="width:100%;display:flex;align-items:center;justify-content:space-between;border-radius:16px;padding:12px 14px;margin-bottom:14px;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.4);color:#fff;font-family:inherit;cursor:pointer;">
            <span style="display:flex;align-items:center;gap:10px;font-weight:900;font-size:.95rem;color:${GOLD};">${ICON_PPL}${L('تحدّياتي', 'My challenges')}</span>
            <span id="fc-badge" style="display:none;min-width:22px;height:22px;border-radius:999px;background:${GOLD};color:#0a1033;font-weight:900;font-size:.8rem;align-items:center;justify-content:center;padding:0 6px;"></span>
        </button>`;
    };
    window.fcRefreshBadge = async function () {
        await load();
        const b = document.getElementById('fc-badge');
        if (!b) return;
        const n = pendingCount();
        b.style.display = n ? 'flex' : 'none';
        b.textContent = n || '';
    };
    window.fcMatchButton = function (matchId) {
        return `<button onclick="window.fcStart(${Number(matchId)})" style="flex:1;padding:12px;background:transparent;color:${GOLD};border:1.5px solid ${GOLD};border-radius:12px;font-weight:900;font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;font-family:inherit;">${ICON_PPL}${L('تحدَّ أصدقاءك', 'Challenge friends')}</button>`;
    };

    /* ---------- بدء تحدٍّ: يجب أن يكون المستخدم قد توقع المباراة ---------- */
    // تحدّي الأصدقاء منفصل عن التوقع: يفتح قائمة الأصدقاء مباشرة
    window.fcStart = function (matchId) { openPicker(Number(matchId)); };

    function avatarHtml(u, size) {
        const name = (isAr() ? (u.nickname_ar || u.nickname_en) : (u.nickname_en || u.nickname_ar)) || u.username || '?';
        const ph = u.photo_url;
        const okPhoto = typeof ph === 'string' && /^(https:\/\/|data:image\/)/.test(ph) && ph.length < 200000;
        const base = `width:${size}px;height:${size}px;border-radius:50%;flex:none;`;
        return okPhoto
            ? `<img src="${esc(ph)}" alt="" style="${base}object-fit:cover;" onerror="this.style.visibility='hidden'">`
            : `<div style="${base}background:#2c4bb5;display:flex;align-items:center;justify-content:center;font-weight:900;">${esc(String(name).trim().charAt(0).toUpperCase())}</div>`;
    }
    const nameOf = u => ((isAr() ? (u.nickname_ar || u.nickname_en) : (u.nickname_en || u.nickname_ar)) || u.username || '');

    async function openPicker(matchId) {
        const c = db();
        if (!c) return;
        document.getElementById('fc-picker')?.remove();
        const ov = document.createElement('div');
        ov.id = 'fc-picker';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100100;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        ov.innerHTML = `<div style="width:100%;max-width:500px;box-sizing:border-box;direction:${isAr() ? 'rtl' : 'ltr'};background:#0a1033;border:1px solid rgba(245,195,90,.3);border-radius:20px 20px 0 0;padding:18px 16px 22px;color:#fff;max-height:80vh;display:flex;flex-direction:column;"><div style="text-align:center;color:#9aa6d6;padding:30px;">⏳</div></div>`;
        document.body.appendChild(ov);
        const box = ov.firstElementChild;

        let users = [];
        try {
            const f = await c.from('user_follows').select('following_id').eq('follower_id', uid()).limit(200);
            const ids = (f.data || []).map(x => x.following_id);
            if (ids.length) {
                const r = await c.from('users').select('user_id,nickname_ar,nickname_en,username,photo_url').in('user_id', ids);
                users = r.data || [];
            }
        } catch (e) { console.warn(e); }

        if (!users.length) {
            box.innerHTML = `<div style="text-align:center;padding:24px 10px;font-weight:800;line-height:1.7;">${L('لا تتابع أحداً بعد. تابع أصدقاءك أولاً لتتمكن من تحدّيهم.', 'You do not follow anyone yet. Follow your friends first to challenge them.')}</div>
                <button onclick="document.getElementById('fc-picker').remove()" style="padding:13px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#cbd5e1;font-weight:800;font-family:inherit;">${L('إغلاق', 'Close')}</button>`;
            return;
        }

        const chosen = new Set();
        box.innerHTML = `
            <div style="font-weight:900;font-size:1.05rem;margin-bottom:4px;">${L('اختر أصدقاءك', 'Pick your friends')}</div>
            <div id="fc-count" style="color:#9aa6d6;font-size:.78rem;font-weight:700;margin-bottom:12px;"></div>
            <div style="overflow-y:auto;flex:1;margin-bottom:12px;">
                ${users.map(u => `<div class="fc-u" data-id="${esc(u.user_id)}" style="display:flex;align-items:center;gap:12px;padding:10px;margin-bottom:8px;border-radius:14px;cursor:pointer;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);">
                    ${avatarHtml(u, 40)}
                    <div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:.9rem;">${esc(nameOf(u))}</div><div style="font-size:.74rem;color:#ffd98a;direction:ltr;text-align:${isAr() ? 'right' : 'left'};">@${esc(u.username || '')}</div></div>
                    <div class="fc-chk" style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;color:#0a1033;font-weight:900;"></div>
                </div>`).join('')}
            </div>
            <button id="fc-send" disabled style="padding:14px;border:0;border-radius:999px;background:${GOLD};color:#0a1033;font-weight:900;font-size:1rem;font-family:inherit;opacity:.5;">${L('أرسل التحدي', 'Send challenge')}</button>`;

        const cnt = box.querySelector('#fc-count'), send = box.querySelector('#fc-send');
        const sync = () => {
            cnt.textContent = L(`اخترت ${chosen.size} من 9`, `${chosen.size} of 9 selected`);
            send.disabled = chosen.size === 0;
            send.style.opacity = chosen.size ? '1' : '.5';
        };
        sync();
        box.querySelectorAll('.fc-u').forEach(row => {
            row.onclick = () => {
                const id = row.dataset.id, chk = row.querySelector('.fc-chk');
                if (chosen.has(id)) { chosen.delete(id); chk.textContent = ''; chk.style.background = 'transparent'; row.style.borderColor = 'rgba(255,255,255,.08)'; }
                else {
                    if (chosen.size >= 9) { toast(L('الحد الأقصى 9 أصدقاء', 'Maximum 9 friends')); return; }
                    chosen.add(id); chk.textContent = '✓'; chk.style.background = GOLD; row.style.borderColor = GOLD;
                }
                sync();
            };
        });
        send.onclick = async () => {
            send.disabled = true; send.textContent = '⏳';
            let res = null;
            try { const r = await c.rpc('create_challenge', { p_match_id: matchId, p_invitees: [...chosen] }); res = r.data; if (r.error) throw r.error; }
            catch (e) { console.warn(e); send.disabled = false; send.textContent = L('أرسل التحدي', 'Send challenge'); toast(L('تعذّر الإرسال، حاول لاحقاً', 'Could not send, try later')); return; }
            const st = res && res.status;
            if (st === 'ok') { ov.remove(); toast(L('تم إرسال التحدي', 'Challenge sent')); window.openFriendChallenges(res.id); return; }
            const msg = {
                match_started: L('بدأت المباراة، لا يمكن إنشاء تحدٍّ', 'The match has started'),
                predict_first: L('توقّع المباراة أولاً', 'Predict the match first'),
                daily_limit: L('وصلت إلى حد 5 تحدّيات اليوم', 'You reached 5 challenges today'),
                too_many: L('الحد الأقصى 9 أصدقاء', 'Maximum 9 friends'),
                no_invitees: L('لا يمكن دعوة هؤلاء الأصدقاء', 'These friends cannot be invited')
            }[st] || L('تعذّر الإرسال', 'Could not send');
            send.disabled = false; send.textContent = L('أرسل التحدي', 'Send challenge');
            toast(msg);
        };
    }

    /* ---------- صفحة تحدّياتي ---------- */
    function stateInfo(c) {
        switch (c.state) {
            case 'settled': return { t: L('انتهى', 'Finished'), col: '#c9d3ff' };
            case 'waiting': return { t: L('بانتظار التأكيد', 'Confirming'), col: '#ffd98a' };
            case 'live': return { t: L('جارية', 'Live'), col: '#ffd98a' };
            default: return { t: c.my_status === 'invited' ? L('دعوة', 'Invite') : L('لم تبدأ', 'Not started'), col: '#ffd98a' };
        }
    }
    function cardHtml(c) {
        const si = stateInfo(c);
        const members = Array.isArray(c.members) ? c.members : [];
        const me = uid();
        let score = '';
        if (c.state === 'settled') score = `${c.home_score} - ${c.away_score}`;
        else if (c.state === 'live' && c.live_home != null && c.live_away != null) score = `${c.live_home} - ${c.live_away}`;
        const winners = members.filter(m => m.winner);
        let banner = '';
        if (c.state === 'waiting') {
            banner = `<div style="font-size:.8rem;line-height:1.6;color:#c9d3ff;font-weight:600;">${L('انتهت المباراة. نؤكد النتيجة الآن وسيظهر الفائز هنا تلقائياً وسيصلك إشعار.', 'The match is over. We are confirming the result; the winner will appear here and you will get a notification.')}</div>`;
        } else if (c.state === 'settled') {
            banner = `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(245,195,90,.12);border:1px solid rgba(245,195,90,.4);font-weight:900;font-size:.9rem;color:#ffd98a;">🏆 ${winners.length ? L('الفائزون: ', 'Winners: ') + esc(winners.map(w => (w.user_id === me ? L('أنت', 'You') : (isAr() ? (w.name_ar || w.name_en) : (w.name_en || w.name_ar)) || w.username || '')).join(isAr() ? '، ' : ', ')) : L('لم يُصب أحد النتيجة', 'Nobody got it right')}</div>`;
        }
        const rows = members.map(m => {
            const isMe = m.user_id === me;
            const nm = isMe ? L('أنت', 'You') : ((isAr() ? (m.name_ar || m.name_en) : (m.name_en || m.name_ar)) || m.username || '');
            let right;
            if (m.status === 'invited') right = `<span style="color:#9aa6d6;">${L('لم يردّ بعد', 'No reply yet')}</span>`;
            else if (m.pred_home != null && m.pred_away != null) {
                const col = c.state === 'settled' ? (m.winner ? '#7ee0c3' : '#ff8f8f') : '#fff';
                right = `<span style="color:${col};font-weight:900;">${m.pred_home} - ${m.pred_away}${c.state === 'settled' ? (m.winner ? ' ✓' : ' ✗') : ''}</span>`;
            } else if (m.predicted) right = `<span style="color:#9aa6d6;">${L('مخفي حتى بداية المباراة', 'Hidden until kick-off')}</span>`;
            else right = `<span style="color:#9aa6d6;">${L('لم يتوقع بعد', 'Not predicted yet')}</span>`;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.85rem;font-weight:700;"><span style="${m.winner ? 'color:#ffd98a;' : ''}">${esc(nm)}</span>${right}</div>`;
        }).join('');
        const mine = members.find(m => m.user_id === me);
        const predictBtn = (c.state === 'open' && mine && !mine.predicted)
            ? `<button onclick="window.fcPredict(${c.id})" style="padding:11px;border:0;border-radius:999px;background:linear-gradient(135deg,#2c4bb5,#14206b 50%,#f5c35a);color:#fff;font-weight:900;font-family:inherit;">${L('توقّع هذه المباراة', 'Predict this match')}</button>` : '';
        const actions = predictBtn + ((c.my_status === 'invited' && c.state === 'open')
            ? `<div style="display:flex;gap:10px;"><button onclick="window.fcRespond(${c.id}, true)" style="flex:1;padding:11px;border:0;border-radius:999px;background:${GOLD};color:#0a1033;font-weight:900;font-family:inherit;">${L('قبول', 'Accept')}</button><button onclick="window.fcRespond(${c.id}, false)" style="flex:1;padding:11px;border-radius:999px;background:transparent;border:1px solid rgba(255,255,255,.25);color:#cbd5e1;font-weight:800;font-family:inherit;">${L('رفض', 'Decline')}</button></div>` : '');
        const hl = String(focusId) === String(c.id) ? `border:1px solid ${GOLD};` : (c.state === 'waiting' ? 'border:1px dashed rgba(245,195,90,.5);' : 'border:1px solid rgba(255,255,255,.1);');
        return `<div id="fc-card-${c.id}" style="border-radius:20px;background:#111a4a;${hl}padding:14px;margin-bottom:12px;display:flex;flex-direction:column;gap:11px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="font-weight:800;font-size:.95rem;">${esc(c.team_a)} × ${esc(c.team_b)}</div>
                <div style="padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:.74rem;font-weight:800;color:${si.col};white-space:nowrap;">${si.t}${score ? ' · ' + score : ''}</div>
            </div>
            ${banner}
            <div style="display:flex;flex-direction:column;gap:7px;">${rows}</div>
            ${actions}
        </div>`;
    }
    function listHtml() {
        const items = list.filter(c => filter === 'all' || (filter === 'live' ? c.state !== 'settled' : c.state === 'settled'));
        if (!items.length) return `<div style="text-align:center;color:#9aa6d6;padding:40px 10px;line-height:1.8;font-weight:700;">${L('لا توجد تحدّيات هنا بعد. اضغط "تحدَّ أصدقاءك" على أي مباراة لتبدأ.', 'No challenges yet. Tap "Challenge friends" on any match to start.')}</div>`;
        return items.map(cardHtml).join('');
    }
    function chip(key, label) {
        const on = filter === key;
        return `<button onclick="window.fcFilter('${key}')" style="padding:8px 16px;border-radius:999px;font-weight:${on ? 900 : 700};font-size:.85rem;font-family:inherit;cursor:pointer;${on ? `background:rgba(245,195,90,.16);border:1px solid rgba(245,195,90,.45);color:#ffd98a;` : 'background:transparent;border:1px solid rgba(255,255,255,.14);color:#a9b4e6;'}">${label}</button>`;
    }
    function render() {
        const ov = document.getElementById('fc-overlay');
        if (!ov) return;
        ov.innerHTML = `
            <div style="max-width:520px;margin:0 auto;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                    <button onclick="window.closeFriendChallenges()" aria-label="close" style="width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:1.2rem;cursor:pointer;">${isAr() ? '→' : '←'}</button>
                    <div style="font-weight:900;font-size:1.1rem;">${L('تحدّياتي', 'My challenges')}</div>
                    <div style="width:42px;"></div>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:14px;">${chip('all', L('الكل', 'All'))}${chip('live', L('الجارية', 'Active'))}${chip('done', L('المنتهية', 'Finished'))}</div>
                ${listHtml()}
                <div style="font-size:.76rem;line-height:1.6;color:#8d99cf;text-align:center;padding:6px 10px;">${L('تتحدث الصفحة وحدها أثناء فتحها، والتحدّيات المنتهية تبقى هنا.', 'This page updates by itself while open; finished challenges stay here.')}</div>
            </div>`;
    }
    window.fcFilter = function (k) { filter = k; render(); };

    window.openFriendChallenges = async function (focus) {
        focusId = focus || null;
        let ov = document.getElementById('fc-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'fc-overlay';
            ov.style.cssText = `position:fixed;inset:0;z-index:99990;background:#0a1033;color:#fff;overflow-y:auto;padding:calc(16px + env(safe-area-inset-top,0px)) 16px 40px;box-sizing:border-box;direction:${isAr() ? 'rtl' : 'ltr'};`;
            document.body.appendChild(ov);
        }
        ov.innerHTML = `<div style="text-align:center;color:#9aa6d6;padding:60px;">⏳</div>`;
        await load();
        render();
        if (focusId) { const el = document.getElementById('fc-card-' + focusId); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
        clearInterval(timer);
        timer = setInterval(async () => {
            if (!document.getElementById('fc-overlay')) { clearInterval(timer); timer = null; return; }
            const y = ov.scrollTop;
            await load(); render(); ov.scrollTop = y;
        }, 30000);
    };
    window.closeFriendChallenges = function () {
        clearInterval(timer); timer = null;
        document.getElementById('fc-overlay')?.remove();
        if (window.fcRefreshBadge) window.fcRefreshBadge();
    };

    window.fcPredict = function (id) {
        const ch = list.find(x => x.id === id);
        if (!ch) return;
        window._fcAfterPredict = { matchId: ch.match_id, fn: async () => { await load(); render(); } };
        window.showPredictionModal(ch.match_id, ch.team_a, ch.team_b);
    };

    window.fcRespond = async function (id, accept) {
        const c = db();
        if (!c) return;
        try {
            const r = await c.rpc('respond_challenge', { p_id: id, p_accept: !!accept });
            if (r.error) throw r.error;
            const st = r.data && r.data.status;
            if (st === 'ok') { await load(); render(); toast(accept ? L('انضممت إلى التحدي', 'You joined') : L('تم الرفض', 'Declined')); return; }
            if (st === 'match_started') { toast(L('بدأت المباراة', 'The match has started')); await load(); render(); return; }
            toast(L('تعذّر تنفيذ الطلب', 'Could not complete'));
        } catch (e) { console.warn(e); toast(L('تعذّر الاتصال', 'Connection failed')); }
    };
})();
