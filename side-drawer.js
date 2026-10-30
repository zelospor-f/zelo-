(function () {
    'use strict';

    const SUPPORT_EMAIL = 'support@zelosport.net';
    const SITE = 'https://zelosport.net/';
    const APP_VERSION = '1.0';

    const CSS = `
        .zdrawer-overlay {
            position: fixed; inset: 0;
            background: rgba(3, 6, 24, 0.62);
            -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
            opacity: 0; pointer-events: none;
            visibility: hidden;
            transition: opacity 0.25s ease, visibility 0s linear 0.25s;
            z-index: 2000;
        }
        .zdrawer-overlay.open {
            opacity: 1; pointer-events: auto;
            visibility: visible;
            transition: opacity 0.25s ease, visibility 0s;
        }

        .zdrawer {
            position: fixed; top: 0; bottom: 0;
            width: min(84%, 330px);
            background: linear-gradient(180deg, #0f1a5c 0%, #0a1033 38%, #080d2a 100%);
            color: #e8ecff;
            z-index: 2001;
            display: flex; flex-direction: column;
            overflow-y: auto; overscroll-behavior: contain;
            visibility: hidden;
            pointer-events: none;
            transition: transform 0.3s cubic-bezier(.2,.8,.2,1), visibility 0s linear 0.3s;
        }
        .zdrawer.open {
            visibility: visible;
            pointer-events: auto;
            transition: transform 0.3s cubic-bezier(.2,.8,.2,1), visibility 0s;
        }
        .zdrawer.from-right {
            right: 0;
            transform: translateX(100%);
            border-left: 1px solid rgba(245,195,90, 0.22);
            box-shadow: -12px 0 36px rgba(0, 0, 0, 0.65);
        }
        .zdrawer.from-left {
            left: 0;
            transform: translateX(-100%);
            border-right: 1px solid rgba(245,195,90, 0.22);
            box-shadow: 12px 0 36px rgba(0, 0, 0, 0.65);
        }
        .zdrawer.from-right.open,
        .zdrawer.from-left.open { transform: translateX(0); }

        /* ===== الرأس ===== */
        .zdrawer-header {
            padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 18px;
            background: radial-gradient(120% 100% at 50% 0%, rgba(245,195,90,0.16) 0%, rgba(245,195,90,0) 70%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }
        .zdrawer-avatar-ring {
            width: 74px; height: 74px; border-radius: 50%; padding: 3px; margin-bottom: 12px;
            background: conic-gradient(from 200deg, #f5c35a, #fde9a8, #2c4bb5, #f5c35a);
        }
        .zdrawer-avatar {
            width: 100%; height: 100%; border-radius: 50%;
            background: #14206b;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.7rem; font-weight: 900; color: #fff; overflow: hidden;
        }
        .zdrawer-name { font-size: 1.15rem; font-weight: 900; color: #fff; margin-bottom: 2px; }
        .zdrawer-handle { font-size: 0.85rem; color: #8f9bd0; direction: ltr; text-align: start; }

        /* ===== الأقسام ===== */
        .zdrawer-section { padding: 6px 0 2px; }
        .zdrawer-section-title {
            padding: 10px 22px 4px;
            font-size: 0.72rem; font-weight: 700; letter-spacing: 0.6px;
            color: #6f7bb3;
        }
        .zdrawer-divider { height: 1px; background: rgba(255, 255, 255, 0.07); margin: 8px 18px; }

        .zdrawer-item {
            width: calc(100% - 20px); margin: 2px 10px;
            display: flex; align-items: center; gap: 12px;
            padding: 9px 10px;
            background: transparent; border: none; outline: none; border-radius: 14px;
            color: #e8ecff; font-size: 0.98rem; font-weight: 700;
            cursor: pointer; text-align: start; font-family: inherit;
            -webkit-tap-highlight-color: transparent;
            transition: background 0.18s ease, transform 0.12s ease;
        }
        .zdrawer-item:active { background: rgba(255,255,255,0.07); transform: scale(0.985); }
        .zdrawer-icon {
            width: 36px; height: 36px; border-radius: 11px; flex: none;
            display: flex; align-items: center; justify-content: center;
            background: rgba(245,195,90,0.10); color: #f5c35a;
        }
        .zdrawer-icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .zdrawer-icon img { width: 22px; height: 22px; border-radius: 50%; display: block; }
        .zdrawer-label { flex: 1; }
        .zdrawer-chev { width: 16px; height: 16px; fill: none; stroke: #55608f; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
        .zdrawer[dir="rtl"] .zdrawer-chev { transform: scaleX(-1); }
        .zdrawer-item.highlight .zdrawer-icon { background: rgba(245,195,90,0.18); }
        .zdrawer-item.muted { color: #aeb8e6; font-weight: 600; }

        .zdrawer-item.wallet-item {
            width: calc(100% - 20px); margin: 6px 10px 8px;
            padding: 11px 12px;
            border: 1px solid rgba(245,195,90,0.55); border-radius: 16px;
            background: linear-gradient(135deg, rgba(44,75,181,0.40), rgba(20,32,107,0.65));
            box-shadow: 0 0 16px rgba(245,195,90,0.22), inset 0 0 10px rgba(245,195,90,0.08);
            color: #fff; font-weight: 900;
        }
        .zdrawer-item.wallet-item .zdrawer-icon { background: rgba(245,195,90,0.22); }

        /* ===== التذييل ===== */
        .zdrawer-footer { margin-top: auto; padding: 8px 0 calc(env(safe-area-inset-bottom, 0px) + 16px); }
        .zdrawer-invite {
            width: calc(100% - 28px); margin: 4px 14px 8px;
            display: flex; align-items: center; justify-content: center; gap: 10px;
            padding: 13px 16px; border: none; outline: none; border-radius: 16px;
            background: linear-gradient(135deg, #f5c35a, #fde9a8);
            color: #0a1033; font-size: 1rem; font-weight: 900; font-family: inherit;
            cursor: pointer; -webkit-tap-highlight-color: transparent;
            box-shadow: 0 6px 18px rgba(245,195,90,0.28);
            transition: transform 0.12s ease;
        }
        .zdrawer-invite:active { transform: scale(0.98); }
        .zdrawer-invite svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .zdrawer-version { text-align: center; font-size: 0.72rem; color: #5b6697; padding-top: 6px; }

        .zdrawer-toast {
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(17,26,74, 0.95); color: #fff;
            padding: 10px 18px; border-radius: 12px;
            border: 1px solid rgba(245,195,90, 0.3);
            font-size: 0.85rem; z-index: 3000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zdrawer-toast.show { opacity: 1; }

        /* ===== مركز المساعدة ===== */
        .zhelp {
            position: fixed; inset: 0; z-index: 2100;
            background: linear-gradient(180deg, #0f1a5c 0%, #0a1033 30%, #080d2a 100%);
            color: #e8ecff; overflow-y: auto; overscroll-behavior: contain;
            transform: translateY(100%); visibility: hidden;
            transition: transform 0.3s cubic-bezier(.2,.8,.2,1), visibility 0s linear 0.3s;
            font-family: inherit;
        }
        .zhelp.open { transform: translateY(0); visibility: visible; transition: transform 0.3s cubic-bezier(.2,.8,.2,1), visibility 0s; }
        .zhelp-bar {
            position: sticky; top: 0; z-index: 2;
            display: flex; align-items: center; gap: 10px;
            padding: calc(env(safe-area-inset-top, 0px) + 12px) 14px 12px;
            background: rgba(10,16,51,0.92); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .zhelp-back {
            width: 40px; height: 40px; border-radius: 12px; border: none; outline: none; cursor: pointer;
            background: rgba(255,255,255,0.07); color: #f5c35a; display: flex; align-items: center; justify-content: center;
            -webkit-tap-highlight-color: transparent;
        }
        .zhelp-back svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .zhelp[dir="rtl"] .zhelp-back svg { transform: scaleX(-1); }
        .zhelp-title { font-size: 1.1rem; font-weight: 900; color: #fff; }
        .zhelp-body { padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 28px); max-width: 640px; margin: 0 auto; }

        .zhelp-card {
            border: 1px solid rgba(245,195,90,0.28); border-radius: 18px; padding: 16px;
            background: linear-gradient(135deg, rgba(44,75,181,0.30), rgba(20,32,107,0.50));
            margin-bottom: 18px;
        }
        .zhelp-card h3 { margin: 0 0 4px; font-size: 1.05rem; font-weight: 900; color: #f5c35a; }
        .zhelp-card p { margin: 0 0 12px; font-size: 0.9rem; line-height: 1.7; color: #c9d1f5; }
        .zhelp-email { direction: ltr; text-align: start; font-weight: 700; color: #fff; font-size: 0.95rem; margin-bottom: 12px; word-break: break-all; }
        .zhelp-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .zhelp-btn {
            flex: 1 1 140px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            padding: 12px 14px; border-radius: 14px; border: none; outline: none; cursor: pointer;
            font-family: inherit; font-size: 0.95rem; font-weight: 900; text-decoration: none;
            -webkit-tap-highlight-color: transparent;
        }
        .zhelp-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .zhelp-btn.primary { background: linear-gradient(135deg, #f5c35a, #fde9a8); color: #0a1033; }
        .zhelp-btn.ghost { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.14); }

        .zhelp-h { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.6px; color: #6f7bb3; margin: 22px 4px 8px; }
        .zhelp details {
            border: 1px solid rgba(255,255,255,0.09); border-radius: 14px; margin-bottom: 8px;
            background: rgba(255,255,255,0.03); overflow: hidden;
        }
        .zhelp summary {
            list-style: none; cursor: pointer; padding: 14px; font-weight: 700; font-size: 0.95rem; color: #fff;
            display: flex; align-items: center; gap: 10px; -webkit-tap-highlight-color: transparent;
        }
        .zhelp summary::-webkit-details-marker { display: none; }
        .zhelp summary::after { content: '+'; margin-inline-start: auto; color: #f5c35a; font-size: 1.3rem; font-weight: 400; line-height: 1; }
        .zhelp details[open] summary::after { content: '\\2212'; }
        .zhelp details p { margin: 0; padding: 0 14px 14px; font-size: 0.9rem; line-height: 1.8; color: #c9d1f5; }

        .zhelp-link {
            display: flex; align-items: center; gap: 10px; width: 100%;
            padding: 13px 14px; margin-bottom: 8px; border-radius: 14px; cursor: pointer;
            border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.03);
            color: #e8ecff; font-family: inherit; font-size: 0.95rem; font-weight: 700; text-align: start; outline: none;
            -webkit-tap-highlight-color: transparent;
        }
        .zhelp-link:active { background: rgba(255,255,255,0.08); }
        .zhelp-link span { flex: 1; }
        .zhelp-foot { text-align: center; font-size: 0.75rem; color: #5b6697; margin-top: 18px; }
    `;

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg) {
        let el = document.getElementById('zdrawer-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zdrawer-toast';
            el.className = 'zdrawer-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2000);
    }

    // الاسم المستعار المعروض في رأس القائمة (كود الإعدادات نفسه في ملف settings.js)
    function currentNick() {
        const u = window.userState || {};
        let ls = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
        return u.nickname_ar || u.nickname_en
            || ls('zelo_nickname_ar') || ls('zelo_nickname_en')
            || String(u.email || ls('zelo_email') || '').split('@')[0];
    }

    // ===== أيقونات خطية (بدل الإيموجي) =====
    const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
    const ICONS = {
        profile:   svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
        wallet:    svg('<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1.2"/>'),
        subscriptions: svg('<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6"/>'),
        ads:       svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8h14v-8"/><path d="M12 8C10 4 6 4.5 7 7c.5 1.2 3 1 5 1zM12 8c2-4 6-3.5 5-1-.5 1.2-3 1-5 1z"/>'),
        nft:       svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
        champions: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4"/><path d="M12 13v4M8 21h8M10 17h4"/>'),
        website:   svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
        community: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 15c2 .8 3.5 2.4 3.5 5"/>'),
        settings:  svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),
        invite:    svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6 15.4 6.4M8.6 13.4l6.8 4.2"/>'),
        lang:      svg('<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 7 8M12 5c0 3-3 6-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>'),
        help:      svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6"/>'),
        mail:      svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
        copy:      svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
        back:      svg('<path d="M9 6l6 6-6 6"/>'),
        chev:      '<svg class="zdrawer-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
        store:     '<img src="zelo-coin.png" alt="" width="22" height="22">'
    };

    // ===== مركز المساعدة =====
    function openExternal(url) {
        try { window.open(url, '_blank'); } catch (e) { location.href = url; }
    }

    function supportMailto() {
        const u = window.userState || {};
        const who = [u.username ? '@' + u.username : '', u.userId ? 'ID: ' + u.userId : ''].filter(Boolean).join('  ');
        const subject = L('دعم ZELO Sport', 'ZELO Sport support');
        const body = '\n\n---\n' + L('بيانات حسابي (لتسهيل المساعدة):', 'My account info (to help us assist you):') + '\n' + who + '\nApp v' + APP_VERSION;
        return 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    }

    function legalUrl(page) {
        return SITE + page + (isAr() ? '.html' : '-en.html');
    }

    function faqItems() {
        return [
            [L('نسيت كلمة السر', 'I forgot my password'),
             L('من شاشة تسجيل الدخول اختر «نسيت كلمة السر» وسيصلك رابط إعادة التعيين على بريدك. إن لم يصل خلال دقائق فافحص الرسائل غير المرغوب فيها.',
               'On the sign-in screen choose “Forgot password” and a reset link will be sent to your email. If it does not arrive within a few minutes, check your spam folder.')],
            [L('كيف أحذف حسابي؟', 'How do I delete my account?'),
             L('من الإعدادات ← حذف الحساب. الحذف لا يلغي اشتراك Google Play، فألغِه من المتجر بنفسك. وأنهِ أي طلب سحب معلّق قبل الحذف.',
               'Go to Settings → Delete account. Deleting does not cancel your Google Play subscription, so cancel it in the store yourself. Finish any pending withdrawal before deleting.')],
            [L('كيف ألغي اشتراكي؟', 'How do I cancel my subscription?'),
             L('افتح متجر Google Play ← الملف الشخصي ← المدفوعات والاشتراكات ← الاشتراكات ← ZELO Sport ← إلغاء.',
               'Open Google Play → Profile → Payments & subscriptions → Subscriptions → ZELO Sport → Cancel.')],
            [L('كيف يعمل سحب الألماس؟', 'How do diamond withdrawals work?'),
             L('من «محفظتي». الحد الأدنى والرسوم ومدة المعالجة تظهر لك قبل تأكيد الطلب، وقد يُطلب منك تحقق إضافي. تأكد من عنوان المحفظة (USDT على شبكة BEP20) لأن العمليات لا تُلغى بعد التنفيذ.',
               'From “My Wallet”. The minimum, fees and processing time are shown before you confirm, and extra verification may be required. Double-check the wallet address (USDT on BEP20) because transactions cannot be reversed once sent.')],
            [L('كيف أبلّغ عن منشور أو أحظر مستخدماً؟', 'How do I report a post or block a user?'),
             L('من قائمة المنشور (النقاط الثلاث) اختر «بلاغ» أو «حظر».',
               'From the post menu (three dots) choose “Report” or “Block”.')]
        ];
    }

    function openHelpCenter() {
        let sheet = document.getElementById('zhelp');
        if (sheet) sheet.remove();
        sheet = document.createElement('div');
        sheet.id = 'zhelp';
        sheet.className = 'zhelp';
        sheet.dir = isAr() ? 'rtl' : 'ltr';

        const faq = faqItems().map(([q, a]) =>
            `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');

        const legal = [
            ['privacy', L('سياسة الخصوصية', 'Privacy Policy')],
            ['terms', L('شروط الاستخدام', 'Terms of Use')],
            ['refunds', L('الدفع والاسترداد', 'Payments & Refunds')],
            ['delete-account', L('حذف الحساب والبيانات', 'Delete account & data')]
        ].map(([p, label]) =>
            `<button class="zhelp-link" data-open="${legalUrl(p)}"><span>${esc(label)}</span>${ICONS.chev}</button>`).join('');

        sheet.innerHTML = `
            <div class="zhelp-bar">
                <button class="zhelp-back" data-act="close" aria-label="${esc(L('رجوع', 'Back'))}">${ICONS.back}</button>
                <div class="zhelp-title">${esc(L('مركز المساعدة', 'Help center'))}</div>
            </div>
            <div class="zhelp-body">
                <div class="zhelp-card">
                    <h3>${esc(L('تواصل مع الدعم', 'Contact support'))}</h3>
                    <p>${esc(L('اكتب لنا مشكلتك أو اقتراحك وسنرد عليك على بريدك.', 'Tell us about your problem or idea and we will reply by email.'))}</p>
                    <div class="zhelp-email">${esc(SUPPORT_EMAIL)}</div>
                    <div class="zhelp-actions">
                        <a class="zhelp-btn primary" href="${esc(supportMailto())}">${ICONS.mail}<span>${esc(L('راسلنا', 'Email us'))}</span></a>
                        <button class="zhelp-btn ghost" data-act="copy">${ICONS.copy}<span>${esc(L('نسخ البريد', 'Copy email'))}</span></button>
                    </div>
                </div>

                <div class="zhelp-h">${esc(L('أسئلة شائعة', 'FAQ'))}</div>
                ${faq}

                <div class="zhelp-h">${esc(L('معلومات قانونية', 'Legal'))}</div>
                ${legal}

                <div class="zhelp-foot">ZELO Sport v${esc(APP_VERSION)}</div>
            </div>`;

        sheet.addEventListener('click', e => {
            const act = e.target.closest('[data-act]');
            const open = e.target.closest('[data-open]');
            if (act && act.dataset.act === 'close') closeHelpCenter();
            else if (act && act.dataset.act === 'copy') copyEmail();
            else if (open) openExternal(open.dataset.open);
        });

        document.body.appendChild(sheet);
        void sheet.offsetWidth;
        sheet.classList.add('open');
    }

    function closeHelpCenter() {
        const s = document.getElementById('zhelp');
        if (!s) return;
        s.classList.remove('open');
        setTimeout(() => s.remove(), 320);
    }

    function copyEmail() {
        const done = () => toast(L('تم نسخ البريد', 'Email copied'));
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(SUPPORT_EMAIL).then(done, () => toast(SUPPORT_EMAIL));
                return;
            }
        } catch (e) {}
        toast(SUPPORT_EMAIL);
    }

    const ACTIONS = {
        profile:     () => showPage('profile'),
        // صفحة الاشتراكات والأسعار صارت في premium.js
        subscriptions: () => (typeof window.openSubscriptions === 'function' ? window.openSubscriptions() : toast(L('ملف الاشتراكات غير محمّل', 'Subscriptions file not loaded'))),
        // صفحة المتجر (معرّفة في ملف store.js)
        store:       () => (typeof window.openStorePage === 'function' ? window.openStorePage() : toast(L('ملف المتجر غير محمّل', 'Store file not loaded'))),
        // ترتيب الأندية (انتقل من الشريط السفلي إلى هنا)
        leaderboard: () => showPage('leaderboard'),
        community:  () => showPage('community'),
        // محفظتي: رصيد الألماس وسحب USDT (ملف wallet-withdraw.js)
        wallet:      () => {
            const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
            if (typeof window.openWithdrawWallet === 'function' && c) window.openWithdrawWallet(c);
            else toast(L('ملف المحفظة غير محمّل', 'Wallet file not loaded'));
        },
        // صفحة إعلان المكافأة اليدوي (معرّفة في ملف ads.js)
        ads:         () => (typeof window.openAdsPage === 'function' ? window.openAdsPage() : toast(L('ملف الإعلانات غير محمّل', 'Ads file not loaded'))),
        // سوق بطاقات NFT (معرّف في ملف nft-market.js)
        nft:         () => (typeof window.renderNftMarketPage === 'function' ? window.renderNftMarketPage() : toast(L('ملف سوق NFT غير محمّل', 'NFT market file not loaded'))),
        website:     () => window.openOfficialWebsite && window.openOfficialWebsite(),
        // شاشة "أبطال اليوم" (الترتيب) المعرّفة في ملف الترتيب
        champions:   () => window.openLegendaryRankingScreen && window.openLegendaryRankingScreen(),
        // كود الإعدادات في ملف منفصل: settings.js
        settings:    () => (typeof window.openSettings === 'function' ? window.openSettings() : toast(L('ملف الإعدادات غير محمّل', 'Settings file not loaded'))),
        // دعوة الأصدقاء: نافذة المشاركة (share.js) ثم نسخ الرابط كاحتياط
        invite:      () => {
            if (typeof window.openShareSheet === 'function') window.openShareSheet();
            else if (typeof window.copyReferralLink === 'function') window.copyReferralLink();
            else toast(L('ملف المشاركة غير محمّل', 'Share file not loaded'));
        },
        // مركز المساعدة: بريد الدعم + الأسئلة الشائعة + الروابط القانونية
        help:        () => openHelpCenter(),
        lang: async () => {
            const next = isAr() ? 'en' : 'ar';
            localStorage.setItem('app_lang', next);
            if (window.userState) window.userState.lang = next;
            // حفظ اللغة في قاعدة البيانات حتى لا تُستبدل بالقيمة القديمة عند إعادة التحميل
            try {
                const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
                const uid = window.userState?.userId;
                if (c && uid) {
                    await c.from('users').update({ lang: next }).eq('user_id', String(uid));
                }
            } catch (e) {
                console.warn('[ZELO] فشل حفظ اللغة في قاعدة البيانات:', e);
            }
            location.reload();
        }
    };

    // الأقسام: حسابي / اكتشف / المزيد
    function getItems() {
        return {
            sections: [
                {
                    title: { ar: 'حسابي', en: 'MY ACCOUNT' },
                    items: [
                        { key: 'profile',       ar: 'الملف الشخصي', en: 'Profile' },
                        { key: 'wallet',        ar: 'محفظتي',       en: 'My Wallet', highlight: true, framed: true },
                        { key: 'subscriptions', ar: 'الاشتراكات',   en: 'Subscriptions', highlight: true },
                        { key: 'store',         ar: 'المتجر',       en: 'Store', highlight: true }
                    ]
                },
                {
                    title: { ar: 'اكتشف', en: 'DISCOVER' },
                    items: [
                        { key: 'champions', ar: 'أبطال اليوم', en: "Today's Champions", highlight: true },
                        { key: 'ads',       ar: 'اربح نقاط',   en: 'Earn Points', highlight: true },
                        { key: 'nft',       ar: 'سوق NFT',     en: 'NFT Market' },
                        { key: 'community', ar: 'المجتمعات',   en: 'Community' }
                    ]
                },
                {
                    title: { ar: 'المزيد', en: 'MORE' },
                    items: [
                        { key: 'website',  ar: 'الموقع الرسمي', en: 'Official Website' },
                        { key: 'settings', ar: 'الإعدادات',     en: 'Settings' }
                    ]
                }
            ],
            footer: [
                { key: 'lang', ar: 'تغيير اللغة',   en: 'Change language', muted: true },
                { key: 'help', ar: 'مركز المساعدة', en: 'Help center',     muted: true }
            ]
        };
    }

    function renderItem(item) {
        const cls = ['zdrawer-item', item.muted ? 'muted' : '', item.highlight ? 'highlight' : '', item.framed ? 'wallet-item' : '']
            .filter(Boolean).join(' ');
        return `
            <button class="${cls}" data-action="${item.key}">
                <span class="zdrawer-icon">${ICONS[item.key] || ''}</span>
                <span class="zdrawer-label">${esc(L(item.ar, item.en))}</span>
                ${ICONS.chev}
            </button>`;
    }

    function avatarHtml(name) {
        const photo = window.userState?.photoUrl;
        if (photo) {
            return `<img src="${esc(photo)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }
        return esc(name.charAt(0).toUpperCase());
    }

    function render() {
        const drawer = document.getElementById('zdrawer');
        if (!drawer) return;

        const username = window.userState?.username || '';
        const name = currentNick() || username || 'Android Player';
        const handle = username || window.userState?.userId || '';
        const items = getItems();

        const sections = items.sections.map((s, i) => `
            ${i > 0 ? '<div class="zdrawer-divider"></div>' : ''}
            <div class="zdrawer-section">
                <div class="zdrawer-section-title">${esc(L(s.title.ar, s.title.en))}</div>
                ${s.items.map(renderItem).join('')}
            </div>`).join('');

        drawer.innerHTML = `
            <div class="zdrawer-header">
                <div class="zdrawer-avatar-ring"><div class="zdrawer-avatar">${avatarHtml(name)}</div></div>
                <div class="zdrawer-name">${esc(name)}</div>
                <div class="zdrawer-handle">@${esc(handle)}</div>
            </div>

            ${sections}

            <div class="zdrawer-footer">
                <button class="zdrawer-invite" data-action="invite">
                    ${ICONS.invite}<span>${esc(L('ادعُ أصدقاءك', 'Invite friends'))}</span>
                </button>
                ${items.footer.map(renderItem).join('')}
                <div class="zdrawer-version">ZELO Sport v${esc(APP_VERSION)}</div>
            </div>
        `;
    }

    // عرض صورة المستخدم في زر الهيدر (أو الرمز الافتراضي إن لم تتوفر صورة)
    function updateHeaderAvatar() {
        const btn = document.getElementById('profile-header-btn');
        if (!btn) return;

        const photo = window.userState?.photoUrl;
        btn.innerHTML = photo
            ? `<img src="${esc(photo)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
            : '👤';
    }

    // تحديد جهة الفتح حسب اللغة: عربي = يمين، غير ذلك = يسار
    function applySide() {
        const drawer = document.getElementById('zdrawer');
        if (!drawer) return;
        const ar = isAr();
        drawer.classList.toggle('from-right', ar);
        drawer.classList.toggle('from-left', !ar);
        drawer.dir = ar ? 'rtl' : 'ltr';
    }

    function build() {
        if (document.getElementById('zdrawer')) return;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'zdrawer-overlay';
        overlay.className = 'zdrawer-overlay';
        overlay.addEventListener('click', closeSideDrawer);

        const drawer = document.createElement('aside');
        drawer.id = 'zdrawer';
        drawer.className = 'zdrawer';
        drawer.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = ACTIONS[btn.dataset.action];
            closeSideDrawer();
            if (typeof action === 'function') action();
        });

        document.body.append(overlay, drawer);

        // ضبط الجهة فوراً حتى تبدأ القائمة مخفية خارج الشاشة
        applySide();
        updateHeaderAvatar();
    }

    function openSideDrawer() {
        build();
        updateHeaderAvatar();
        applySide();
        render();
        // إجبار المتصفح على احتساب الحالة المغلقة قبل بدء حركة الفتح
        void document.getElementById('zdrawer').offsetWidth;
        document.getElementById('zdrawer-overlay').classList.add('open');
        document.getElementById('zdrawer').classList.add('open');
    }

    function closeSideDrawer() {
        document.getElementById('zdrawer-overlay')?.classList.remove('open');
        document.getElementById('zdrawer')?.classList.remove('open');
    }

    window.openSideDrawer = openSideDrawer;
    window.closeSideDrawer = closeSideDrawer;
    window.openHelpCenter = openHelpCenter;

    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
})();
