(function () {
    'use strict';

    // ====== الإعدادات ======
    // معرّف إعلان المكافأة التجريبي الرسمي من Google (استبدله بمعرّفك الحقيقي قبل النشر)
    const REWARD_AD_ID = 'ca-app-pub-3940256099942544/5224354917';
    const IS_TESTING = true;          // اجعلها false عند النشر
    const COOLDOWN_MS = 30 * 1000;    // فاصل بين إعلان وآخر (الحماية الحقيقية في السيرفر)
    const REWARD_POINTS = 50;         // للعرض فقط، القيمة الفعلية يحددها السيرفر

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);

    const getAdMob = () => window.Capacitor?.Plugins?.AdMob || null;

    let initialized = false;
    let busy = false;
    let lastShownAt = 0;

    async function initAdMob() {
        const AdMob = getAdMob();
        if (!AdMob) return false;
        if (initialized) return true;
        try {
            await AdMob.initialize({ initializeForTesting: IS_TESTING });
            initialized = true;
            return true;
        } catch (e) {
            console.error('[ZELO] فشل تهيئة AdMob:', e);
            return false;
        }
    }

    function setStatus(msg, isError) {
        const el = document.getElementById('zads-status');
        if (!el) return;
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

    // بعد الإعلان: السيرفر يضيف النقاط عبر تحقق Google (SSV)، فنحدّث الرصيد من القاعدة
    async function refreshBalanceAfterReward() {
        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 2500));
            if (typeof window.updateTopBar === 'function') {
                const before = Number(window.userState?.points || 0);
                await window.updateTopBar();
                if (Number(window.userState?.points || 0) > before) {
                    setStatus(L('تمت إضافة النقاط إلى رصيدك ✅', 'Points added to your balance ✅'));
                    return;
                }
            }
        }
        setStatus(L('إذا لم تصل النقاط خلال دقيقة، افتح الصفحة مرة أخرى.', 'If points do not arrive within a minute, reopen this page.'));
    }

    async function watchRewardAd() {
        if (busy) return;

        const AdMob = getAdMob();
        if (!AdMob) {
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

        let rewarded = false;
        const handles = [];

        try {
            if (!(await initAdMob())) throw new Error('init failed');

            handles.push(await AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));

            // ssv.userId: تتلقاه Google وترسله لسيرفرك مع نتيجة التحقق ليعرف لمن يضيف النقاط
            await AdMob.prepareRewardVideoAd({
                adId: REWARD_AD_ID,
                isTesting: IS_TESTING,
                ssv: { userId: String(window.userState.userId) }
            });

            lastShownAt = Date.now();
            await AdMob.showRewardVideoAd();

            if (rewarded) {
                setStatus(L('جارٍ التحقق من المكافأة...', 'Verifying reward...'));
                refreshBalanceAfterReward();
            } else {
                setStatus(L('لم تكتمل مشاهدة الإعلان، لذلك لا توجد مكافأة.', 'Ad was not completed, no reward.'), true);
            }
        } catch (e) {
            console.error('[ZELO] خطأ في إعلان المكافأة:', e);
            setStatus(L('تعذّر عرض الإعلان الآن، حاول لاحقاً.', 'Could not show the ad, try again later.'), true);
        } finally {
            handles.forEach(h => { try { h.remove(); } catch (_) {} });
            busy = false;
            setButton(false, L('📺 شاهد الإعلان', '📺 Watch ad'));
        }
    }

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
                    ${L(`شاهد إعلانًا قصيرًا واحصل على ${REWARD_POINTS} ZELOFC.`,
                        `Watch a short ad and get ${REWARD_POINTS} ZELOFC.`)}
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
        initAdMob();
    }

    window.renderAdsPage = renderAdsPage;
    window.openAdsPage = () => renderAdsPage();
})();
