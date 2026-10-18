/* ============================================================
 * profile/post-actions.js  —  إجراءات المنشور (قائمة ⋯ والنوافذ السفلية)
 * تثبيت، حذف، تفاعلات، ردود مخفية، حفظ، مشاركة المنشور
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const { US, esc, isAr, db, timeAgo, openExternal } = P;
    const F = P.feed;
    const FT = P.FT;

    // ===== نوافذ سفلية =====
    function openSheet(html) {
        document.getElementById('post-sheet')?.remove();
        const ar = isAr();
        const ov = document.createElement('div');
        ov.id = 'post-sheet';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        ov.innerHTML = `<div style="width:100%;max-width:500px;max-height:80vh;overflow-y:auto;box-sizing:border-box;direction:${tr('ui_ltr', 'rtl', 'ltr')};background:#0f1126;border:1px solid rgba(90,110,255,0.35);border-radius:22px 22px 0 0;padding:10px 0 22px 0;color:#fff;"><div style="width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,0.25);margin:0 auto 10px auto;"></div>${html}</div>`;
        document.body.appendChild(ov);
    }
    const closeSheet = () => document.getElementById('post-sheet')?.remove();
    const sheetRow = (icon, label, fn, danger) => `<div onclick="${fn}" style="display:flex;align-items:center;gap:14px;padding:15px 20px;cursor:pointer;font-weight:800;font-size:0.92rem;color:${danger ? '#ff6b6b' : '#fff'};"><span style="font-size:1.2rem;width:26px;text-align:center;">${icon}</span>${label}</div>`;
    const sheetNote = t => `<div style="padding:22px 20px;text-align:center;color:#94a3b8;font-weight:700;font-size:0.85rem;line-height:1.7;">${t}</div>`;

    const findPost = id => { const r = (F.cache.posts || []).find(e => String(e.item.id) === String(id)); return r ? r.item : null; };
    const anyPost = id => findPost(id) || (() => { for (const k in F.cache) { const r = (F.cache[k] || []).find(e => e.kind !== 'reply' && String(e.item.id) === String(id)); if (r) return r.item; } return null; })();

    async function profilesFor(uids) {
        const c = db(), map = {};
        if (!c || !uids.length) return map;
        const fill = rows => (rows || []).forEach(u => { map[String(u.user_id)] = u.nickname_ar || u.nickname_en || u.username || u.display_name || u.author_name || ''; });
        try { const r = await c.from('public_profiles').select('*').in('user_id', uids); if (!r.error && r.data && r.data.length) { fill(r.data); return map; } } catch (e) {}
        try { const r = await c.from('users').select('user_id,nickname_ar,nickname_en,username').in('user_id', uids); if (!r.error) fill(r.data); } catch (e) {}
        return map;
    }

    window.pfOpenPostMenu = function (id) {
        const ar = isAr();
        const p = findPost(id);
        if (!p) return;
        const sid = esc(String(id));
        openSheet(
            (p.pinned_at
                ? sheetRow('📍', tr('ui_unpin_from_profile', 'إلغاء التثبيت من الملف الشخصي', 'Unpin from profile'), `window.pfPinPost('${sid}',false)`)
                : sheetRow('📌', tr('ui_pin_to_your_profile', 'تثبيت المنشور في الملف الشخصي', 'Pin to your profile'), `window.pfPinPost('${sid}',true)`)) +
            sheetRow('🗑️', tr('ui_delete_post', 'حذف المنشور', 'Delete post'), `window.pfDeletePost('${sid}')`, true) +
            '<div style="height:1px;background:rgba(255,255,255,0.1);margin:4px 16px;"></div>' +
            sheetRow('📊', tr('ui_view_post_interactions', 'عرض التفاعلات مع المنشور', 'View post interactions'), `window.pfShowInteractions('${sid}')`) +
            sheetRow('🙈', tr('ui_view_hidden_replies', 'عرض الردود المخفية', 'View hidden replies'), `window.pfShowHiddenReplies('${sid}')`)
        );
    };

    window.pfPinPost = async function (id, pin) {
        const ar = isAr(), c = db(), uid = US().userId, T = FT();
        closeSheet();
        if (!c || !uid) return;
        if (pin) await c.from(T.posts).update({ pinned_at: null }).eq('user_id', String(uid)).not('pinned_at', 'is', null);
        const { error } = await c.from(T.posts).update({ pinned_at: pin ? new Date().toISOString() : null }).eq('id', id).eq('user_id', String(uid));
        if (error) { alert((tr('ui_failed', 'تعذّر التنفيذ: ', 'Failed: ')) + error.message + (/pinned_at/.test(error.message) ? (tr('ui_nrun_the_extra_sql', '\nشغّل ملف SQL الإضافي أولاً.', '\nRun the extra SQL first.')) : '')); return; }
        delete F.cache.posts;
        P.loadFeed(true);
    };

    window.pfDeletePost = async function (id) {
        const ar = isAr(), c = db(), uid = US().userId, T = FT();
        closeSheet();
        if (!confirm(tr('ui_delete_this_post_permanently', 'حذف هذا المنشور نهائياً؟', 'Delete this post permanently?'))) return;
        if (!c || !uid) return;
        const { error } = await c.from(T.posts).delete().eq('id', id).eq('user_id', String(uid));
        if (error) { alert((tr('ui_delete_failed', 'تعذّر الحذف: ', 'Delete failed: ')) + error.message); return; }
        Object.keys(F.cache).forEach(k => delete F.cache[k]);
        P.loadFeed(true);
    };

    window.pfShowInteractions = async function (id) {
        const ar = isAr(), c = db(), T = FT();
        openSheet(sheetNote(tr('ui_loading', 'جارٍ التحميل…', 'Loading…')));
        try {
            const [lk, rp, cm, vw] = await Promise.all([
                c.from('post_likes').select('user_id').eq('post_id', id),
                c.from(T.reposts).select('user_id').eq('post_id', id),
                c.from(T.comments).select('user_id,author_name').eq('post_id', id),
                c.from('post_views').select('post_id', { count: 'exact', head: true }).eq('post_id', id)
            ]);
            const likeIds = (lk.data || []).map(x => String(x.user_id));
            const repIds = (rp.data || []).map(x => String(x.user_id));
            const names = await profilesFor([...new Set([...likeIds, ...repIds])]);
            const list = (ids, fallback) => ids.length
                ? ids.slice(0, 40).map(u => `<div style="padding:6px 0;font-size:0.84rem;font-weight:700;color:#e2e8f0;">${esc(names[u] || fallback)}</div>`).join('')
                : `<div style="font-size:0.8rem;color:#7a7f9a;font-weight:700;">${tr('ui_nobody_yet', 'لا أحد بعد', 'Nobody yet')}</div>`;
            const sec = (icon, title, count, body) => `<div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="font-weight:900;font-size:0.9rem;margin-bottom:6px;">${icon} ${title} <span style="color:#7a7f9a;">(${count})</span></div>${body}</div>`;
            const cmNames = [...new Set((cm.data || []).map(x => x.author_name || names[String(x.user_id)] || '').filter(Boolean))];
            openSheet(
                `<div style="padding:4px 20px 10px;font-weight:900;font-size:1rem;">📊 ${tr('ui_post_interactions', 'التفاعلات مع المنشور', 'Post interactions')}</div>` +
                sec('👁', tr('ui_views', 'المشاهدات', 'Views'), (vw.count || 0).toLocaleString('en-US'), '') +
                sec('❤️', tr('ui_likes', 'الإعجابات', 'Likes'), likeIds.length, list(likeIds, tr('ui_user', 'مستخدم', 'User'))) +
                sec('🔁', tr('ui_reposts', 'إعادة النشر', 'Reposts'), repIds.length, list(repIds, tr('ui_user', 'مستخدم', 'User'))) +
                sec('💬', tr('ui_replies', 'الردود', 'Replies'), (cm.data || []).length, cmNames.length ? cmNames.slice(0, 40).map(n => `<div style="padding:6px 0;font-size:0.84rem;font-weight:700;color:#e2e8f0;">${esc(n)}</div>`).join('') : `<div style="font-size:0.8rem;color:#7a7f9a;font-weight:700;">${tr('ui_nobody_yet', 'لا أحد بعد', 'Nobody yet')}</div>`)
            );
        } catch (err) {
            openSheet(sheetNote((tr('ui_failed_2', 'تعذّر التحميل: ', 'Failed: ')) + esc(err.message || '')));
        }
    };

    window.pfShowHiddenReplies = async function (id) {
        const ar = isAr(), c = db(), T = FT();
        openSheet(sheetNote(tr('ui_loading', 'جارٍ التحميل…', 'Loading…')));
        const r = await c.from(T.comments).select('id,content,author_name,created_at').eq('post_id', id).eq('hidden', true).order('created_at', { ascending: false });
        if (r.error) { openSheet(sheetNote((tr('ui_failed_run_the_extra', 'تعذّر التحميل. شغّل ملف SQL الإضافي أولاً.<br>', 'Failed. Run the extra SQL first.<br>')) + esc(r.error.message))); return; }
        const rows = r.data || [];
        const title = `<div style="padding:4px 20px 10px;font-weight:900;font-size:1rem;">🙈 ${tr('ui_hidden_replies', 'الردود المخفية', 'Hidden replies')}</div>`;
        if (!rows.length) { openSheet(title + sheetNote(tr('ui_no_hidden_replies', 'لا توجد ردود مخفية', 'No hidden replies'))); return; }
        openSheet(title + rows.map(x => `
            <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="font-weight:900;font-size:0.84rem;">${esc(x.author_name || (tr('ui_user', 'مستخدم', 'User')))} <span style="color:#7a7f9a;font-weight:600;">· ${esc(timeAgo(x.created_at, ar))}</span></div>
                <div style="font-size:0.86rem;color:#e2e8f0;margin:4px 0 8px;white-space:pre-wrap;word-break:break-word;">${esc(x.content || '')}</div>
                <button class="small-btn" onclick="window.pfUnhideReply('${esc(String(x.id))}','${esc(String(id))}')">${tr('ui_unhide', 'إظهار الرد', 'Unhide')}</button>
            </div>`).join(''));
    };

    window.pfUnhideReply = async function (cid, pid) {
        const c = db();
        const { error } = await c.rpc('set_comment_hidden', { p_comment_id: Number(cid), p_hidden: false });
        if (error) { alert(error.message); return; }
        window.pfShowHiddenReplies(pid);
    };

    window.pfToggleBookmark = async function (id, el) {
        const ar = isAr(), c = db(), uid = US().userId;
        if (!c || !uid) return;
        const was = el.dataset.on === '1';
        el.dataset.on = was ? '0' : '1';
        el.style.opacity = was ? 0.45 : 1;
        const q = was
            ? c.from('post_bookmarks').delete().eq('post_id', id).eq('user_id', String(uid))
            : c.from('post_bookmarks').insert({ post_id: id, user_id: String(uid) });
        const { error } = await q;
        if (error) {
            el.dataset.on = was ? '1' : '0';
            el.style.opacity = was ? 1 : 0.45;
            alert((tr('ui_failed_3', 'تعذّر الحفظ: ', 'Failed: ')) + error.message);
            return;
        }
        for (const k in F.cache) (F.cache[k] || []).forEach(e => { if (String(e.kind === 'reply' ? e.item.post_id : e.item.id) === String(id)) e.saved = !was; });
    };

    function postLink(id) { return 'https://t.me/Zelo_Sport_bot?start=post_' + encodeURIComponent(String(id)); }

    window.pfSharePost = function (id) {
        const ar = isAr(), sid = esc(String(id));
        openSheet(
            `<div style="padding:4px 20px 10px;font-weight:900;font-size:1rem;">📤 ${tr('ui_share_post', 'مشاركة المنشور', 'Share post')}</div>` +
            sheetRow('✈️', 'Telegram', `window.pfSharePostVia('telegram','${sid}')`) +
            sheetRow('💬', tr('ui_whatsapp', 'واتساب', 'WhatsApp'), `window.pfSharePostVia('whatsapp','${sid}')`) +
            sheetRow('𝕏', 'X', `window.pfSharePostVia('x','${sid}')`) +
            sheetRow('🔗', tr('ui_copy_link', 'نسخ الرابط', 'Copy link'), `window.pfSharePostVia('copy','${sid}')`) +
            sheetRow('⋯', tr('ui_share_via', 'مشاركة عبر…', 'Share via…'), `window.pfSharePostVia('more','${sid}')`)
        );
    };

    window.pfSharePostVia = async function (kind, id) {
        const ar = isAr();
        const link = postLink(id);
        const p = anyPost(id);
        const snippet = p && (p.content || p.text) ? String(p.content || p.text).slice(0, 100) : 'Zelo Sport ⚽';
        const u = encodeURIComponent(link), t = encodeURIComponent(snippet);
        closeSheet();
        if (kind === 'telegram') openExternal(`https://t.me/share/url?url=${u}&text=${t}`);
        else if (kind === 'whatsapp') openExternal(`https://wa.me/?text=${t}%20${u}`);
        else if (kind === 'x') openExternal(`https://twitter.com/intent/tweet?text=${t}&url=${u}`);
        else if (kind === 'more' && navigator.share) navigator.share({ text: snippet, url: link }).catch(() => {});
        else {
            try { await navigator.clipboard.writeText(link); }
            catch (e) { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) {} ta.remove(); }
            alert(tr('ui_link_copied', 'تم نسخ الرابط ✅', 'Link copied ✅'));
        }
    };
})();
