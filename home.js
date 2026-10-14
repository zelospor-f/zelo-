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

// دالة فتح الموقع الرسمي
window.openOfficialWebsite = window.openOfficialWebsite || function() {
    const url = "https://zelo-sport-fc.github.io/zelo-fc-site/";
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

// دوال الاستدعاء المعزولة للبروفايل والسوق
window.openProfileScreen = window.openProfileScreen || function() {
    if (typeof window.renderProfilePage === 'function') {
        window.renderProfilePage();
    } else {
        console.log("الانتقال إلى شاشة الملف الشخصي...");
    }
};

window.openNftMarketScreen = window.openNftMarketScreen || function() {
    if (typeof window.renderNftMarketPage === 'function') {
        window.renderNftMarketPage();
    } else {
        console.log("الانتقال إلى سوق الـ NFTs المعزول...");
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
        console.warn("جاري محاولة المزود البديل لسعر سولانا...", err);
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
            console.warn("المزود البديل غير متوفر حالياً...", backupErr);
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

    if (elMaxPrice) elMaxPrice.innerText = `$${maxP.toFixed(2)}`;
    if (elMidPrice) elMidPrice.innerText = `$${((maxP + minP) / 2).toFixed(2)}`;
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

        const txtOfficialSite = t('officialSite', isRtl ? 'الموقع الرسمي' : 'Official Site');
        const txtMarketFeed = t('marketFeed', isRtl ? 'تغذية السوق المباشرة' : 'Live Market Feed');
        const txtLiveMarket = t('liveMarket', isRtl ? 'سوق حي' : 'Live Market');
        const txtLiveSolPrice = t('liveSolPrice', isRtl ? 'سعر $SOL المباشر' : 'Live $SOL Price');
        const txtBidAskSpread = t('bidAskSpread', isRtl ? 'الفارق بين العرض والطلب' : 'Bid/Ask Spread');
        const txtWeeklyChallenges = t('weeklyChallenges', isRtl ? 'تحديات الأسبوع' : 'Weekly Challenges');
        const txtCupsSub = t('cupsSub', isRtl ? '🇪🇺 كؤوس أوروبا • 🇪🇸 كؤوس إسبانيا' : '🇪🇺 European Cups • 🇪🇸 Spanish Cups');
        const txtChallengesRanking = t('challengesRanking', isRtl ? 'ترتيب التحديات' : 'Challenges Ranking');
        const txtRankingSub = t('rankingSub', isRtl ? '⭐ اكتشف أبطال التوقعات وترتيبك' : '⭐ Discover top players & your rank');
        const txtSupportedClubs = t('supportedClubs', isRtl ? 'الأندية المحددة' : 'Supported Clubs');
        const txtActive = t('activeCount', isRtl ? 'نشط 1' : 'Active 1');
        const txtLoading = t('loading', isRtl ? 'جاري التحميل...' : 'Loading...');
        const txtNftMarket = t('nftMarket', isRtl ? 'سوق بطاقات NFTs' : 'NFT Player Market');
        const txtDailyWinners = t('dailyWinners', isRtl ? 'أبطال اليوم واقتناص التوقعات' : 'Today\'s Winners');
        const txtTime1m = '-1m';
        const txtTime30s = '-30s';
        const txtTimeNow = 'Now';
        const txtTimeHigh = 'High';

        target.innerHTML = `
            <style>
                .home-scroll-wrapper {
                    width: 100%;
                    max-height: calc(100vh - 80px);
                    overflow-y: auto;
                    padding: 12px 16px 90px 16px;
                    box-sizing: border-box;
                    background: radial-gradient(circle at 10% 8%, rgba(153, 69, 255, 0.15) 0%, transparent 35%),
                                radial-gradient(circle at 90% 12%, rgba(20, 241, 149, 0.15) 0%, transparent 35%),
                                #08090C;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    direction: ${dir};
                }
                .home-scroll-wrapper::-webkit-scrollbar { display: none; }

                /* الشريط العلوي الهيدر المحدث مع وضع زر الموقع الرسمي في المنتصف */
                .top-header-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 14px;
                    padding: 8px 12px;
                    background: rgba(18, 18, 24, 0.75);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 18px;
                    backdrop-filter: blur(14px);
                }

                .gold-official-btn-center {
                    background: linear-gradient(180deg, #FFE082 0%, #E6A100 100%);
                    color: #000; font-weight: 800; border: none;
                    padding: 6px 16px; border-radius: 10px; font-size: 0.75rem;
                    cursor: pointer; box-shadow: 0 3px 10px rgba(230, 161, 0, 0.22);
                    transition: transform 0.2s;
                }
                .gold-official-btn-center:active { transform: scale(0.95); }

                /* زر التحديث السريع */
                .refresh-bar-area {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 12px; padding: 0 4px;
                }

                .refresh-icon-btn {
                    background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3);
                    color: #14F195; border-radius: 10px; padding: 4px 10px; font-size: 0.72rem;
                    font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;
                }
                .refresh-icon-btn:active { transform: rotate(180deg); }

                /* بطاقة وصول سريعة لسوق الـ NFTs التفاعلية */
                .quick-access-banner {
                    background: linear-gradient(135deg, rgba(153,69,255,0.25) 0%, rgba(20,241,149,0.18) 100%);
                    border: 1px solid rgba(153,69,255,0.4);
                    border-radius: 18px; padding: 14px 16px; margin-bottom: 12px;
                    display: flex; align-items: center; justify-content: space-between;
                    cursor: pointer; backdrop-filter: blur(12px);
                    box-shadow: 0 4px 15px rgba(153, 69, 255, 0.15);
                    transition: transform 0.2s, border-color 0.2s;
                }
                .quick-access-banner:active { transform: scale(0.97); border-color: #14F195; }

                /* بطاقة سولانا */
                .solana-chronicle-card {
                    background: rgba(18, 18, 24, 0.75);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 18px; padding: 14px 16px; margin-bottom: 12px;
                    backdrop-filter: blur(15px);
                }
                .sol-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
                .sol-oracle-badge { font-size: 0.65rem; font-weight: 800; color: #14F195; display: flex; align-items: center; gap: 4px; }
                .sol-sparkline-svg { width: 72%; height: 40px; stroke: #14F195; fill: none; stroke-width: 2.5; stroke-linecap: round; }
                .sol-price-axis { font-family: monospace; font-size: 0.68rem; color: #14F195; opacity: 0.85; text-align: ${isRtl ? 'left' : 'right'}; display: flex; flex-direction: column; gap: 2px; }
                .sol-time-axis { display: flex; justify-content: space-between; width: 72%; font-size: 0.65rem; color: #6b7280; font-weight: 600; margin-top: 2px; }
                .sol-bottom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center; }
                .sol-grid-item span:first-child { display: block; font-size: 0.68rem; color: #9ca3af; font-weight: 600; margin-bottom: 2px; }
                .sol-grid-item span:last-child { font-size: 0.82rem; font-weight: 800; color: #fff; font-family: monospace; }

                /* البانرات التفاعلية الرياضية المحدثة */
                .action-banner-sports {
                    position: relative; border-radius: 18px; padding: 12px 15px; margin-bottom: 10px;
                    display: flex; align-items: center; gap: 12px; cursor: pointer; backdrop-filter: blur(15px);
                    background: linear-gradient(135deg, rgba(28, 28, 38, 0.85) 0%, rgba(18, 18, 24, 0.75) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.1); transition: transform 0.2s, border-color 0.2s;
                }
                .action-banner-sports:active { transform: scale(0.97); background: rgba(35, 35, 48, 0.9); border-color: rgba(20, 241, 149, 0.4); }
                .banner-icon-wrapper-sports { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); }

                /* بطاقات الأندية */
                .glass-club-card {
                    background: rgba(18, 18, 24, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); 
                    border-radius: 16px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
                }
                .club-logo-wrapper { width: 38px; height: 38px; background: rgba(0,0,0,0.4); border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.08); }
                .club-points-badge { background: rgba(255, 215, 0, 0.1); color: #FFD700; padding: 5px 12px; border-radius: 10px; font-weight: 900; font-size: 0.85rem; border: 1px solid rgba(255, 215, 0, 0.25); }
            </style>

            <div class="home-scroll-wrapper">
                <!-- 1. الهيدر العلوي المحدث (أنديتك | زر الموقع في الوسط | ZELOFC) -->
                <div class="top-header-bar">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size: 1.1rem;">⚽</span>
                        <span style="font-size: 0.85rem; font-weight: 800; color: #fff;">${t('yourClubs', isRtl ? 'أنديتك:' : 'Clubs:')}</span>
                    </div>

                    <!-- زر الموقع الرسمي المتموقع بالمنتصف تماماً -->
                    <button class="gold-official-btn-center" onclick="window.openOfficialWebsite()">${txtOfficialSite}</button>

                    <div style="background: rgba(255, 215, 0, 0.1); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255, 215, 0, 0.25); display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 0.8rem; font-weight: 900; color: #FFD700;">ZELOFC</span>
                        <span style="font-size: 0.8rem;">🪙</span>
                    </div>
                </div>

                <!-- 2. زر التحديث الحي والمنظومة -->
                <div class="refresh-bar-area">
                    <span style="font-size:0.75rem; font-weight:800; color:#94a3b8;">ZELO SPORT ECOSYSTEM</span>
                    <button class="refresh-icon-btn" onclick="window.updateHomeSolPrice();">
                        🔄 ${t('refresh', isRtl ? 'تحديث حي' : 'Refresh')}
                    </button>
                </div>

                <!-- 3. بانر فتح سوق الـ NFTs المعزول والمفعل بالنقر -->
                <div class="quick-access-banner" onclick="window.openNftMarketScreen()">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:1.6rem;">👑</span>
                        <div style="text-align: ${textAlign};">
                            <div style="color:#fff; font-weight:900; font-size:0.92rem;">${txtNftMarket}</div>
                            <div style="color:#14F195; font-size:0.72rem; font-weight:700;">${isRtl ? 'بطاقات اللاعبين الأسطورية والأرباح' : 'Legendary Player Cards & Yield'}</div>
                        </div>
                    </div>
                    <div style="color:#14F195; font-size:1.1rem; font-weight:bold;">${arrowIcon}</div>
                </div>

                <!-- 4. بطاقة سعر سولانا المباشرة -->
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

                <!-- 5. بطاقة تحديات الأسبوع المحدثة -->
                <div id="challenges-card" class="action-banner-sports" onclick="if(typeof window.openChallengesScreen === 'function') window.openChallengesScreen();">
                    <div class="banner-icon-wrapper-sports">
                        <span style="font-size:1.3rem;">⚽</span>
                    </div>
                    <div style="flex-grow: 1; text-align: ${textAlign};">
                        <h3 style="color: #fff; margin: 0 0 2px 0; font-size: 0.95rem; font-weight: 900;">${txtWeeklyChallenges}</h3>
                        <p style="color: #93c5fd; font-size: 0.72rem; margin: 0; font-weight: 600;">${txtCupsSub}</p>
                    </div>
                    <div style="color: #eab308; font-size: 1.1rem; font-weight: bold;">${arrowIcon}</div>
                </div>

                <!-- 6. بطاقة ترتيب الأبطال والتوقعات المحدثة -->
                <div id="ranking-card" class="action-banner-sports" onclick="if(typeof window.openLegendaryRankingScreen === 'function') window.openLegendaryRankingScreen();">
                    <div class="banner-icon-wrapper-sports">🏆</div>
                    <div style="flex-grow: 1; text-align: ${textAlign};">
                        <h3 style="color: #fff; margin: 0 0 2px 0; font-size: 0.95rem; font-weight: 900;">${txtDailyWinners}</h3>
                        <p style="color: #fca5a5; font-size: 0.72rem; margin: 0; font-weight: 600;">${txtRankingSub}</p>
                    </div>
                    <div style="color: #eab308; font-size: 1.1rem; font-weight: bold;">${arrowIcon}</div>
                </div>

                <!-- 7. قسم الأندية المحددة -->
                <div class="clubs-section" style="margin-top: 12px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; padding: 0 4px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size: 0.9rem;">🛡️</span>
                            <h3 style="color: #fff; margin: 0; font-size: 0.85rem; font-weight: 800;">${txtSupportedClubs}</h3>
                        </div>
                        <span style="font-size: 0.68rem; color: #14F195; font-weight: 700; background: rgba(20,241,149,0.1); padding: 2px 8px; border-radius: 8px;">${txtActive}</span>
                    </div>

                    <div class="glass-club-card">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="club-logo-wrapper">
                                <span style="font-size: 1.1rem;">⚽</span>
                            </div>
                            <div style="text-align: ${textAlign};">
                                <div style="color:#fff; font-weight:800; font-size:0.85rem;">ZELO FC</div>
                                <div style="color:#94a3b8; font-size:0.68rem;">Global Fan Base</div>
                            </div>
                        </div>
                        <div class="club-points-badge">100%</div>
                    </div>
                </div>
            </div>
        `;

        // تشغيل مؤشر السعر الحي
        window.updateHomeSolPrice();
        window.solPriceInterval = setInterval(window.updateHomeSolPrice, 5000);

    } catch (e) {
        console.error("خطأ أثناء عرض الصفحة الرئيسية:", e);
    }
};
