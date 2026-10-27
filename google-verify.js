/* ZELO FC — ربط التطبيق بالسيرفر للتحقق من مشتريات Google
 * ضعه في تطبيقك (أو الصق محتواه في ملف JS يُحمَّل قبل store.js).
 * عدّل السطرين المعلّمين بـ TODO ليطابقا طريقة اتصال تطبيقك بالسيرفر.
 */
(function () {
    'use strict';

    // TODO 1: رابط السيرفر (نفس الذي يستخدمه تطبيقك لباقي الطلبات، مثل /api/claim)
    const API_BASE = window.API_BASE || 'https://YOUR-SERVER.onrender.com';

    // TODO 2: دالة ترجع توكن Supabase للمستخدم الحالي (JWT)
    async function getAuthToken() {
        const { data } = await window.supabase.auth.getSession();
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
            return true;
        } catch (_) {
            return false;   // يبقى الشراء معلّقاً ويُعاد التحقق عند فتح التطبيق
        }
    };
})();
