

window.tempSelectedClubs = window.tempSelectedClubs || [];

function getInjectableStyles() {
    return `
        <style>
            .login-screen-wrapper {
                height: 100vh; max-height: 100vh; width: 100%; max-width: 500px;
                margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between;
                overflow: hidden; position: relative; box-sizing: border-box; padding: 15px 12px 20px 12px;
            }
            .animate-screen { animation: slideUpFade 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes slideUpFade {
                0% { opacity: 0; transform: translateY(15px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            .inner-scroll-area { flex: 1; overflow-y: auto; scroll-behavior: smooth; padding-right: 4px; margin: 10px 0 15px 0; }
            .inner-scroll-area::-webkit-scrollbar { width: 4px; }
            .inner-scroll-area::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
            .glass-card-elegant {
                background: rgba(20, 20, 28, 0.65); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                transition: transform 0.2s, background 0.2s;
            }
            .interactive-card:active { transform: scale(0.98); background: rgba(30, 30, 42, 0.8); }
            .solana-badge-card {
                background: linear-gradient(135deg, rgba(153, 69, 255, 0.2), rgba(20, 241, 149, 0.15));
                border: 1px solid rgba(20, 241, 149, 0.35); border-radius: 16px; padding: 10px 14px; margin-bottom: 12px;
                display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(12px);
                box-shadow: 0 4px 15px rgba(153, 69, 255, 0.2);
            }
            .token-pill {
                background: linear-gradient(135deg, #9945FF, #14F195); color: #000; font-size: 0.7rem; font-weight: 900;
                padding: 3px 8px; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(20, 241, 149, 0.3);
            }
            .btn-pulse {
                animation: pulseGlowBtn 2s infinite; background: linear-gradient(135deg, #2AABEE, #00FF87);
                color: #000; font-weight: 900; border-radius: 35px; padding: 14px 20px; text-align: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 255, 135, 0.4); border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .btn-pulse:active { transform: scale(0.97); }
            @keyframes pulseGlowBtn {
                0% { box-shadow: 0 0 0 0 rgba(0, 255, 135, 0.5); }
                70% { box-shadow: 0 0 0 12px rgba(0, 255, 135, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 255, 135, 0); }
            }
            .club-selected {
                background: linear-gradient(135deg, rgba(0, 255, 135, 0.15), rgba(0, 255, 135, 0.05)) !important;
                border: 2px solid #00FF87 !important;
            }
            .lang-btn {
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 8px 20px;
                border-radius: 25px; cursor: pointer; color: white; font-weight: bold; font-size: 0.85rem; backdrop-filter: blur(10px);
            }
            .lang-btn-active { background: linear-gradient(135deg, #2AABEE, #00FF87); border-color: transparent; color: #000; }
            .btn-back-vip {
                display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.08); color: #00FF87;
                padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: 800; font-size: 0.82rem;
                border: 1px solid rgba(0, 255, 135, 0.25); backdrop-filter: blur(10px); transition: transform 0.2s, background 0.2s;
            }
            .btn-back-vip:active { transform: scale(0.95); background: rgba(0, 255, 135, 0.15); }
        </style>
    `;
}

function safeT(key, fallbackText) {
    if (typeof t === 'function') {
        const translated = t(key);
        if (translated && translated !== key) return translated;
    }
    return fallbackText;
}

function getDefaultLanguage() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en';
}

function getLanguageSelector() {
    const isAr = userState.lang === 'ar';
    return `
        <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 12px;">
            <div class="lang-btn ${isAr ? 'lang-btn-active' : ''}" onclick="setLanguage('ar')">🇸🇦 العربية</div>
            <div class="lang-btn ${!isAr ? 'lang-btn-active' : ''}" onclick="setLanguage('en')">🇬🇧 English</div>
        </div>
    `;
}

window.setLanguage = async function(lang) {
    userState.lang = lang;
    if (typeof applyLanguageSettings === 'function') applyLanguageSettings();

    if (typeof supabaseClient !== 'undefined' && userState.userId) {
        try {
            await supabaseClient.from('users').upsert({ telegram_id: userState.userId, lang }, { onConflict: 'telegram_id' });
        } catch (e) {}
    }

    renderLoginScreen();
};

function getFloatingButton() {
    if (!window.tempSelectedClubs.length) return '';
    return `
        <div style="padding-top: 10px; width: 100%;">
            <div id="confirm-btn" class="btn-pulse" onclick="confirmLogin()">
                ✅ ${safeT('confirmAndContinue', 'Confirm & Continue')} (${window.tempSelectedClubs.length}/2)
            </div>
        </div>
    `;
}

window.renderLoginScreen = function() {
    const topBar = document.getElementById('top-bar');
    const bottomNav = document.getElementById('bottom-nav');
    if (topBar) topBar.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';

    if (!userState.lang) userState.lang = getDefaultLanguage();

    const mainContent = document.getElementById("main-content");
    const isAr = userState.lang === 'ar';

    let countriesHtml = "";

    for (const countryKey in allWorldCupCountriesClubs) {
        const clubsInCountry = allWorldCupCountriesClubs[countryKey];
        if (!clubsInCountry?.length) continue;

        const flag = clubsInCountry[0].countryFlag;
        let countryName = typeof getCountryName === 'function' ? (getCountryName(flag) || countryKey) : countryKey;
        countryName = countryName.charAt(0).toUpperCase() + countryName.slice(1);

        const selectedInThisCountry = clubsInCountry.filter(c => window.tempSelectedClubs.includes(String(c.id))).length;
        const selectionBadge = selectedInThisCountry > 0 
            ? `<span style="background: rgba(0, 255, 135, 0.2); padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; color: #00FF87; border: 1px solid rgba(0, 255, 135, 0.4); font-weight: bold;">✓ ${selectedInThisCountry}</span>`
            : '';

        countriesHtml += `
            <div class="glass-card-elegant interactive-card" onclick="showClubsForCountry('${countryKey}')" 
                 style="padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.6rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">${flag}</span>
                    <h4 style="margin: 0; color: #fff; font-size: 0.95rem; font-weight: 800;">${countryName}</h4>
                    ${selectionBadge}
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 12px; font-size: 0.78rem; font-weight: bold; color: #00FF87; border: 1px solid rgba(255,255,255,0.1);">
                        ${clubsInCountry.length} ⚽
                    </span>
                    <span style="color: #666; font-size: 0.9rem;">${isAr ? '👈' : '👉'}</span>
                </div>
            </div>
        `;
    }

    mainContent.innerHTML = `
        ${getInjectableStyles()}
        <div class="login-screen-wrapper animate-screen">
            <div>
                ${getLanguageSelector()}
                <div class="solana-badge-card">
                    <div style="display: flex; align-items: center; gap: 10px; text-align: ${isAr ? 'right' : 'left'};">
                        <span style="font-size: 1.5rem; filter: drop-shadow(0 0 5px rgba(20, 241, 149, 0.6));">🪙</span>
                        <div>
                            <div style="color: #14F195; font-size: 0.82rem; font-weight: 900;">${safeT('zelofcRewardsTitle', 'Earn $ZELOFC & SOL')}</div>
                            <div style="color: #94a3b8; font-size: 0.7rem; font-weight: bold;">${safeT('zelofcRewardsSub', 'Compete & win official $ZELOFC token rewards')}</div>
                        </div>
                    </div>
                    <span class="token-pill">$ZELOFC</span>
                </div>

                <div style="text-align: center; margin-bottom: 8px;">
                    <h2 style="background: linear-gradient(135deg, #2AABEE, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 4px 0; font-size: 1.3rem; font-weight: 900;">
                        ${safeT('chooseYourClubs', 'Choose Your Clubs')}
                    </h2>
                    <p style="color: #94a3b8; font-size: 0.8rem; margin: 0; font-weight: bold;">
                        ${safeT('clubSelectionLimit', '1 Local + 1 Global Club (Max 2)')}
                    </p>
                </div>
            </div>

            <div class="inner-scroll-area" style="text-align: ${isAr ? 'right' : 'left'};">
                ${countriesHtml}
            </div>

            ${getFloatingButton()}
        </div>
    `;
};

window.showClubsForCountry = function(countryKey) {
    const clubs = allWorldCupCountriesClubs[countryKey];
    if (!clubs) return;

    const mainContent = document.getElementById("main-content");
    const isAr = userState.lang === 'ar';

    let clubsHtml = clubs.map(club => {
        const stringClubId = String(club.id);
        const isSelected = window.tempSelectedClubs.some(id => String(id) === stringClubId);
        const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;

        return `
            <div class="glass-card-elegant interactive-card ${isSelected ? 'club-selected' : ''}" onclick="toggleClubSelection('${stringClubId}', '${countryKey}')" 
                 style="padding: 10px 14px; border-radius: 12px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="background: rgba(0,0,0,0.3); padding: 5px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <img src="${club.logo}" onerror="this.style.display='none'" style="width: 32px; height: 32px; object-fit: contain;">
                    </div>
                    <span style="color: #fff; font-size: 0.9rem; font-weight: 800;">${clubName}</span>
                </div>
                <div style="font-size: 1.1rem;">
                    ${isSelected ? '✅' : '<span style="opacity: 0.2;">⭕</span>'}
                </div>
            </div>
        `;
    }).join('');

    const flag = clubs[0].countryFlag;
    let countryName = typeof getCountryName === 'function' ? (getCountryName(flag) || countryKey) : countryKey;
    countryName = countryName.charAt(0).toUpperCase() + countryName.slice(1);

    mainContent.innerHTML = `
        ${getInjectableStyles()}
        <div class="login-screen-wrapper animate-screen">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div class="btn-back-vip" onclick="renderLoginScreen()">
                        <span>🔙</span> <span>${safeT('btnBack', 'Back to countries')}</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin-bottom: 10px; background: rgba(20, 20, 28, 0.65); padding: 10px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">${flag}</span>
                    <h3 style="color: #fff; margin: 4px 0 0 0; font-weight: 900; font-size: 1.1rem;">${countryName}</h3>
                    <p style="color: #00FF87; font-size: 0.75rem; margin: 2px 0 0 0; font-weight: bold;">${safeT('tapClubHint', 'Tap a club to select it')}</p>
                </div>
            </div>

            <div class="inner-scroll-area" style="text-align: ${isAr ? 'right' : 'left'};">
                ${clubsHtml}
            </div>

            ${getFloatingButton()}
        </div>
    `;
};

window.toggleClubSelection = function(clubId, countryKey) {
    const stringClubId = String(clubId);
    const index = window.tempSelectedClubs.findIndex(id => String(id) === stringClubId);
    
    if (index > -1) {
        window.tempSelectedClubs.splice(index, 1);
    } else {
        if (window.tempSelectedClubs.length < 2) {
            window.tempSelectedClubs.push(stringClubId);
        } else {
            alert(safeT('maxClubsAlert', 'You can select a maximum of 2 clubs (Local & Global) ⚠️'));
            return; 
        }
    }
    
    showClubsForCountry(countryKey);
};

window.confirmLogin = async function() {
    if (!window.tempSelectedClubs.length) {
        alert(safeT('selectAtLeastOne', 'Please select at least one club to continue.'));
        return;
    }

    userState.selectedClubs = [...window.tempSelectedClubs];
    
    const btn = document.getElementById('confirm-btn');
    if (btn) btn.innerHTML = '⏳...';

    if (typeof supabaseClient !== 'undefined' && userState.userId) {
        try {
            const { error: userErr } = await supabaseClient.from('users').upsert({
                telegram_id: userState.userId,
                username: userState.username,
                selected_clubs: userState.selectedClubs,
                lang: userState.lang
            }, { onConflict: 'telegram_id' });

            if (userErr) throw userErr;

            let startingPoints = 0; 
            const { data: userData } = await supabaseClient
                .from('users')
                .select('points')
                .eq('telegram_id', userState.userId)
                .maybeSingle();
            
            if (userData?.points) startingPoints = userData.points;

            const rankingsData = userState.selectedClubs.map(clubId => ({
                telegram_id: userState.userId,
                club_id: String(clubId),
                total_fan_points: startingPoints,
                points_activity: 0,
                referrals_count: 0
            }));

            const { error: rankErr } = await supabaseClient
                .from('club_fans_rankings')
                .upsert(rankingsData, { onConflict: 'telegram_id,club_id' });
            
            if (rankErr) throw rankErr;

            if (userState.pendingReferrer && typeof window.apiProcessReferral === "function") {
                window.apiProcessReferral(userState.pendingReferrer, userState.userId);
                userState.pendingReferrer = null; 
            }

        } catch (error) {
            console.error("Login process error:", error);
            if (btn) btn.innerHTML = safeT('retry', 'Retry 🔄');
            return; 
        }
    }

    userState.hasLoggedIn = true;

    const topBar = document.getElementById('top-bar');
    const bottomNav = document.getElementById('bottom-nav');
    if (topBar) topBar.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = 'flex';

    if (typeof updateTopBar === 'function') updateTopBar();
    if (typeof showPage === 'function') showPage('home');
};
