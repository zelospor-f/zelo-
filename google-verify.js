/* ZELO FC — نواة الشراء عبر Google Play (مركزية)
 * تسجّل كل المنتجات (النقاط + الاشتراكات) وتهيّئ المتجر مرة واحدة فقط،
 * وتربط كل عملية شراء بحساب المستخدم (applicationUsername = sha256("zelo:"+uid))،
 * ثم ترسل الرمز لدالة Supabase "google-verify" وتُنهي العملية فقط بعد نجاح التحقق.
 * أضفه في index.html قبل store.js و premium.js.
 */
(function () {
    'use strict';

    const COINS = ['zelo_coin_100', 'zelo_coin_500', 'zelo_coin_1000', 'zelo_coin_2000', 'zelo_coin_6000'];
    const SUBS = ['zelo_t1_m', 'zelo_t1_y', 'zelo_t2_m', 'zelo_t2_y', 'zelo_t3_m', 'zelo_t3_y'];

    const client = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : (window.supabaseClient || null);
    const isNativeAndroid = () => {
        const c = window.Capacitor;
        return !!(c && c.isNativePlatform && c.isNativePlatform() && c.getPlatform && c.getPlatform() === 'android');
    };

    // ---------- بصمة الحساب ----------
    let acct = '';
    async function prepare() {
        try {
            const c = client();
            const { data } = c ? await c.auth.getSession() : { data: null };
            const uid = data && data.session && data.session.user && data.session.user.id;
            if (!uid) { acct = ''; return ''; }
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zelo:' + uid));
            acct = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (_) { acct = ''; }
        return acct;
    }

    // ---------- التحقق لدى السيرفر ----------
    async function verify(productId, purchaseToken) {
        const c = client();
        if (!c) return { ok: false, msg: 'no_client' };
        try {
            const { data, error } = await c.functions.invoke('google-verify',
                { body: { product_id: productId, purchase_token: purchaseToken } });
            if (error) {
                let msg = error.message || 'error';
                try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
                return { ok: false, msg };
            }
            return (data && data.ok) ? { ok: true, data } : { ok: false, msg: (data && data.error) || 'verify_failed' };
        } catch (e) {
            return { ok: false, msg: String((e && e.message) || e) };
        }
    }

    // ---------- تهيئة المتجر (مرة واحدة) ----------
    let initP = null;
    function init() {
        if (initP) return initP;
        if (!isNativeAndroid() || !window.CdvPurchase || !window.CdvPurchase.store) return Promise.resolve();
        const { store, ProductType, Platform } = window.CdvPurchase;

        store.applicationUsername = () => acct || undefined;

        store.register([
            ...COINS.map(id => ({ id, type: ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY })),
            ...SUBS.map(id => ({ id, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY }))
        ]);

        store.when().approved(async tx => {
            const native = tx.nativePurchase || {};
            const token = native.purchaseToken;
            const productId = (tx.products && tx.products[0] && tx.products[0].id) || native.productId;
            if (!token || !productId || (!COINS.includes(productId) && !SUBS.includes(productId))) return;
            const kind = COINS.includes(productId) ? 'coins' : 'sub';
            const v = await verify(productId, token);
            if (v.ok) { try { await tx.finish(); } catch (_) {} }
            document.dispatchEvent(new CustomEvent('zelo-purchase', { detail: { productId, kind, ok: v.ok, msg: v.msg || '' } }));
        });

        initP = Promise.resolve(store.initialize([Platform.GOOGLE_PLAY]))
            .catch(err => { console.warn('Play Billing unavailable:', err); });
        return initP;
    }

    window.zeloBilling = { init, prepare, isNativeAndroid };

    // حدّث البصمة عند تغيّر الجلسة
    document.addEventListener('deviceready', () => { prepare().then(init); });
    (function watch() {
        const c = client();
        if (!c || !c.auth || !c.auth.onAuthStateChange) { setTimeout(watch, 1500); return; }
        c.auth.onAuthStateChange(() => { prepare(); });
        prepare();
    })();
})();
