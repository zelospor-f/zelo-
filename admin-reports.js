(function () {
    'use strict';
    const ADMIN_ID = '8610b5cf-1eb6-44c3-b5c8-af737fd961d9';
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const L = (a, e) => (isAr() ? a : e);
    const db = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isAdmin = () => String((window.userState && window.userState.userId) || '') === ADMIN_ID;

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
                    <button class="zadm-btn" data-act="dismiss">${L('تجاهل', 'Dismiss')}</button>
                </div>
            </div>`).join('');
        body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
            const card = b.closest('.zadm-card'); const id = Number(card.dataset.rid); const act = b.dataset.act;
            if (act === 'delete' && !confirm(L('حذف هذا المحتوى نهائيًا؟', 'Delete this content permanently?'))) return;
            card.querySelectorAll('button').forEach(x => x.disabled = true);
            const r = await c.rpc('admin_resolve_report', { p_report_id: id, p_action: act });
            if (r.error) { alert(r.error.message); card.querySelectorAll('button').forEach(x => x.disabled = false); return; }
            load(body);
        }));
    }

    window.openReportsPanel = function () {
        if (!isAdmin()) return;
        css();
        document.getElementById('zadm')?.remove();
        const ov = document.createElement('div'); ov.id = 'zadm'; ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.innerHTML = `<div class="zadm-bar">${typeof window.zeloBackBtn === 'function' ? window.zeloBackBtn("document.getElementById('zadm').remove()", isAr()) : ''}<div class="zadm-title">🚩 ${L('البلاغات', 'Reports')}</div></div><div class="zadm-body" id="zadm-body"></div>`;
        document.body.appendChild(ov);
        load(document.getElementById('zadm-body'));
    };
    window.zeloIsAdmin = isAdmin;
})();
