(function () {
    'use strict';

    // ====== إعدادات الإعلانات (AdMob) ======
    // ⚠️ عند الإطلاق على جوجل بلاي غيّر الكلمة التالية من 'test' إلى 'real' فقط
    const AD_MODE = 'test';

    const AD_UNITS = {
        // معرّفات جوجل التجريبية الرسمية (آمنة للتجربة، لا تسبب مشاكل في الحساب)
        test: {
            rewarded:     'ca-app-pub-3940256099942544/5224354917',
            interstitial: 'ca-app-pub-3940256099942544/1033173712',
            banner:       'ca-app-pub-3940256099942544/6300978111'
        },
        // معرّفات الإنتاج الحقيقية من لوحة AdMob (استبدل القيم قبل الإطلاق)
        real: {
            rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/REWARDED_ID',
            interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/INTERSTITIAL_ID',
            banner:       'ca-app-pub-XXXXXXXXXXXXXXXX/BANNER_ID'
        }
    };

    const ADS = AD_UNITS[AD_MODE];
    const IS_TESTING = AD_MODE !== 'real';

    const COOLDOWN_MS = 30 * 1000;
    const REWARD_POINTS = 50;
    const TOP_BANNER_MARGIN = 68;

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);

    const getAdMob = () => window.Capacitor?.Plugins?.AdMob || null;

    let initialized = false;
    let initPromise = null;
    let busy = false;
    let lastShownAt = 0;
    let bannerShown = false;
    let bannerHidden = false;

    let rewardResolver = null;   // دالة إنهاء انتظار إعلان المكافأة الحالي
    let rewardEarned = false;    // هل اكتمل الإعلان ومُنحت المكافأة من جوجل
    let lastAdError = '';

    async function initAdMob() {
        const AdMob = getAdMob();
        if (!AdMob) return false;
        if (initialized) return true;
        if (!initPromise) {
            initPromise = (async () => {
                try {
                    await AdMob.initialize();

                    // الأحداث الخاصة بإعلان المكافأة
                    AdMob.addListener('onRewardedVideoAdReward', () => { rewardEarned = true; });
                    AdMob.addListener('onRewardedVideoAdDismissed', () => finishRewardAd());

                    initialized = true;
                    return true;
                } catch (e) {
                    console.error('[ZELO] فشل تهيئة AdMob:', e);
                    initPromise = null;
                    return false;
                }
            })();
        }
        return initPromise;
    }

    function finishRewardAd() {
        const resolve = rewardResolver;
        rewardResolver = null;
        if (resolve) resolve(rewardEarned);
    }

    // ---------- أدوات مساعدة ----------
    function toast(msg) {
        let el = document.getElementById('zads-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zads-toast';
            el.style.cssText = 'position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:rgba(28,28,34,.97);color:#fff;padding:10px 18px;border-radius:12px;border:1px solid rgba(252,176,69,.3);font-size:.85rem;z-index:4000;transition:opacity .25s;pointer-events:none;max-width:85%;text-align:center;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    function setStatus(msg, isError) {
        const el = document.getElementById('zads-status');
        if (!el) { if (msg) toast(msg); return; }
        el.textContent = msg || '';
        el.style.color = isError ? '#ff6b6b' : '#94a3b8';
    }

    function setButton(disabled, label) {
        const btn = document.getElementById('zads-watch-btn');
        if (!btn) return;
        btn.disabled = disabled;
        btn.style.opacity = disabled ? '0.6' : '1';
        if (label) btn.textContent = label;
    }

    async function fetchBalance() {
        try {
            const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
            const uid = window.userState?.userId;
            if (!c || !uid) return null;
            const { data } = await c.from('users').select('points').eq('user_id', String(uid)).maybeSingle();
            if (data) {
                const p = Number(data.points) || 0;
                window.userState.points = p;
                if (typeof window.updateTopPoints === 'function') window.updateTopPoints();
                return p;
            }
        } catch (e) { /* تجاهل */ }
        return null;
    }

    async function waitForPoints() {
        const before = Number(window.userState?.points || 0);
        for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 2500));
            const now = await fetchBalance();
            if (now !== null && now > before) {
                setStatus(L('تمت إضافة النقاط إلى رصيدك ✅', 'Points added to your balance ✅'));
                return true;
            }
        }
        setStatus(L('إذا لم تصل النقاط خلال دقيقة، افتح الصفحة مرة أخرى.', 'If points do not arrive within a minute, reopen this page.'));
        return false;
    }

    // ---------- عرض إعلان المكافأة ----------
    async function showRewardAd(customData) {
        const AdMob = getAdMob();
        if (!AdMob) throw new Error('no admob plugin');
        if (!(await initAdMob())) throw new Error('init failed');
        if (rewardResolver) return false; // يوجد إعلان قيد التشغيل

        setStatus(L('جارٍ تحميل الإعلان...', 'Loading ad...'));
        rewardEarned = false;
        lastAdError = '';

        const done = new Promise(resolve => { rewardResolver = resolve; });
        try {
            await AdMob.prepareRewardVideoAd({
                adId: ADS.rewarded,
                isTesting: IS_TESTING,
                ssv: {
                    userId: String(window.userState.userId || 'guest'),
                    customData: customData ? String(customData) : ''
                }
            });
            await AdMob.showRewardVideoAd();
        } catch (e) {
            rewardResolver = null;
            lastAdError = e?.message ? String(e.message) : '';
            throw e;
        }
        return done;
    }

    // ---------- 1) المكافأة اليدوية ----------
    async function watchRewardAd() {
        if (busy) return;

        if (!getAdMob()) {
            setStatus(L('الإعلانات تعمل داخل تطبيق الأندرويد فقط.', 'Ads only work inside the Android app.'), true);
            return;
        }
        if (!window.userState?.userId) {
            setStatus(L('سجّل الدخول أولاً.', 'Please sign in first.'), true);
            return;
        }
        const wait = COOLDOWN_MS - (Date.now() - lastShownAt);
        if (wait > 0) {
            setStatus(L(`انتظر ${Math.ceil(wait / 1000)} ثانية قبل الإعلان التالي.`, `Wait ${Math.ceil(wait / 1000)}s before the next ad.`), true);
            return;
        }

        busy = true;
        setButton(true, L('جارٍ التحضير...', 'Preparing...'));
        setStatus('');
        try {
            lastShownAt = Date.now();
            const rewarded = await showRewardAd('manual');
            if (rewarded) {
                setStatus(L('جارٍ التحقق من المكافأة...', 'Verifying reward...'));
                waitForPoints();
            } else {
                setStatus(L('لم تكتمل مشاهدة الإعلان، لذلك لا توجد مكافأة.', 'Ad was not completed, no reward.') + (lastAdError ? ' [' + lastAdError + ']' : ''), true);
            }
        } catch (e) {
            console.error('[ZELO] خطأ في إعلان المكافأة:', e);
            setStatus(L('تعذّر عرض الإعلان الآن، حاول لاحقاً.', 'Could not show the ad, try again later.'), true);
        } finally {
            busy = false;
            setButton(false, L('📺 شاهد الإعلان', '📺 Watch ad'));
        }
    }

    // ---------- 2) البانر ----------
    async function showBanner() {
        if (bannerShown) return;
        const AdMob = getAdMob();
        if (!AdMob) return;
        if (window.ZeloPremium && await window.ZeloPremium.isPremium()) return; // المشترك لا يرى البانر
        if (!(await initAdMob())) return;
        try {
            await AdMob.showBanner({
                adId: ADS.banner,
                adSize: 'BANNER',
                position: 'TOP_CENTER',
                margin: TOP_BANNER_MARGIN,
                isTesting: IS_TESTING
            });
            bannerShown = true;
        } catch (e) {
            console.error('[ZELO] فشل عرض البانر:', e);
        }
    }

    function startBannerAutoHide() {
        const AdMob = getAdMob();
        if (!AdMob || typeof MutationObserver === 'undefined') return;
        const sel = '#compose-overlay, #reply-overlay, #zsub-overlay';
        new MutationObserver(async () => {
            if (!bannerShown) return;
            const need = !!document.querySelector(sel);
            if (need === bannerHidden) return;
            bannerHidden = need;
            try {
                if (need) await AdMob.hideBanner();
                else await AdMob.resumeBanner();
            } catch (e) {}
        }).observe(document.body, { childList: true });
    }

    function startBannerWatcher() {
        if (!getAdMob()) return;
        const timer = setInterval(() => {
            const nav = document.getElementById('bottom-nav');
            const visible = nav && nav.style.display !== 'none';
            if (visible && window.userState?.userId) {
                clearInterval(timer);
                showBanner();
            }
        }, 2000);
    }

    // ---------- 3) ضاعف مكافأتك ----------
    window.zeloOfferDoubleReward = function (taskId, points) {
        if (!getAdMob() || !window.userState?.userId) return;
        if (document.getElementById('zads-double-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'zads-double-modal';
        overlay.dir = isAr() ? 'rtl' : 'ltr';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:3500;padding:20px;';
        overlay.innerHTML = `
            <div style="background:#121215;border:1px solid rgba(252,176,69,.35);border-radius:18px;padding:24px 20px;max-width:320px;width:100%;text-align:center;color:#f8fafc;">
                <div style="font-size:2.6rem;margin-bottom:8px;">⚡</div>
                <h3 style="margin:0 0 8px;font-size:1.15rem;font-weight:900;">${L('ضاعف مكافأتك!', 'Double your reward!')}</h3>
                <p style="color:#94a3b8;margin:0 0 18px;line-height:1.7;font-size:.9rem;">
                    ${L(`شاهد إعلانًا قصيرًا واحصل على +${points} ZELO إضافية.`, `Watch a short ad and get +${points} extra ZELO.`)}
                </p>
                <button id="zads-double-yes" class="btn-action" style="margin-top:0;">${L('📺 ضاعف الآن', '📺 Double now')}</button>
                <button id="zads-double-no" style="margin-top:12px;background:transparent;color:#888899;font-weight:700;font-size:.9rem;padding:8px;">${L('لا، شكرًا', 'No thanks')}</button>
            </div>`;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#zads-double-no').onclick = close;
        overlay.querySelector('#zads-double-yes').onclick = async () => {
            if (busy) return;
            busy = true;
            close();
            try {
                const rewarded = await showRewardAd('double:' + taskId);
                if (rewarded) {
                    toast(L('جارٍ التحقق من المضاعفة...', 'Verifying bonus...'));
                    if (await waitForPoints()) toast(L('تمت مضاعفة المكافأة 🎉', 'Reward doubled 🎉'));
                } else {
                    toast(L('لم تكتمل المشاهدة، لا توجد مضاعفة.', 'Ad not completed, no bonus.'));
                }
            } catch (e) {
                console.error('[ZELO] خطأ في إعلان المضاعفة:', e);
                toast(L('تعذّر عرض الإعلان الآن.', 'Could not show the ad.'));
            } finally {
                busy = false;
            }
        };
    };

    // ---------- صفحة "اربح نقاط" ----------
    function renderAdsPage(container) {
        const el = container || document.getElementById('main-content');
        if (!el) return;

        el.innerHTML = `
            <div dir="${isAr() ? 'rtl' : 'ltr'}" style="padding:24px 18px; color:#f8fafc; text-align:center;">
                <div style="font-size:3rem; margin-bottom:10px;">🎁</div>
                <h2 style="font-size:1.4rem; font-weight:900; margin:0 0 8px;">
                    ${L('اربح نقاط مجانية', 'Earn free points')}
                </h2>
                <p style="color:#94a3b8; margin:0 0 22px; line-height:1.7;">
                    ${L(`شاهد إعلانًا قصيرًا واحصل على ${REWARD_POINTS} ZELO.`,
                        `Watch a short ad and get ${REWARD_POINTS} ZELO.`)}
                </p>
                <button id="zads-watch-btn" class="btn-action" style="min-width:220px;">
                    ${L('📺 شاهد الإعلان', '📺 Watch ad')}
                </button>
                <div id="zads-status" style="margin-top:16px; min-height:22px; font-size:0.9rem; color:#94a3b8;"></div>
                <button class="btn-action" style="margin-top:24px; background:transparent; border:1px solid rgba(255,255,255,0.15);"
                        onclick="showPage('home')">
                    ${L('العودة للرئيسية', 'Back to Home')}
                </button>
            </div>
        `;

        document.getElementById('zads-watch-btn')?.addEventListener('click', watchRewardAd);

        // تهيئة مسبقة عند فتح الصفحة
        initAdMob();
    }

    // ---------- 4) الإعلان البيني (يظهر عند التنقل بين الصفحات) ----------
    const INTERSTITIAL_COOLDOWN_MS = 8 * 60 * 1000;     // 8 دقائق على الأقل بين إعلانين
    const INTERSTITIAL_EVERY = 8;                       // إعلان كل 8 انتقالات بين الصفحات
    const INTERSTITIAL_FIRST_DELAY_MS = 5 * 60 * 1000;  // لا إعلان في أول 5 دقائق
    const startedAt = Date.now();
    let lastInterstitialAt = 0;
    let navCount = 0;

    async function showInterstitial() {
        if (window.ZeloPremium && await window.ZeloPremium.isPremium()) return; // المشترك لا يرى الإعلان البيني
        if (busy) return;
        const AdMob = getAdMob();
        if (!AdMob || !window.userState?.userId) return;
        if (document.getElementById('zads-watch-btn')) return; // لا بيني داخل صفحة المكافآت
        if (Date.now() - startedAt < INTERSTITIAL_FIRST_DELAY_MS) return;
        if (Date.now() - lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return;
        if (!(await initAdMob())) return;

        busy = true;
        lastInterstitialAt = Date.now();
        try {
            await AdMob.prepareInterstitial({
                adId: ADS.interstitial,
                isTesting: IS_TESTING
            });
            await AdMob.showInterstitial();
        } catch (e) {
            console.warn('[ZELO] فشل الإعلان البيني:', e);
        } finally {
            busy = false;
        }
    }

    function hookNavigation() {
        const timer = setInterval(() => {
            if (typeof window.showPage !== 'function' || window.showPage.__zadsHooked) return;
            clearInterval(timer);
            const original = window.showPage;
            window.showPage = function () {
                const result = original.apply(this, arguments);
                navCount++;
                if (navCount % INTERSTITIAL_EVERY === 0) showInterstitial();
                return result;
            };
            window.showPage.__zadsHooked = true;
        }, 1000);
    }

    window.renderAdsPage = renderAdsPage;
    window.openAdsPage = () => renderAdsPage();

    startBannerWatcher();
    startBannerAutoHide();
    hookNavigation();
})();
