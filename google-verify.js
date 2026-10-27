/* ZELO FC — ربط التطبيق بالسيرفر للتحقق من مشتريات Google
 * ضعه بجانب store.js، وأضفه إلى قائمة scriptFiles في index.html قبل 'store.js'.
 */
(function () {
    'use strict';

    // رابط السيرفر على Render (نفس الذي يستخدمه تطبيقك لباقي الطلبات مثل /api/claim)
    // إن كان تطبيقك يعرّف window.API_BASE (مثلاً في env.js) فسيُستخدم تلقائياً
    const API_BASE = (window.API_BASE || 'https://YOUR-SERVER.onrender.com').replace(/\/+$/, '');

    // عميل Supabase في تطبيقك اسمه supabaseClient (أما window.supabase فهي المكتبة نفسها)
    function getClient() {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
        if (window.supabaseClient) return window.supabaseClient;
        return null;
    }

    async function getAuthToken() {
        const c = getClient();
        if (!c || !c.auth) return '';
        const { data } = await c.auth.getSession();
        return data?.session?.access_token || '';
    }

    window.zeloVerifyGooglePurchase = async function ({ productId, purchaseToken }) {
        try {
            const token = await getAuthToken();
            if (!token) return false;
            const res = await fetch(API_BASE + '/api/google-purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ productId, purchaseToken })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) return false;

            // حدّث الرصيد المعروض (إن كانت الدفعة مكررة فالسيرفر أضافها سابقاً)
            if (!data.duplicate && window.userState) {
                window.userState.points = Number(window.userState.points || 0) + Number(data.coins || 0);
            }
            if (typeof window.updateTopPoints === 'function') window.updateTopPoints();
            return true;
        } catch (_) {
            return false;   // يبقى الشراء معلّقاً ويُعاد التحقق عند فتح التطبيق
        }
    };
})();
