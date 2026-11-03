/* push.js — تسجيل الجهاز لإشعارات Firebase (أندرويد داخل Capacitor فقط) */
(function () {
    'use strict';
    const P = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    let wired = false, lastSent = '';
    // رسالة تشخيص ظاهرة (مؤقتة) ليتبيّن سبب أي فشل على الجهاز
    function diag(msg) {
        try {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;left:10px;right:10px;bottom:90px;z-index:99999;background:#1b2559;color:#fff;border:1px solid #fcb045;border-radius:12px;padding:10px 12px;font-size:12px;direction:ltr;word-break:break-word';
            d.textContent = 'PUSH: ' + msg;
            document.body.appendChild(d);
            setTimeout(() => d.remove(), 12000);
        } catch (e) {}
    }

    // اختبار لمرة واحدة: يرسل إشعارًا إلى هذا الجهاز بعد 20 ثانية (اضغط زر الرئيسية لترى الإشعار)
    function scheduleTest() {
        try { if (localStorage.getItem('zelo_push_test_done')) return; } catch (e) {}
        diag('اضغط زر الرئيسية الآن لتخرج من التطبيق وانتظر 20 ثانية ... Press Home now');
        setTimeout(async () => {
            try {
                const r = await supabaseClient.functions.invoke('push-test');
                try { localStorage.setItem('zelo_push_test_done', '1'); } catch (e) {}
                diag('test result: ' + JSON.stringify((r && (r.data || r.error && r.error.message)) || r));
            } catch (e) { diag('test failed: ' + (e && e.message)); }
        }, 20000);
    }

    async function saveToken(tok) {
        try {
            if (!tok || tok === lastSent || typeof supabaseClient === 'undefined') return;
            const { error } = await supabaseClient.rpc('register_device', { p_token: tok });
            if (!error) { lastSent = tok; try { localStorage.setItem('zelo_push_tok', tok); } catch (e) {} diag('registered OK'); scheduleTest(); }
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
