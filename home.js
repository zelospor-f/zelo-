window.solPriceHistory = window.solPriceHistory || [];

function getCurrentLang() {
    return localStorage.getItem('app_lang') || 
           localStorage.getItem('lang') || 
           localStorage.getItem('language') || 
           (typeof userState !== 'undefined' && userState?.lang) || 
           window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || 
           'ar';
}

function t(key, fallback = '', params = {}) {
    const currentLang = getCurrentLang();
    let text = fallback || key;

    if (window.i18n && window.i18n[currentLang] && window.i18n[currentLang][key] !== undefined) {
        text = window.i18n[currentLang][key];
    } else if (typeof window.getT === 'function') {
        const res = window.getT(key);
        if (res && res !== key) text = res;
    }

    if (params && typeof params === 'object') {
        Object.keys(params).forEach(p => {
            text = text.replace(new RegExp(`{${p}}`, 'g'), params[p]);
        });
    }
    return text;
}

window.openOfficialWebsite = window.openOfficialWebsite || function() {
    const url = "https://zelo-sport-fc.github.io/zelo-fc-site/";
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

window.updateHomeSolPrice = async function() {
    const elPriceHeader = document.getElementById('home-sol-price');
    const elPriceOracle = document.getElementById('home-sol-oracle-val');
    const elLivePrice = document.getElementById('home-sol-live-price');
    const elPythConf = document.getElementById('home-sol-pyth-conf');
    const elMaxPrice = document.getElementById('home-sol-max-price');
    const elMidPrice = document.getElementById('home-sol-mid-price');
    const elMinPrice = document.getElementById('home-sol-min-price');
    const svgPath = document.getElementById('home-sol-svg-path');

    let realPrice = 0;
    let realSpread = "0.0100";

    try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=SOLUSDT');
        if (res.ok) {
            const data = await res.json();
            if (data && data.bidPrice && data.askPrice) {
                const bid = parseFloat(data.bidPrice);
                const ask = parseFloat(data.askPrice);
                realPrice = (bid + ask) / 2;
                realSpread = (ask - bid).toFixed(4);
            }
        }
    } catch (err) {
        console.warn("Binance API fetch warning, trying backup...", err);
    }

    if (!realPrice || isNaN(realPrice) || realPrice <= 0) {
        try {
            const resBackup = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            if (resBackup.ok) {
                const dataBackup = await resBackup.json();
                if (dataBackup && dataBackup.solana && dataBackup.solana.usd) {
                    realPrice = parseFloat(dataBackup.solana.usd);
                    realSpread = "0.0200";
                }
            }
        } catch (backupErr) {
            console.warn("Backup API fetch warning...", backupErr);
        }
    }

    if (!realPrice || isNaN(realPrice) || realPrice <= 0) {
        if (window.solPriceHistory.length > 0) {
            realPrice = window.solPriceHistory[window.solPriceHistory.length - 1];
        } else {
            return;
        }
    }

    const finalPriceStr = `$${realPrice.toFixed(2)}`;
    
    window.solPriceHistory.push(realPrice);
    if (window.solPriceHistory.length > 20) {
        window.solPriceHistory.shift();
    }

    if (elPriceHeader) elPriceHeader.innerText = finalPriceStr;
    if (elPriceOracle) elPriceOracle.innerText = finalPriceStr;
    if (elLivePrice) elLivePrice.innerText = finalPriceStr;
    if (elPythConf) elPythConf.innerText = realSpread;

    const history = window.solPriceHistory;
    const maxP = Math.max(...history);
    const minP = Math.min(...history);
    const midP = (maxP + minP) / 2;

    if (elMaxPrice) elMaxPrice.innerText = `$${maxP.toFixed(2)}`;
    if (elMidPrice) elMidPrice.innerText = `$${midP.toFixed(2)}`;
    if (elMinPrice) elMinPrice.innerText = `$${minP.toFixed(2)}`;

    if (svgPath && history.length > 1) {
        const range = (maxP - minP) || 0.05;
        const width = 200;
        const height = 30;
        
        const points = history.map((val, idx) => {
            const x = (idx / (history.length - 1)) * width;
            const normY = (val - minP) / range;
            const y = (height - 4) - (normY * (height - 8));
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });

        let pathD = `M ${points[0]}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i]}`;
        }
        svgPath.setAttribute('d', pathD);
    }
};

window.renderHomePage = function(container) {
    let target = container || document.getElementById('app') || document.getElementById('main-content') || document.body;
    if (!target) return;

    if (window.solPriceInterval) {
        clearInterval(window.solPriceInterval);
    }

    try {
        const currentLang = getCurrentLang();
        const isRtl = currentLang.startsWith('ar');
        const dir = isRtl ? 'rtl' : 'ltr';
        const textAlign = isRtl ? 'right' : 'left';
        const arrowIcon = isRtl ? '👈' : '👉';

        const state = (typeof userState !== 'undefined' && userState) ? userState : { 
            username: '@Zelo_fc', 
            userId: '1654537339' 
        };

        const txtOfficialSite = t('officialSite', 'Official Website');
        const txtMarketFeed = t('marketFeed', 'Live Market Feed');
        const txtLiveMarket = t('liveMarket', 'Live Market');
        const txtLiveSolPrice = t('liveSolPrice', 'Live $SOL Price');
        const txtBidAskSpread = t('bidAskSpread', 'Bid/Ask Spread');
        const txtWeeklyChallenges = t('weeklyChallenges', 'Weekly Challenges');
        const txtCupsSub = t('cupsSub', '🇪🇺 European Cups • 🇪🇸 Spanish Cups');
        const txtChallengesRanking = t('challengesRanking', 'Challenges Ranking');
        const txtRankingSub = t('rankingSub', '⭐ Discover top players & your rank');
        const txtSupportedClubs = t('supportedClubs', 'Supported Clubs');
        const txtActive = t('activeCount', 'Active 1');
        const txtFans = t('fansCount', '3 Fans');
        const txtLoading = t('loading', 'Loading...');
        const txtTime1m = '-1m';
        const txtTime30s = '-30s';
        const txtTimeNow = 'Now';
        const txtTimeHigh = 'High';

        const username = state.username || '@Zelo_fc';
        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1c1c22&color=14F195&size=128&bold=true`;
        const avatarSrc = state.photoUrl ? state.photoUrl : fallbackAvatar;

        target.innerHTML = `
            <style>
                .home-scroll-wrapper {
                    width: 100%;
                    max-height: calc(100vh - 130px);
                    overflow-y: auto;
                    padding: 10px 16px 90px 16px;
                    box-sizing: border-box;
                    background: radial-gradient(circle at 10% 8%, rgba(153, 69, 255, 0.15) 0%, transparent 35%),
                                radial-gradient(circle at 90% 12%, rgba(20, 241, 149, 0.15) 0%, transparent 35%),
                                #08090C;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    direction: ${dir};
                }
                .home-scroll-wrapper::-webkit-scrollbar { display: none; }

                .royal-profile-card {
                    position: relative;
                    background: rgba(18, 18, 24, 0.75);
                    border-radius: 20px;
                    padding: 35px 15px 18px 15px;
                    margin-top: 25px;
                    margin-bottom: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    text-align: center;
                    backdrop-filter: blur(15px);
                }

                .royal-avatar-wrapper {
                    position: absolute; top: -35px; left: 50%;
                    transform: translateX(-50%); width: 68px; height: 68px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #9945FF, #14F195);
                    padding: 3px; z-index: 2;
                }

                .royal-avatar-inner {
                    width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
                    border: 2px solid #121215; background: #111;
                }
                .royal-avatar-inner img { width: 100%; height: 100%; object-fit: cover; }

                .gold-official-btn {
                    background: linear-gradient(180deg, #FFE082 0%, #E6A100 100%);
                    color: #000;
                    font-weight: 800;
                    border: none;
                    padding: 7px 24px;
                    border-radius: 12px;
                    font-size: 0.82rem;
                    margin-top: 10px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(230, 161, 0, 0.25);
                    transition: transform 0.2s;
                }
                .gold-official-btn:active { transform: scale(0.96); }

                .solana-chronicle-card {
                    background: rgba(18, 18, 24, 0.75);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 18px;
                    padding: 14px 16px;
                    margin-bottom: 12px;
                    backdrop-filter: blur(15px);
                }

                .sol-card-header {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 8px;
                }

                .sol-oracle-badge {
                    font-size: 0.65rem; font-weight: 800; color: #14F195;
                    display: flex; align-items: center; gap: 4px; text-transform: uppercase;
                }

                .sol-chart-area {
                    margin: 8px 0;
                    position: relative;
                }

                .sol-sparkline-svg {
                    width: 72%; height: 40px; stroke: #14F195; fill: none; stroke-width: 2.5; stroke-linecap: round;
                }

                .sol-price-axis {
                    font-family: monospace; font-size: 0.68rem; color: #14F195; opacity: 0.85;
                    text-align: ${isRtl ? 'left' : 'right'}; display: flex; flex-direction: column; gap: 2px;
                }

                .sol-time-axis {
                    display: flex; justify-content: space-between; width: 72%;
                    font-size: 0.65rem; color: #6b7280; font-weight: 600; margin-top: 2px;
                }

                .sol-bottom-grid {
                    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
                    margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06);
                    text-align: center;
                }

                .sol-grid-item span:first-child {
                    display: block; font-size: 0.68rem; color: #9ca3af; font-weight: 600; margin-bottom: 2px;
                }
                .sol-grid-item span:last-child {
                    font-size: 0.82rem; font-weight: 800; color: #fff; font-family: monospace;
                }

                .action-banner {
                    position: relative; 
                    border-radius: 18px; 
                    padding: 12px 15px; 
                    margin-bottom: 10px;
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    cursor: pointer; 
                    backdrop-filter: blur(15px);
                    background: rgba(18, 18, 24, 0.75); 
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    transition: background 0.2s, border-color 0.2s;
                }

                .action-banner:active {
                    background: rgba(30, 30, 40, 0.85);
                    border-color: rgba(255, 255, 255, 0.15);
                }

                .banner-icon-wrapper {
                    width: 42px; height: 42px; border-radius: 12px; display: flex;
                    align-items: center; justify-content: center; font-size: 1.3rem;
                    background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
                }

                .glass-club-card {
                    background: rgba(18, 18, 24, 0.75);
                    backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); 
                    border-radius: 16px; padding: 10px 14px; display: flex; align-items: center;
                    justify-content: space-between; margin-bottom: 8px;
                }

                .club-logo-wrapper {
                    width: 38px; height: 38px; background: rgba(0,0,0,0.4);
                    border-radius: 12px; display: flex; align-items: center; justify-content: center;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }

                .club-points-badge {
                    background: rgba(255, 215, 0, 0.1);
                    color: #FFD700; padding: 5px 12px; border-radius: 10px; font-weight: 900; font-size: 0.85rem;
                    border: 1px solid rgba(255, 215, 0, 0.25);
                }
            </style>

            <div class="home-scroll-wrapper">
                <div class="royal-profile-card">
                    <div class="royal-avatar-wrapper">
                        <div class="royal-avatar-inner">
                            <img src="${avatarSrc}" alt="Avatar">
                        </div>
                    </div>
                    <h2 style="margin: 15px 0 2px 0; color: #fff; font-size: 1.15rem; font-weight: 900;">${username}</h2>
                    <button class="gold-official-btn" onclick="window.openOfficialWebsite()">${txtOfficialSite}</button>
                </div>

                <div class="solana-chronicle-card">
                    <div class="sol-card-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width:36px; height:36px; background:rgba(153,69,255,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(153,69,255,0.3);">
                                <img src="https://cryptologos.cc/logos/solana-sol-logo.png" style="width: 20px; height: 20px;" alt="Solana">
                            </div>
                            <div style="text-align: ${textAlign};">
                                <div style="color: #fff; font-weight: 900; font-size: 0.95rem;">Solana</div>
                                <div style="color: #94a3b8; font-size: 0.7rem; font-weight: 600;">${txtMarketFeed}</div>
                            </div>
                        </div>
                        <div style="text-align: ${isRtl ? 'left' : 'right'};">
                            <div class="sol-oracle-badge">
                                <span style="width: 5px; height: 5px; background: #14F195; border-radius: 50%;"></span> ${txtLiveMarket}
                            </div>
                            <div id="home-sol-price" style="color: #14F195; font-family: monospace; font-weight: 900; font-size: 1.1rem; margin-top: 1px;">${txtLoading}</div>
                        </div>
                    </div>

                    <div style="color: #94a3b8; font-size: 0.72rem; font-weight: 700; margin-top: 4px; text-align: ${textAlign};">${txtLiveSolPrice}</div>

                    <div class="sol-chart-area">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <svg class="sol-sparkline-svg" viewBox="0 0 200 30">
                                <path id="home-sol-svg-path" d="M0,15 L200,15" />
                            </svg>
                            <div class="sol-price-axis">
                                <div id="home-sol-max-price">--.--</div>
                                <div id="home-sol-mid-price">--.--</div>
                                <div id="home-sol-min-price">--.--</div>
                            </div>
                        </div>
                        <div class="sol-time-axis">
                            <span>${txtTime1m}</span>
                            <span>${txtTime30s}</span>
                            <span>${txtTimeNow}</span>
                            <span>${txtTimeHigh}</span>
                        </div>
                    </div>

                    <div class="sol-bottom-grid">
                        <div class="sol-grid-item">
                            <span>${txtLiveSolPrice}</span>
                            <span id="home-sol-live-price">--.--</span>
                        </div>
                        <div class="sol-grid-item">
                            <span>${txtBidAskSpread}</span>
                            <span id="home-sol-pyth-conf">0.0000</span>
                        </div>
                        <div class="sol-grid-item">
                            <span>${txtMarketFeed}</span>
                            <span id="home-sol-oracle-val">--.--</span>
                        </div>
                    </div>
                </div>

                <div id="challenges-card" class="action-banner" onclick="if(typeof window.openChallengesScreen === 'function') window.openChallengesScreen();">
                    <div class="banner-icon-wrapper">
                        <span style="font-size:1.2rem;">🇬🇧</span>
                    </div>
                    <div style="flex-grow: 1; text-align: ${textAlign};">
                        <h3 style="color: #fff; margin: 0 0 2px 0; font-size: 0.95rem; font-weight: 900;">${txtWeeklyChallenges}</h3>
                        <p style="color: #93c5fd; font-size: 0.72rem; margin: 0; font-weight: 600;">${txtCupsSub}</p>
                    </div>
                    <div style="color: #eab308; font-size: 1.1rem; font-weight: bold;">${arrowIcon}</div>
                </div>

                <div id="ranking-card" class="action-banner" onclick="if(typeof window.openLegendaryRankingScreen === 'function') window.openLegendaryRankingScreen();">
                    <div class="banner-icon-wrapper">🔥</div>
                    <div style="flex-grow: 1; text-align: ${textAlign};">
                        <h3 style="color: #fff; margin: 0 0 2px 0; font-size: 0.95rem; font-weight: 900;">${txtChallengesRanking}</h3>
                        <p style="color: #fca5a5; font-size: 0.72rem; margin: 0; font-weight: 600;">${txtRankingSub}</p>
                    </div>
                    <div style="color: #eab308; font-size: 1.1rem; font-weight: bold;">${arrowIcon}</div>
                </div>

                <div class="clubs-section" style="margin-top: 12px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; padding: 0 4px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size: 0.9rem;">🛡️</span>
                                                        <h4 style="color: #fff; margin: 0; font-size: 0.88rem; font-weight: 800;">${txtSupportedClubs}</h4>
                        </div>
                        <span style="color: #14F195; font-size: 0.72rem; font-weight: 800;">${txtActive}</span>
                    </div>

                    <div class="glass-club-card">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="club-logo-wrapper">
                                <span style="font-size: 1.2rem;">🔴</span>
                            </div>
                            <div style="text-align: ${textAlign};">
                                <div style="color: #fff; font-weight: 800; font-size: 0.9rem;">Liverpool FC</div>
                                <div style="color: #94a3b8; font-size: 0.72rem;">${txtFans}</div>
                            </div>
                        </div>
                        <div class="club-points-badge">100 ZELOFC</div>
                    </div>
                </div>
            </div>
        `;

        window.updateHomeSolPrice();
        window.solPriceInterval = setInterval(window.updateHomeSolPrice, 5000);

    } catch (err) {
        console.error("Error rendering home page:", err);
    }
};
