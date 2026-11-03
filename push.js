/* push.js — تسجيل الجهاز لإشعارات Firebase (أندرويد داخل Capacitor فقط) */
(function () {
    'use strict';
    const P = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    let wired = false, lastSent = '';
    // التشخيص مغلق (يُكتب في سجل الجهاز فقط)
    function diag(msg) { try { console.log('[ZELO] push: ' + msg); } catch (e) {} }

    async function saveToken(tok) {
        try {
            if (!tok || tok === lastSent || typeof supabaseClient === 'undefined') return;
            const { error } = await supabaseClient.rpc('register_device', { p_token: tok });
            if (!error) { lastSent = tok; try { localStorage.setItem('zelo_push_tok', tok); } catch (e) {} diag('registered OK'); }
            else diag('rpc error: ' + (error.message || JSON.stringify(error)));
        } catch (e) { diag('save failed: ' + (e && e.message)); }
    }

    async function start() {
        const pn = P();
        if (!native()) return;
        if (!pn) { diag('plugin PushNotifications missing in this build'); return; }
        if (wired) return;
        wired = true;
        try {
            pn.addListener('registration', t => saveToken(t && t.value));
            pn.addListener('registrationError', e => { console.warn('[ZELO] push reg error', e); diag('registrationError: ' + JSON.stringify(e)); });
            // عند الضغط على الإشعار: نفتح الإشعارات
            pn.addListener('pushNotificationActionPerformed', () => {
                try { if (typeof window.showPage === 'function') window.showPage('notifications'); } catch (e) {}
            });
            let perm = await pn.checkPermissions();
            if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await pn.requestPermissions();
            diag('permission=' + perm.receive);
            if (perm.receive === 'granted') await pn.register();
        } catch (e) { console.warn('[ZELO] push init failed', e); diag('init failed: ' + (e && (e.message || e))); }
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
