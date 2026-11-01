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
        sh.innerHTML = `<div dir="${isAr() ? 'rtl' : 'ltr'}"><b>${L('حظر', 'Ban')} ${esc(name)}</b>
            <button data-d="7">${L('7 أيام', '7 days')}</button><button data-d="30">${L('30 يومًا', '30 days')}</button>
            <button data-d="0">${L('دائم', 'Permanent')}</button><button data-d="x" style="background:transparent">${L('إلغاء', 'Cancel')}</button></div>`;
        document.body.appendChild(sh);
        sh.addEventListener('click', async e => {
            if (e.target === sh) { sh.remove(); return; }
            const bt = e.target.closest('button[data-d]'); if (!bt) return;
            if (bt.dataset.d === 'x') { sh.remove(); return; }
            if (!confirm(L('تأكيد حظر هذا الحساب؟', 'Confirm ban?'))) return;
            const days = Number(bt.dataset.d);
            const r = await db().rpc('admin_ban_user', { p_user_id: uid, p_days: days || null, p_reason: 'admin' });
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
            <div class="zadm-meta">${b.banned_until ? L('حتى', 'Until') + ' ' + new Date(b.banned_until).toLocaleString() : L('حظر دائم', 'Permanent')}</div>
            <div class="zadm-btns"><button class="zadm-btn" data-unban="${esc(b.user_id)}">${L('إلغاء الحظر', 'Unban')}</button></div></div>`).join('');
        body.querySelectorAll('[data-unban]').forEach(x => x.addEventListener('click', async () => {
            x.disabled = true;
            const r = await c.rpc('admin_unban_user', { p_user_id: x.dataset.unban });
            if (r.error) { alert(r.error.message); x.disabled = false; return; }
            loadBans(body);
        }));
    }

    window.openReportsPanel = function () {
        if (!isAdmin()) return;
        css();
        document.getElementById('zadm')?.remove();
        const ov = document.createElement('div'); ov.id = 'zadm'; ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.innerHTML = `<div class="zadm-bar">${typeof window.zeloBackBtn === 'function' ? window.zeloBackBtn("document.getElementById('zadm').remove()", isAr()) : ''}<div class="zadm-title">🚩 ${L('الإدارة', 'Moderation')}</div></div>
            <div class="zadm-body"><div class="zadm-tabs"><button class="zadm-tab on" data-t="r">${L('البلاغات', 'Reports')}</button><button class="zadm-tab" data-t="b">${L('المحظورون', 'Banned')}</button></div><div id="zadm-body"></div></div>`;
        document.body.appendChild(ov);
        const bodyEl = document.getElementById('zadm-body');
        ov.querySelectorAll('.zadm-tab').forEach(t => t.addEventListener('click', () => {
            ov.querySelectorAll('.zadm-tab').forEach(x => x.classList.toggle('on', x === t));
            (t.dataset.t === 'b' ? loadBans : load)(bodyEl);
        }));
        load(bodyEl);
    };
    window.zeloIsAdmin = isAdmin;

    // ===== شاشة الإيقاف للحساب المحظور =====
    let banShown = false;
    async function checkMyBan() {
        const c = db(), uid = window.userState && window.userState.userId;
        if (!c || !uid || banShown) return;
        try {
            const r = await c.from('user_bans').select('banned_until').eq('user_id', String(uid)).maybeSingle();
            const b = r && r.data;
            if (!b) return;
            if (b.banned_until && new Date(b.banned_until) <= new Date()) return;
            banShown = true;
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a1033;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;font-family:inherit;direction:' + (isAr() ? 'rtl' : 'ltr');
            ov.innerHTML = `<div style="font-size:64px">🚫</div><h2 style="margin:14px 0 8px;font-weight:900;color:#f5c35a">${L('تم إيقاف حسابك', 'Your account is suspended')}</h2>
                <p style="color:#c9d1f5;line-height:1.8;max-width:340px">${b.banned_until ? L('حتى: ', 'Until: ') + new Date(b.banned_until).toLocaleString() : L('الإيقاف دائم.', 'The suspension is permanent.')}<br>${L('لمخالفة شروط الاستخدام. للاستفسار راسلنا على support@zelosport.net', 'For violating the terms. Contact support@zelosport.net')}</p>
                <button id="zban-out" style="margin-top:20px;padding:13px 34px;border-radius:999px;border:none;background:linear-gradient(135deg,#f5c35a,#fde9a8);color:#0a1033;font-weight:900;font-family:inherit;font-size:1rem">${L('تسجيل الخروج', 'Log out')}</button>`;
            document.body.appendChild(ov);
            ov.querySelector('#zban-out').onclick = async () => { try { await c.auth.signOut(); } catch (e) {} try { localStorage.clear(); } catch (e) {} location.reload(); };
        } catch (e) {}
    }
    let tries = 0;
    const iv = setInterval(() => { tries++; if (window.userState && window.userState.userId) { clearInterval(iv); checkMyBan(); setInterval(checkMyBan, 300000); } else if (tries > 60) clearInterval(iv); }, 2000);
})();
