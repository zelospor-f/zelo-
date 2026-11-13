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
            rewarded:     'ca-app-pub-1758612048958433/8181428602',
            interstitial: '',   // معطّل عمدًا: لا إعلانات تقاطع المستخدم
            banner:       'ca-app-pub-1758612048958433/9630688759'
        }
    };

    const ADS = AD_UNITS[AD_MODE];
    const IS_TESTING = AD_MODE !== 'real';

    const COOLDOWN_MS = 30 * 1000;
    const AD_SLOT_H = 80;       // 8 مسافة + 50 للبانر + 22 لرابط الاشتراك
    // البانر أعلى الشاشة تحت الشريط العلوي مباشرة (مع مسافة 8 عن أزرار الشريط لتفادي النقر بالخطأ)
    const bannerTop = () => { const b = document.getElementById('top-bar'); const h = b ? b.getBoundingClientRect().bottom : 0; return Math.round((h > 40 ? h : 60) + 8); };
    function setAdSlot(on) {
        const el = document.getElementById('bottom-ad-slot');
        if (el) {
            el.style.display = on ? 'flex' : 'none';
            const t = document.getElementById('ad-sub-link');
            if (t) t.textContent = window.zT('اشترك لإزالة الإعلانات', 'Subscribe to remove ads');
        }
        document.documentElement.style.setProperty('--zelo-ad-h', on ? AD_SLOT_H + 'px' : '0px');
    }

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => window.zT(ar, en);

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

    async function getProgress() {
        try {
            const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
            if (!c) return null;
            const { data } = await c.rpc('my_ad_progress');
            return data || null;
        } catch (e) { return null; }
    }

    // ينتظر تسجيل الإعلان في الخادم ثم يعرض التقدّم نحو الكورة التالية
    async function waitForPoints() {
        const b0 = await getProgress();
        const t0 = b0 ? Number(b0.total) : null;
        for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 2500));
            const p = await getProgress();
            if (p && t0 !== null && Number(p.total) > t0) {
                await fetchBalance();
                renderProgress(p);
                const prog = Number(p.progress), per = Number(p.per);
                if (prog === 0) setStatus(L('🎉 ربحت +1 كورة', '🎉 You earned +1 Kora'));
                else setStatus(L(`تم ✅ التقدّم: ${prog} من ${per} إعلانات للكورة القادمة`, `Done ✅ Progress: ${prog} of ${per} ads for the next Kora`));
                return true;
            }
        }
        setStatus(L('إذا لم يُسجَّل الإعلان خلال دقيقة، افتح الصفحة مرة أخرى.', 'If the ad is not counted within a minute, reopen this page.'));
        return false;
    }

    // عدّاد التقدّم: 5 نقاط نحو الكورة التالية + إجمالي الإعلانات
    async function renderProgress(p) {
        const box = document.getElementById('zads-prog');
        if (!box) return;
        p = p || await getProgress();
        if (!p) { box.innerHTML = ''; return; }
        const per = Number(p.per) || 5, prog = Number(p.progress) || 0, total = Number(p.total) || 0;
        let dots = '';
        for (let i = 0; i < per; i++) dots += `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;margin:0 4px;background:${i < prog ? '#fcb045' : 'rgba(255,255,255,.15)'};"></span>`;
        box.innerHTML = `<div>${dots}</div>
            <div style="margin-top:8px;font-size:.85rem;color:#94a3b8;">${L(`${prog} من ${per} للكورة القادمة · شاهدت ${total} إعلانًا`, `${prog} of ${per} to next Kora · ${total} ads watched`)}</div>`;
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
        if (window.ZeloPremium && await window.ZeloPremium.isPremium()) { setAdSlot(false); return; } // المشترك لا يرى البانر
        if (!(await initAdMob())) return;
        setAdSlot(true);
        try {
            await AdMob.showBanner({
                adId: ADS.banner,
                adSize: 'BANNER',
                position: 'TOP_CENTER',
                margin: bannerTop(),
                isTesting: IS_TESTING
            });
            bannerShown = true;
        } catch (e) {
            setAdSlot(false);
            console.error('[ZELO] فشل عرض البانر:', e);
        }
    }

    function startBannerAutoHide() {
        const AdMob = getAdMob();
        if (!AdMob || typeof MutationObserver === 'undefined') return;
        const sel = '#compose-overlay, #reply-overlay, #zsub-overlay, #zp-overlay, #zsup-overlay, #zsup-list-overlay, #zadm, #zban-appeal';
        let drawerOpen = false;
        // أي نافذة/ورقة تغطي أسفل الشاشة (حتى التي لا نعرف اسمها) يُخفى الشريط من فوقها
        const coversBottom = () => {
            const H = window.innerHeight;
            for (const el of document.body.children) {
                const id = el.id || '';
                if (id === 'bottom-nav' || id === 'bottom-ad-slot' || id === 'top-bar' || id.indexOf('zdrawer') === 0) continue;
                const cs = getComputedStyle(el);
                if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
                if ((parseInt(cs.zIndex, 10) || 0) < 100) continue;
                const r = el.getBoundingClientRect();
                if (r.height >= H * 0.35 && r.width >= window.innerWidth * 0.6 && r.bottom >= H - 4) return true;
            }
            return false;
        };
        let lastHide = 0;
        const apply = async () => {
            if (!bannerShown) return;
            const need = drawerOpen || !!document.querySelector(sel) || coversBottom();
            if (need === bannerHidden) {
                // نعيد طلب الإخفاء كل بضع ثوانٍ: قد يعود الإعلان للظهور عند تحديثه تلقائياً
                if (need && Date.now() - lastHide > 2500) {
                    lastHide = Date.now();
                    try { await AdMob.hideBanner(); } catch (e) {}
                }
                return;
            }
            bannerHidden = need;
            lastHide = Date.now();
            try {
                { const sl = document.getElementById('bottom-ad-slot'); if (sl) sl.style.visibility = need ? 'hidden' : 'visible'; } // نُبقي المساحة كي لا تقفز الصفحة
                if (need) await AdMob.hideBanner();
                else await AdMob.resumeBanner();
            } catch (e) {}
        };
        new MutationObserver(apply).observe(document.body, { childList: true, attributes: true, attributeFilter: ['class', 'style'], subtree: false });
        setInterval(apply, 800); // شبكة أمان: أي نافذة تُفتح أو تُغلق تُلتقط خلال أقل من ثانية
        // القائمة الجانبية تبقى في الصفحة وتُفتح بتغيير class، لذلك تُبلغنا بحدث
        window.addEventListener('zdrawer:open', () => { drawerOpen = true; apply(); });
        window.addEventListener('zdrawer:close', () => { drawerOpen = false; apply(); });
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
    window.zeloOfferDoubleReward = function () { /* أُلغيت: لا مهام ولا مضاعفة */ };

    // ---------- صفحة "اربح كورة" ----------
    function renderAdsPage(container) {
        const el = container || document.getElementById('main-content');
        if (!el) return;

        el.innerHTML = `
            <div dir="${window.zA('rtl', 'ltr')}" style="padding:24px 18px; color:#f8fafc; text-align:center;">
                <div style="text-align:start; margin:-8px 0 8px;">${typeof window.zeloBackBtn === 'function' ? window.zeloBackBtn("showPage('home')", isAr()) : '<button onclick="showPage(\'home\')" style="background:transparent;color:#f8fafc;border:1px solid rgba(255,255,255,.2);border-radius:12px;width:40px;height:40px;font-size:20px">' + (window.zA('›', '‹')) + '</button>'}</div>
                <img src="zelo-coin.png" alt="" style="width:84px;height:84px;object-fit:contain;margin-bottom:10px;" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png';}else{this.style.display='none';}">
                <h2 style="font-size:1.4rem; font-weight:900; margin:0 0 8px;">
                    ${L('اربح كورة مجانية', 'Earn free Kora')}
                </h2>
                <p style="color:#94a3b8; margin:0 0 22px; line-height:1.7;">
                    ${L('شاهد إعلانًا قصيرًا واحصل على كورة.',
                        'Watch a short ad and get Kora.')}
                </p>
                <div id="zads-prog" style="margin:0 0 18px;"></div>
                <button id="zads-watch-btn" class="btn-action" style="min-width:220px;">
                    ${L('📺 شاهد الإعلان', '📺 Watch ad')}
                </button>
                <div id="zads-status" style="margin-top:16px; min-height:22px; font-size:0.9rem; color:#94a3b8;"></div>
            </div>
        `;

        document.getElementById('zads-watch-btn')?.addEventListener('click', watchRewardAd);

        // تهيئة مسبقة عند فتح الصفحة
        initAdMob();
        renderProgress();
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
    // الإعلان البيني معطّل عمدًا (لا نقاطع المستخدم). لتفعيله لاحقًا: أنشئ وحدة بينية وأعد السطر التالي.
    // hookNavigation();
})();
