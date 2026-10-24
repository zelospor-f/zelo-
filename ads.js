(function () {
    'use strict';

    // ====== الإعدادات ======
    // إعدادات Unity Ads (Game ID المحدث من لوحة Unity Dashboard)
    // أسماء الـ placements تطابق ما أنشأته في لوحة Unity بالضبط
    const UNITY = {
        gameId: '800410114',
        rewardPlacement: 'BP_Rewarded_Android',
        bannerPlacement: 'BP_Banner_Android',
        testMode: true                // وضع التجربة: إعلانات تجريبية مؤقتاً
    };
    const COOLDOWN_MS = 30 * 1000;    // فاصل بين المكافآت اليدوية (الحماية الحقيقية في السيرفر)
    const REWARD_POINTS = 50;         // للعرض فقط، القيمة الفعلية يحددها السيرفر
    const TOP_BANNER_MARGIN = 68;     // بُعد البانر عن أعلى الشاشة (يطابق مساحة الإعلان داخل البطاقة العلوية)

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);

    // ====== الجسر إلى إضافة Capacitor الخاصة بـ Unity ======
    const getUnity = () => window.Capacitor?.Plugins?.UnityAds || null;

    let initialized = false;
    let busy = false;
    let lastShownAt = 0;
    let bannerShown = false;

    async function initUnity() {
        const Unity = getUnity();
        if (!Unity) return false;
        if (initialized) return true;
        try {
            await Unity.initialize({ gameId: UNITY.gameId, testMode: UNITY.testMode });
            initialized = true;
            return true;
        } catch (e) {
            console.error('[ZELO] فشل تهيئة Unity Ads:', e);
            return false;
        }
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

    // بعد الإعلان: السيرفر يضيف النقاط عبر callback من Unity، فنسأل القاعدة عدة مرات
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

    // ---------- عرض إعلان مكافأة (عام - مع التحميل المسبق) ----------
    let lastAdError = '';
    async function showRewardAd(customData) {
        const Unity = getUnity();
        if (!Unity) throw new Error('no unity plugin');
        if (!(await initUnity())) throw new Error('init failed');

        try {
            if (typeof Unity.loadRewardedAd === 'function') {
                await Unity.loadRewardedAd({ placementId: UNITY.rewardPlacement });
                await new Promise(r => setTimeout(r, 1500));
            } else if (typeof Unity.load === 'function') {
                await Unity.load({ placementId: UNITY.rewardPlacement });
                await new Promise(r => setTimeout(r, 1500));
            }
        } catch (loadErr) {
            console.warn('[ZELO] تحذير أثناء محاولة التحميل المسبق للإعلان:', loadErr);
        }

        const res = await Unity.showRewardedAd({
            placementId: UNITY.rewardPlacement,
            userId: String(window.userState.userId),
            customData: customData ? String(customData) : undefined
        });
        
        lastAdError = (res && res.error) ? String(res.error) : '';
        return !!(res && res.completed);
    }

    // ---------- 1) المكافأة اليدوية (القائمة الجانبية) ----------
    async function watchRewardAd() {
        if (busy) return;

        if (!getUnity()) {
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
        setButton(true, L('جارٍ تحميل الإعلان...', 'Loading ad...'));
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

    // ---------- 2) البانر أسفل/أعلى الشاشة ----------
    async function showBanner() {
        if (bannerShown) return;
        const Unity = getUnity();
        if (!Unity) return;
        if (!(await initUnity())) return;
        try {
            await Unity.showBanner({
                placementId: UNITY.bannerPlacement,
                position: 'TOP_CENTER',
                margin: TOP_BANNER_MARGIN
            });
            bannerShown = true;
        } catch (e) {
            console.error('[ZELO] فشل عرض البانر:', e);
        }
    }

    function startBannerAutoHide() {
        const Unity = getUnity();
        if (!Unity || typeof MutationObserver === 'undefined') return;
        let hidden = false;
        const sel = '#compose-overlay, #reply-overlay, #zsub-overlay';
        new MutationObserver(async () => {
            if (!bannerShown) return;
            const need = !!document.querySelector(sel);
            if (need === hidden) return;
            hidden = need;
            try {
                if (need) await Unity.hideBanner();
                else await Unity.showBanner({ placementId: UNITY.bannerPlacement, position: 'TOP_CENTER', margin: TOP_BANNER_MARGIN });
            } catch (e) {}
        }).observe(document.body, { childList: true });
    }

    function startBannerWatcher() {
        if (!getUnity()) return;
        const timer = setInterval(() => {
            const nav = document.getElementById('bottom-nav');
            const visible = nav && nav.style.display !== 'none';
            if (visible && window.userState?.userId) {
                clearInterval(timer);
                showBanner();
            }
        }, 2000);
    }

    // ---------- 3) ضاعف مكافأتك بعد المهمة ----------
    window.zeloOfferDoubleReward = function (taskId, points) {
        if (!getUnity() || !window.userState?.userId) return;
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
        initUnity();
    }

    window.renderAdsPage = renderAdsPage;
    window.openAdsPage = () => renderAdsPage();

    startBannerWatcher();
    startBannerAutoHide();
})();
                                                                                                                                                          
