(function () {
    'use strict';
    const ADMIN_IDS = ['eb880283-f32e-4fb5-a84a-e6007b633352'];
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const L = (a, e) => (isAr() ? a : e);
    const db = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isAdmin = () => ADMIN_IDS.includes(String((window.userState && window.userState.userId) || ''));

    const REASONS = { spam: 'محتوى مزعج أو إعلاني', abuse: 'إساءة أو تحرّش', hate: 'خطاب كراهية', violence: 'عنف أو محتوى صادم', adult: 'محتوى للبالغين', misinfo: 'معلومات مضللة', other: 'سبب آخر' };
    const reasonText = r => {
        r = String(r || '');
        if (r.startsWith('other:')) return 'سبب آخر: ' + r.slice(6).trim();
        return REASONS[r] || r;
    };

    function css() {
        if (document.getElementById('zadm-css')) return;
        const s = document.createElement('style'); s.id = 'zadm-css';
        s.textContent = `
        #zadm{position:fixed;inset:0;z-index:5200;background:#0a1033;color:#e8ecff;overflow-y:auto;font-family:inherit}
        #zadm .zadm-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 12px;background:rgba(10,16,51,.95);border-bottom:1px solid rgba(255,255,255,.07)}
        #zadm .zadm-title{font-size:1.1rem;font-weight:900;color:#f5c35a}
        #zadm .zadm-body{padding:14px;max-width:560px;margin:0 auto}
        #zadm .zadm-card{border:1px solid rgba(245,195,90,.25);border-radius:18px;background:rgba(17,26,74,.7);padding:14px;margin-bottom:14px}
        #zadm .zadm-head{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;color:#9aa6d6;margin-bottom:8px}
        #zadm .zadm-badge{background:rgba(255,107,107,.15);color:#ff9b9b;border-radius:999px;padding:2px 10px;font-weight:800}
        #zadm .zadm-reason{font-weight:800;color:#f5c35a;margin-bottom:8px;font-size:.95rem}
        #zadm .zadm-content{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;font-size:.95rem;line-height:1.7;white-space:pre-wrap;word-break:break-word}
        #zadm .zadm-content img{max-width:100%;border-radius:10px;margin-top:8px;display:block}
        #zadm .zadm-meta{font-size:.78rem;color:#9aa6d6;margin:8px 0}
        #zadm .zadm-btns{display:flex;gap:8px;margin-top:10px}
        #zadm .zadm-btn{flex:1;padding:11px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;font-family:inherit;font-weight:800;font-size:.9rem;cursor:pointer}
        #zadm .zadm-btn.del{background:rgba(255,77,77,.18);border-color:rgba(255,77,77,.5);color:#ff9b9b}
        #zadm .zadm-btn.ban{background:rgba(245,195,90,.15);border-color:rgba(245,195,90,.5);color:#f5c35a}
        #zadm .zadm-tabs{display:flex;gap:8px;margin-bottom:14px}
        #zadm .zadm-tab{flex:1;padding:10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#cbd5e1;font-family:inherit;font-weight:800;cursor:pointer}
        #zadm .zadm-tab.on{background:linear-gradient(135deg,#f5c35a,#fde9a8);color:#0a1033;border-color:transparent}
        .zadm-sheet{position:fixed;inset:0;z-index:5300;background:rgba(3,6,24,.7);display:flex;align-items:flex-end;justify-content:center}
        .zadm-sheet>div{width:100%;max-width:520px;background:#0f1a5c;border-radius:22px 22px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));color:#fff}
        .zadm-sheet button{display:block;width:100%;margin-top:8px;padding:13px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer}
        #zadm .zadm-empty{text-align:center;color:#9aa6d6;padding:60px 10px}`;
        document.head.appendChild(s);
    }

    async function load(body) {
        body.innerHTML = '<div class="zadm-empty">' + L('جارٍ التحميل…', 'Loading…') + '</div>';
        const c = db();
        const { data, error } = c ? await c.rpc('admin_list_reports') : { error: { message: 'no client' } };
        if (error) { body.innerHTML = '<div class="zadm-empty">' + esc(error.message) + '</div>'; return; }
        if (!data || !data.length) { body.innerHTML = '<div class="zadm-empty">✅ ' + L('لا توجد بلاغات جديدة', 'No open reports') + '</div>'; return; }
        body.innerHTML = data.map(r => `
            <div class="zadm-card" data-rid="${r.report_id}">
                <div class="zadm-head"><span>${r.target_type === 'comment' ? L('رد', 'Reply') : L('منشور', 'Post')} #${r.target_id}</span>
                    <span>${r.report_count > 1 ? `<span class="zadm-badge">${r.report_count} ${L('بلاغات', 'reports')}</span>` : ''}</span></div>
                <div class="zadm-reason">🚩 ${esc(reasonText(r.reason))}</div>
                <div class="zadm-content">${r.content ? esc(r.content) : '<i>' + L('(بلا نص)', '(no text)') + '</i>'}${r.image_url ? `<img src="${esc(r.image_url)}" alt="">` : ''}</div>
                <div class="zadm-meta">${L('الكاتب', 'Author')}: <b>${esc(r.author_name)}</b> · ${L('المبلِّغ', 'Reporter')}: ${esc(r.reporter_name)}</div>
                <div class="zadm-btns">
                    <button class="zadm-btn del" data-act="delete">${L('حذف', 'Delete')}</button>
                    <button class="zadm-btn ban" data-act="ban" data-uid="${esc(r.author_id || '')}" data-name="${esc(r.author_name)}">${L('حظر الكاتب', 'Ban author')}</button>
                    <button class="zadm-btn" data-act="dismiss">${L('تجاهل', 'Dismiss')}</button>
                </div>
            </div>`).join('');
        body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
            const card = b.closest('.zadm-card'); const id = Number(card.dataset.rid); const act = b.dataset.act;
            if (act === 'ban') { pickBan(b.dataset.uid, b.dataset.name, () => load(body)); return; }
            if (act === 'delete' && !confirm(L('حذف هذا المحتوى نهائيًا؟', 'Delete this content permanently?'))) return;
            card.querySelectorAll('button').forEach(x => x.disabled = true);
            const r = await c.rpc('admin_resolve_report', { p_report_id: id, p_action: act });
            if (r.error) { alert(r.error.message); card.querySelectorAll('button').forEach(x => x.disabled = false); return; }
            load(body);
        }));
    }

    function pickBan(uid, name, done) {
        if (!uid) { alert(L('لا يوجد كاتب لهذا المحتوى (ربما حُذف)', 'No author found (content may be deleted)')); return; }
        document.getElementById('zadm-sheet')?.remove();
        const sh = document.createElement('div'); sh.id = 'zadm-sheet'; sh.className = 'zadm-sheet';
        sh.innerHTML = `<div dir="${isAr() ? 'rtl' : 'ltr'}"><b>${esc(name)}</b>
            <div style="color:#9aa6d6;font-size:.82rem;margin:8px 0 2px">${L('حظر من النشر (يتصفح فقط)', 'Posting ban (browse only)')}</div>
            <button data-k="post" data-d="7">${L('7 أيام', '7 days')}</button><button data-k="post" data-d="30">${L('30 يومًا', '30 days')}</button>
            <div style="color:#ff9b9b;font-size:.82rem;margin:12px 0 2px">${L('حظر الحساب بالكامل (دائم)', 'Full account ban (permanent)')}</div>
            <button data-k="full" data-d="0" style="border-color:rgba(255,77,77,.5);color:#ff9b9b">${L('حظر الحساب نهائيًا', 'Ban account permanently')}</button>
            <button data-k="x" style="background:transparent">${L('إلغاء', 'Cancel')}</button></div>`;
        document.body.appendChild(sh);
        sh.addEventListener('click', async e => {
            if (e.target === sh) { sh.remove(); return; }
            const bt = e.target.closest('button[data-k]'); if (!bt) return;
            if (bt.dataset.k === 'x') { sh.remove(); return; }
            if (!confirm(L('تأكيد الحظر؟', 'Confirm ban?'))) return;
            const days = Number(bt.dataset.d);
            const r = await db().rpc('admin_ban_user', { p_user_id: uid, p_kind: bt.dataset.k, p_days: days || null, p_reason: 'admin' });
            sh.remove();
            if (r.error) { alert(r.error.message); return; }
            done && done();
        });
    }

    async function loadBans(body) {
        body.innerHTML = '<div class="zadm-empty">' + L('جارٍ التحميل…', 'Loading…') + '</div>';
        const c = db();
        const { data, error } = await c.rpc('admin_list_bans');
        if (error) { body.innerHTML = '<div class="zadm-empty">' + esc(error.message) + '</div>'; return; }
        if (!data || !data.length) { body.innerHTML = '<div class="zadm-empty">' + L('لا توجد حسابات محظورة', 'No banned accounts') + '</div>'; return; }
        body.innerHTML = data.map(b => `<div class="zadm-card"><div class="zadm-reason">${esc(b.name)} ${b.username ? '<span style="color:#9aa6d6;font-weight:600;direction:ltr;unicode-bidi:plaintext">@' + esc(b.username) + '</span>' : ''}</div>
            <div class="zadm-meta">${b.kind === 'full' ? '🚫 ' + L('حظر الحساب (دائم)', 'Full account ban') : '✍️ ' + L('حظر من النشر حتى', 'Posting ban until') + ' ' + (b.banned_until ? new Date(b.banned_until).toLocaleString() : '')}</div>
            <div class="zadm-btns"><button class="zadm-btn" data-unban="${esc(b.user_id)}">${L('إلغاء الحظر', 'Unban')}</button></div></div>`).join('');
        body.querySelectorAll('[data-unban]').forEach(x => x.addEventListener('click', async () => {
            x.disabled = true;
            const r = await c.rpc('admin_unban_user', { p_user_id: x.dataset.unban });
            if (r.error) { alert(r.error.message); x.disabled = false; return; }
            loadBans(body);
        }));
    }

    async function loadAppeals(body) {
        body.innerHTML = '<div class="zadm-empty">' + L('جارٍ التحميل…', 'Loading…') + '</div>';
        const c = db();
        const { data, error } = await c.rpc('admin_list_appeals');
        if (error) { body.innerHTML = '<div class="zadm-empty">' + esc(error.message) + '</div>'; return; }
        if (!data || !data.length) { body.innerHTML = '<div class="zadm-empty">' + L('لا توجد طعون', 'No appeals') + '</div>'; return; }
        body.innerHTML = data.map(a => `<div class="zadm-card" data-aid="${a.appeal_id}">
            <div class="zadm-reason">${esc(a.name)} ${a.username ? '<span style="color:#9aa6d6;font-weight:600;direction:ltr;unicode-bidi:plaintext">@' + esc(a.username) + '</span>' : ''}</div>
            <div class="zadm-meta">${a.kind === 'full' ? L('حظر الحساب', 'Full ban') : L('حظر من النشر', 'Posting ban')} · ${new Date(a.created_at).toLocaleString()}</div>
            <div class="zadm-content">${esc(a.message)}</div>
            <div class="zadm-btns"><button class="zadm-btn" data-ap="unban">${L('قبول وفك الحظر', 'Accept & unban')}</button><button class="zadm-btn del" data-ap="reject">${L('رفض', 'Reject')}</button></div></div>`).join('');
        body.querySelectorAll('[data-ap]').forEach(x => x.addEventListener('click', async () => {
            const card = x.closest('.zadm-card'); card.querySelectorAll('button').forEach(k => k.disabled = true);
            const r = await c.rpc('admin_resolve_appeal', { p_appeal_id: Number(card.dataset.aid), p_action: x.dataset.ap });
            if (r.error) { alert(r.error.message); card.querySelectorAll('button').forEach(k => k.disabled = false); return; }
            loadAppeals(body);
        }));
    }

    window.openReportsPanel = function () {
        if (!isAdmin()) return;
        css();
        document.getElementById('zadm')?.remove();
        const ov = document.createElement('div'); ov.id = 'zadm'; ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.innerHTML = `<div class="zadm-bar">${typeof window.zeloBackBtn === 'function' ? window.zeloBackBtn("document.getElementById('zadm').remove()", isAr()) : ''}<div class="zadm-title">🚩 ${L('الإدارة', 'Moderation')}</div></div>
            <div class="zadm-body"><div class="zadm-tabs"><button class="zadm-tab on" data-t="r">${L('البلاغات', 'Reports')}</button><button class="zadm-tab" data-t="b">${L('المحظورون', 'Banned')}</button><button class="zadm-tab" data-t="a">${L('الطعون', 'Appeals')}</button></div><div id="zadm-body"></div></div>`;
        document.body.appendChild(ov);
        const bodyEl = document.getElementById('zadm-body');
        ov.querySelectorAll('.zadm-tab').forEach(t => t.addEventListener('click', () => {
            ov.querySelectorAll('.zadm-tab').forEach(x => x.classList.toggle('on', x === t));
            (t.dataset.t === 'b' ? loadBans : t.dataset.t === 'a' ? loadAppeals : load)(bodyEl);
        }));
        load(bodyEl);
    };
    window.zeloIsAdmin = isAdmin;

    // ===== حالة الحظر للمستخدم =====
    let banShown = false;
    function appealSheet(c) {
        document.getElementById('zban-appeal')?.remove();
        const sh = document.createElement('div'); sh.id = 'zban-appeal';
        sh.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(3,6,24,.8);display:flex;align-items:flex-end;justify-content:center;direction:' + (isAr() ? 'rtl' : 'ltr');
        sh.innerHTML = `<div style="width:100%;max-width:520px;background:#0f1a5c;border-radius:22px 22px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));color:#fff">
            <div style="font-weight:900;margin-bottom:8px">${L('اكتب رسالة الطعن', 'Write your appeal')}</div>
            <textarea id="zban-txt" maxlength="1000" rows="5" placeholder="${L('اشرح لماذا تعتقد أن الحظر خاطئ…', 'Explain why you think the ban is wrong…')}" style="width:100%;box-sizing:border-box;background:#0a1033;color:#fff;border:1px solid rgba(245,195,90,.35);border-radius:14px;padding:12px;font-family:inherit;font-size:1rem;resize:none"></textarea>
            <div id="zban-msg" style="min-height:20px;margin-top:6px;font-size:.85rem;color:#ff9b9b"></div>
            <div style="display:flex;gap:10px;margin-top:8px"><button id="zban-cancel" style="flex:1;padding:12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;font-weight:800;font-family:inherit">${L('إلغاء', 'Cancel')}</button>
            <button id="zban-send" style="flex:1;padding:12px;border-radius:999px;border:none;background:linear-gradient(135deg,#f5c35a,#fde9a8);color:#0a1033;font-weight:900;font-family:inherit">${L('إرسال', 'Send')}</button></div></div>`;
        document.body.appendChild(sh);
        sh.querySelector('#zban-cancel').onclick = () => sh.remove();
        sh.querySelector('#zban-send').onclick = async () => {
            const t = sh.querySelector('#zban-txt').value.trim(), msg = sh.querySelector('#zban-msg');
            if (t.length < 5) { msg.textContent = L('اكتب 5 أحرف على الأقل', 'Write at least 5 characters'); return; }
            const r = await c.rpc('submit_ban_appeal', { p_message: t });
            if (r.error) { msg.textContent = /one appeal/.test(r.error.message) ? L('أرسلت طعنًا اليوم، حاول غدًا', 'You already appealed today') : r.error.message; return; }
            try { c.functions.invoke('notify-appeal'); } catch (e) {}
            sh.innerHTML = `<div style="width:100%;max-width:520px;background:#0f1a5c;border-radius:22px 22px 0 0;padding:26px;text-align:center;color:#fff"><div style="font-size:40px">✅</div><div style="font-weight:900;margin:8px 0">${L('تم إرسال طعنك', 'Appeal sent')}</div><div style="color:#c9d1f5;font-size:.9rem">${L('سنراجعه ونرد عليك.', 'We will review it.')}</div><button style="margin-top:14px;padding:12px 30px;border-radius:999px;border:none;background:#f5c35a;color:#0a1033;font-weight:900;font-family:inherit" onclick="document.getElementById('zban-appeal').remove()">${L('حسنًا', 'OK')}</button></div>`;
        };
    }
    window.zeloOpenAppeal = () => appealSheet(db());
    // بطاقة تنبيه تظهر في الملف الشخصي للمحظور من النشر
    window.zeloBanNoteHtml = function () {
        const b = window.zeloMyBan;
        if (!b || b.kind === 'full') return '';
        if (b.banned_until && new Date(b.banned_until) <= new Date()) return '';
        return `<div style="margin:0 0 14px;padding:14px;border-radius:16px;background:rgba(122,31,31,.35);border:1px solid rgba(255,107,107,.45);color:#fff;line-height:1.8;font-size:.9rem">
            <b style="color:#ff9b9b">⛔ ${L('حسابك موقوف عن النشر والتفاعل', 'Your posting is suspended')}</b><br>
            ${L('حتى: ', 'Until: ')}${b.banned_until ? new Date(b.banned_until).toLocaleDateString() : ''} — ${L('يمكنك التصفح فقط.', 'You can only browse.')}
            <div style="margin-top:8px"><button onclick="window.zeloOpenAppeal()" style="padding:8px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;font-weight:800;font-family:inherit">${L('طعن', 'Appeal')}</button></div></div>`;
    };
    async function checkMyBan() {
        const c = db(), uid = window.userState && window.userState.userId;
        if (!c || !uid) return;
        try {
            const r = await c.from('user_bans').select('banned_until,kind').eq('user_id', String(uid)).maybeSingle();
            const b = r && r.data;
            if (!b || (b.banned_until && new Date(b.banned_until) <= new Date())) { window.zeloMyBan = null; return; }
            window.zeloMyBan = b;
            if (b.kind === 'full') {
                if (banShown) return; banShown = true;
                const ov = document.createElement('div');
                ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a1033;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;font-family:inherit;direction:' + (isAr() ? 'rtl' : 'ltr');
                ov.innerHTML = `<div style="font-size:64px">🚫</div><h2 style="margin:14px 0 8px;font-weight:900;color:#f5c35a">${L('تم إيقاف حسابك', 'Your account is suspended')}</h2>
                    <p style="color:#c9d1f5;line-height:1.8;max-width:340px">${L('لمخالفة شروط الاستخدام.', 'For violating the terms.')}<br>${L('للاستفسار راسلنا على', 'Contact')} <span dir="ltr">support@zelosport.net</span></p>
                    <button id="zban-appeal-btn" style="margin-top:20px;padding:13px 40px;border-radius:999px;border:none;background:linear-gradient(135deg,#f5c35a,#fde9a8);color:#0a1033;font-weight:900;font-family:inherit;font-size:1rem">${L('طعن', 'Appeal')}</button>
                    <button id="zban-out" style="margin-top:12px;padding:11px 34px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-weight:800;font-family:inherit;font-size:.95rem">${L('تسجيل الخروج', 'Log out')}</button>`;
                document.body.appendChild(ov);
                ov.querySelector('#zban-appeal-btn').onclick = () => appealSheet(c);
                ov.querySelector('#zban-out').onclick = async () => { try { await c.auth.signOut(); } catch (e) {} try { localStorage.clear(); } catch (e) {} location.reload(); };
            }
        } catch (e) {}
    }
    let tries = 0;
    const iv = setInterval(() => { tries++; if (window.userState && window.userState.userId) { clearInterval(iv); checkMyBan(); setInterval(checkMyBan, 300000); } else if (tries > 60) clearInterval(iv); }, 2000);
})();
