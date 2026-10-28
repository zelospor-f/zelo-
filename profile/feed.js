/* ============================================================
 * profile/feed.js  —  المنشورات / الردود / إعادة النشر (مثل X)
 * يعرض تبويبات الملف الشخصي. إجراءات المنشور (تثبيت، حذف...) في post-actions.js
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const { US, esc, isAr, db, displayNameOf, avatarOf, timeAgo } = P;

    // أسماء الجداول الافتراضية — غيّرها عبر window.ZELO_FEED_TABLES إن اختلفت لديك
    P.FT = () => Object.assign({ posts: 'posts', comments: 'post_comments', reposts: 'post_reposts' }, window.ZELO_FEED_TABLES || {});
    const FT = P.FT;

    // ===== شكل أزرار المنشور (نفس شكل الصفحة الرئيسية) =====
    const svgIcon = (d, filled = false) =>
        `<svg viewBox="0 0 24 24" width="19" height="19" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const IC = {
        reply:  svgIcon('<path d="M21 11.5c0 4.14-3.8 7.5-8.5 7.5-.9 0-1.8-.12-2.6-.35L5 21l1.4-3.6C5.5 16.3 4.5 14.5 4.5 12.5 4.5 8.36 8.3 5 13 5s8 3.36 8 6.5z"/>'),
        repost: svgIcon('<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
        heart:  on => svgIcon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1.1a5.5 5.5 0 0 0 0-7.7z"/>', on),
        views:  svgIcon('<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>'),
        save:   on => svgIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', on),
        share:  svgIcon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>')
    };
    P.postIcons = IC; // يستخدمها post-actions.js
    if (!document.getElementById('pf-actions-css')) {
        const st = document.createElement('style');
        st.id = 'pf-actions-css';
        st.textContent = `
            .pf-actions { display:flex; justify-content:space-between; align-items:center; padding:6px 2px 0; }
            .pf-act { display:flex; align-items:center; gap:4px; padding:6px 5px; border-radius:999px; color:#9aa6d6; font-size:0.8rem; font-weight:700; cursor:default; }
            .pf-act .ic { display:inline-flex; align-items:center; justify-content:center; }
            .pf-act .ic svg { display:block; }
            .pf-act[onclick] { cursor:pointer; }
            .pf-save { opacity:0.6; }
            .pf-save.saved { opacity:1; color:#f5c35a; background:rgba(245,195,90,0.12); }
        `;
        document.head.appendChild(st);
    }

    // حالة المنشورات المشتركة مع post-actions.js
    P.feed = { tab: 'posts', cache: {} };
    const F = P.feed;

    // عند إغلاق صفحة المنشور أو تغيّر شيء فيها: حدّث المنشورات بصمت
    window.addEventListener('zelo-post-changed', () => {
        Object.keys(F.cache).forEach(k => delete F.cache[k]);
        if (document.getElementById('feed-box')) P.loadFeed(true, true);
    });

    // يجلب العناصر ثم يضيف العدّادات (إعجابات/ردود/إعادة نشر) وسياق الرد
    async function fetchFeed(tab) {
        const rows = await fetchFeedRaw(tab);
        const c = db();
        if (!c || !rows.length) return rows;
        const T = FT();
        const pid = e => String(e.kind === 'reply' ? e.item.post_id : e.item.id);
        const ids = [...new Set(rows.map(pid))].map(x => isNaN(x) ? x : Number(x));
        const count = async (table) => {
            const m = {};
            try {
                const r = await c.from(table).select('post_id').in('post_id', ids);
                (r.data || []).forEach(x => { const k = String(x.post_id); m[k] = (m[k] || 0) + 1; });
            } catch (e) {}
            return m;
        };
        const [likes, comments, reposts, views] = await Promise.all([count('post_likes'), count(T.comments), count(T.reposts), count('post_views')]);
        const marks = {};
        try {
            const br = await c.from('post_bookmarks').select('post_id').eq('user_id', String(US().userId)).in('post_id', ids);
            (br.data || []).forEach(x => marks[String(x.post_id)] = 1);
        } catch (e) {}
        let parents = {};
        if (tab === 'replies') {
            try {
                const pr = await c.from(T.posts).select('id,content,author_name').in('id', ids);
                (pr.data || []).forEach(p => parents[String(p.id)] = p);
            } catch (e) {}
        }
        rows.forEach(e => {
            const k = pid(e);
            e.counts = { likes: likes[k] || 0, replies: comments[k] || 0, reposts: reposts[k] || 0, views: views[k] || 0 };
            e.saved = !!marks[k];
            if (e.kind === 'reply') e.parent = parents[k] || null;
        });
        // المنشور المثبّت أولاً (الترتيب الباقي يبقى كما هو)
        if (tab === 'posts') rows.sort((a, b) => (b.item.pinned_at ? 1 : 0) - (a.item.pinned_at ? 1 : 0));
        return rows;
    }

    async function fetchFeedRaw(tab) {
        const c = db(), uid = US().userId;
        if (!c || !uid) return [];
        const T = FT();
        const own = { user_id: String(uid) };
        if (tab === 'posts') {
            const r = await c.from(T.posts).select('*').eq('user_id', own.user_id).order('created_at', { ascending: false }).limit(40);
            if (r.error) throw r.error;
            return (r.data || []).map(p => ({ kind: 'post', item: p, author: null }));
        }
        if (tab === 'replies') {
            const r = await c.from(T.comments).select('*').eq('user_id', own.user_id).order('created_at', { ascending: false }).limit(40);
            if (r.error) throw r.error;
            return (r.data || []).map(p => ({ kind: 'reply', item: p, author: null }));
        }
        // reposts
        const r = await c.from(T.reposts).select('*').eq('user_id', own.user_id).order('created_at', { ascending: false }).limit(40);
        if (r.error) throw r.error;
        const rows = r.data || [];
        const ids = [...new Set(rows.map(x => x.post_id).filter(Boolean))];
        let posts = {}, authors = {};
        if (ids.length) {
            const pr = await c.from(T.posts).select('*').in('id', ids);
            (pr.data || []).forEach(p => posts[String(p.id)] = p);
            const uids = [...new Set(Object.values(posts).map(p => p.user_id).filter(Boolean).map(String))];
            if (uids.length) {
                const ur = await c.from('users').select('user_id,nickname_ar,nickname_en,username,photo_url,badge_club').in('user_id', uids);
                (ur.data || []).forEach(u => authors[String(u.user_id)] = u);
            }
        }
        return rows.map(x => {
            const p = posts[String(x.post_id)];
            return p ? { kind: 'repost', item: p, repostAt: x.created_at, author: authors[String(p.user_id)] || null } : null;
        }).filter(Boolean);
    }

    function feedItemHtml(e, d, ar) {
        const p = e.item;
        const a = e.author;
        const isRepost = e.kind === 'repost';
        const name = isRepost
            ? ((a && (a.nickname_ar || a.nickname_en || a.username)) || p.author_name || '')
            : displayNameOf(d, ar);
        const user = isRepost ? (a ? a.username : '') : d.username;
        const photo = isRepost
            ? ((a && a.photo_url) || p.author_avatar || avatarOf({ photoUrl: '' }, name || '?'))
            : avatarOf(d, displayNameOf(d, ar));
        const badge = window.zeloVerifiedBadge(a ? a.badge_club : d.badgeClub, 14);
        const text = p.content ?? p.text ?? p.body ?? '';
        const img = p.image_url || p.media_url || p.image || '';
        const when = timeAgo(e.repostAt || p.created_at, ar);
        const ctx = e.kind === 'repost' ? `<div class="feed-ctx">🔁 ${tr('ui_you_reposted', 'أعدتَ النشر', 'You reposted')}</div>`
            : e.kind === 'reply' ? `<div class="feed-ctx">💬 ${tr('ui_replying_to', 'رددتَ على', 'Replying to')} ${esc((e.parent && e.parent.author_name) || (tr('ui_a_post', 'منشور', 'a post')))}</div>` : '';
        const quote = (e.kind === 'reply' && e.parent && e.parent.content)
            ? `<div class="feed-quote">${esc(String(e.parent.content).slice(0, 140))}</div>` : '';
        const cn = e.counts || {};
        const sid = esc(String(e.kind === 'reply' ? p.post_id : p.id));
        const pinnedHtml = (e.kind === 'post' && p.pinned_at) ? `<div class="feed-ctx">📌 ${tr('ui_pinned', 'مثبّت', 'Pinned')}</div>` : '';
        const menuBtn = e.kind === 'post' ? `<span class="feed-more" onclick="event.stopPropagation();window.pfOpenPostMenu('${sid}')">⋯</span>` : '';
        const n = v => Number(v || 0).toLocaleString('en-US');
        return `
            <div class="feed-item" style="cursor:pointer;" onclick="window.openPostPage && window.openPostPage('${sid}')">
                <img class="feed-av" src="${esc(photo)}" onerror="this.style.visibility='hidden'" alt="">
                <div class="feed-main">
                    ${pinnedHtml}${ctx}
                    <div class="feed-head"><b>${esc(name)}</b>${badge}${user ? `<span>@${esc(user)}</span>` : ''}<span>· ${esc(when)}</span>${menuBtn}</div>
                    ${text ? `<div class="feed-text">${esc(text)}</div>` : ''}
                    ${img ? `<img class="feed-img" src="${esc(img)}" onerror="this.style.display='none'" alt="">` : ''}
                    ${quote}
                    <div class="pf-actions">
                        <span class="pf-act"><span class="ic">${IC.reply}</span><span class="cnt">${n(cn.replies)}</span></span>
                        <span class="pf-act"><span class="ic">${IC.repost}</span><span class="cnt">${n(cn.reposts)}</span></span>
                        <span class="pf-act"><span class="ic">${IC.heart(false)}</span><span class="cnt">${n(cn.likes)}</span></span>
                        <span class="pf-act"><span class="ic">${IC.views}</span><span class="cnt">${n(cn.views)}</span></span>
                        <span class="pf-act pf-save ${e.saved ? 'saved' : ''}" data-on="${e.saved ? 1 : 0}" onclick="event.stopPropagation();window.pfToggleBookmark('${sid}', this)"><span class="ic">${IC.save(!!e.saved)}</span></span>
                        <span class="pf-act" onclick="event.stopPropagation();window.pfSharePost('${sid}')"><span class="ic">${IC.share}</span></span>
                    </div>
                </div>
            </div>`;
    }

    P.loadFeed = async function (force, silent) {
        const box = document.getElementById('feed-box');
        if (!box) return;
        const ar = isAr();
        const tab = F.tab;
        if (!force && F.cache[tab]) { renderFeed(F.cache[tab], box, ar); return; }
        if (!silent) box.innerHTML = `<div class="feed-empty">${tr('ui_loading', 'جارٍ التحميل…', 'Loading…')}</div>`;
        try {
            const rows = await fetchFeed(tab);
            F.cache[tab] = rows;
            if (tab === F.tab) renderFeed(rows, document.getElementById('feed-box'), ar);
        } catch (err) {
            console.error('feed error', err);
            const b = document.getElementById('feed-box');
            if (b) b.innerHTML = `<div class="feed-empty">${tr('ui_could_not_load_content', 'تعذّر تحميل المحتوى', 'Could not load content')}<br><small style="direction:ltr;display:block;margin-top:6px;">${esc(err.message || '')}</small></div>`;
        }
    };

    function renderFeed(rows, box, ar) {
        if (!box) return;
        if (!rows.length) {
            const msg = { posts: ['لا توجد منشورات بعد', 'No posts yet'], replies: ['لا توجد ردود بعد', 'No replies yet'], reposts: ['لا توجد إعادة نشر بعد', 'No reposts yet'] }[F.tab];
            box.innerHTML = `<div class="feed-empty">${ar ? msg[0] : msg[1]}</div>`;
            return;
        }
        box.innerHTML = rows.map(e => feedItemHtml(e, P.state.draft, ar)).join('');
    }

    window.switchProfileTab = function (tab) {
        F.tab = tab;
        document.querySelectorAll('.feed-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        P.loadFeed(false);
    };

    P.feedSectionHtml = function (ar) {
        const tabs = [['posts', tr('ui_posts', 'المنشورات', 'Posts')], ['replies', tr('ui_replies', 'الردود', 'Replies')], ['reposts', tr('ui_reposts', 'إعادة النشر', 'Reposts')]];
        // بطاقة "وثّق حسابك" (تظهر لغير المشتركين فقط، وتُملأ من premium.js)
        setTimeout(() => window.ZeloPremium && window.ZeloPremium.mountPromo && window.ZeloPremium.mountPromo(), 80);
        setTimeout(() => window.ZeloPremium && window.ZeloPremium.mountPromo && window.ZeloPremium.mountPromo(), 500);
        return `
            <div id="verify-promo"></div>
            <div class="feed-tabs">
                ${tabs.map(t => `<button class="feed-tab ${t[0] === F.tab ? 'active' : ''}" data-tab="${t[0]}" onclick="window.switchProfileTab('${t[0]}')">${t[1]}</button>`).join('')}
            </div>
            <div id="feed-box"></div>`;
    };

    // استدعِها من صفحة المنشورات الرئيسية عند ظهور منشور لمستخدم آخر لتسجيل مشاهدة (مرة لكل مستخدم)
    window.zeloRecordView = async function (postId) {
        const c = db(), uid = US().userId;
        if (!c || !uid || !postId) return;
        try { await c.from('post_views').upsert({ post_id: postId, user_id: String(uid) }, { onConflict: 'post_id,user_id', ignoreDuplicates: true }); } catch (e) {}
    };
})();
