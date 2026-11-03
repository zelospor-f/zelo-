/* push.js — تسجيل الجهاز لإشعارات Firebase (أندرويد داخل Capacitor فقط) */
(function () {
    'use strict';
    const P = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    let wired = false, lastSent = '';

    async function saveToken(tok) {
        try {
            if (!tok || tok === lastSent || typeof supabaseClient === 'undefined') return;
            const { error } = await supabaseClient.rpc('register_device', { p_token: tok });
            if (!error) { lastSent = tok; try { localStorage.setItem('zelo_push_tok', tok); } catch (e) {} }
        } catch (e) { /* تجاهل */ }
    }

    async function start() {
        const pn = P();
        if (!native() || !pn || wired) return;
        wired = true;
        try {
            pn.addListener('registration', t => saveToken(t && t.value));
            pn.addListener('registrationError', e => console.warn('[ZELO] push reg error', e));
            // عند الضغط على الإشعار: نفتح الإشعارات
            pn.addListener('pushNotificationActionPerformed', () => {
                try { if (typeof window.showPage === 'function') window.showPage('notifications'); } catch (e) {}
            });
            let perm = await pn.checkPermissions();
            if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await pn.requestPermissions();
            if (perm.receive === 'granted') await pn.register();
        } catch (e) { console.warn('[ZELO] push init failed', e); }
    }

    // ننتظر تسجيل الدخول ثم نبدأ
    const t = setInterval(() => {
        if (window.userState && window.userState.userId && typeof supabaseClient !== 'undefined') {
            clearInterval(t);
            setTimeout(start, 3000);
        }
    }, 2000);
    window.zeloPushStart = start;
})();
