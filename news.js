(function() {
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const isAr = () => US().lang === 'ar';
    const me = () => ({
        id: String(US().userId || ''),
        name: US().nickname || US().username || (isAr() ? 'لاعب' : 'Player'),
        avatar: US().photoUrl || ''
    });
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const avatarUrl = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'P')}&background=0c0e20&color=00FF87&size=96&bold=true`;
    const postCache = {};

    const STYLES = `
        .news-head { text-align: center; margin-bottom: 16px; }
        .news-title {
            margin: 0 0 4px 0; font-size: 1.3rem; font-weight: 900;
            background: linear-gradient(135deg, #2AABEE, #00FF87);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .news-sub { color: #94a3b8; font-size: 0.78rem; margin: 0; font-weight: bold; }

        .composer, .post-card {
            background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
            border: 1px solid rgba(90, 110, 255, 0.35);
            border-radius: 16px; padding: 12px; margin-bottom: 12px;
            box-shadow: 0 0 12px rgba(80, 100, 255, 0.12);
        }
        .composer-top { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
        .composer-text, .edit-area {
            flex: 1; min-height: 60px; resize: vertical; box-sizing: border-box;
            background: rgba(0,0,0,0.45); border: 1px solid rgba(90,110,255,0.3);
            border-radius: 12px; padding: 10px; color: #fff; font-size: 0.86rem; outline: none;
        }
        .composer-text:focus, .edit-area:focus, .cm-input:focus { border-color: #00FF87; }
        .cm-input {
            width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.45);
            border: 1px solid rgba(90,110,255,0.3); border-radius: 10px;
            padding: 8px 10px; color: #fff; font-size: 0.8rem; outline: none;
        }
        .composer-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
        .publish-btn {
            border: none; cursor: pointer; padding: 9px 20px; border-radius: 12px;
            background: linear-gradient(135deg, #2AABEE, #8B5CF6); color: #fff;
            font-weight: 900; font-size: 0.85rem; box-shadow: 0 4px 14px rgba(42,171,238,0.35);
        }

        .post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .post-avatar {
            width: 40px; height: 40px; min-width: 40px; border-radius: 50%;
            object-fit: cover; border: 2px solid rgba(0,255,135,0.5);
            box-shadow: 0 0 10px rgba(0,255,135,0.25);
        }
        .post-meta { flex: 1; min-width: 0; }
        .post-author { color: #fff; font-weight: 900; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .post-time { color: #7a7f9a; font-size: 0.68rem; font-weight: 700; margin-top: 2px; }
        .owner-actions { display: flex; gap: 6px; }
        .owner-actions button {
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem;
        }
        .post-text { color: #e2e8f0; font-size: 0.86rem; line-height: 1.6; word-break: break-word; }
        .post-img {
            width: 100%; max-height: 360px; object-fit: cover; border-radius: 12px;
            margin-top: 10px; border: 1px solid rgba(90,110,255,0.25);
        }
        .post-stats { color: #94a3b8; font-size: 0.72rem; font-weight: 700; margin: 10px 0 6px 0; }
        .post-actions {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;
            border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;
        }
        .act-btn {
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            color: #cbd5e1; border-radius: 10px; padding: 8px 4px; cursor: pointer;
            font-size: 0.74rem; font-weight: 800; transition: transform 0.15s;
        }
        .act-btn:active { transform: scale(0.96); }
        .act-btn.liked { color: #f472b6; border-color: rgba(244,114,182,0.4); background: rgba(244,114,182,0.1); }

        .comments-box {
            margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;
        }
        .cm-form { display: flex; gap: 6px; margin-bottom: 10px; }
        .cm-send {
            border: none; cursor: pointer; padding: 0 14px; border-radius: 10px;
            background: linear-gradient(135deg, #00FF87, #14B8A6); color: #04110B; font-weight: 900;
        }
        .cm { display: flex; gap: 8px; margin-bottom: 8px; }
        .cm-avatar { width: 28px; height: 28px; min-width: 28px; border-radius: 50%; object-fit: cover; }
        .cm-body {
            flex: 1; min-width: 0; background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 8px 10px;
        }
        .cm-name { color: #fff; font-weight: 800; font-size: 0.76rem; }
        .cm-time { color: #7a7f9a; font-weight: 700; font-size: 0.62rem; margin-inline-start: 4px; }
        .cm-text { color: #cbd5e1; font-size: 0.8rem; margin-top: 3px; word-break: break-word; }
        .cm-actions { display: flex; gap: 10px; margin-top: 4px; }
        .cm-actions button {
            background: none; border: none; color: #2AABEE; font-size: 0.7rem; font-weight: 800; cursor: pointer; padding: 0;
        }
        .cm-empty { text-align: center; color: #7a7f9a; font-size: 0.75rem; padding: 6px; }
        .edit-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
        .save-mini {
            border: none; cursor: pointer; padding: 7px 16px; border-radius: 10px;
            background: linear-gradient(135deg, #00FF87, #14B8A6); color: #04110B; font-weight: 900; font-size: 0.78rem;
        }
        .empty-box, .loading-box {
            text-align: center; padding: 26px 14px; color: #94a3b8; font-size: 0.85rem; font-weight: 700;
            background: rgba(20,22,48,0.8); border: 1px dashed rgba(90,110,255,0.4); border-radius: 16px;
        }
        .loading-box { color: #00FF87; }
    `;

    const emptyBox = msg => `<div class="empty-box">${msg}</div>`;

    function timeAgo(iso) {
        const diff = (Date.now() - new Date(iso).getTime()) / 1000;
        const ar = isAr();
        if (diff < 60) return ar ? 'الآن' : 'now';
        if (diff < 3600) { const m = Math.floor(diff / 60); return ar ? `منذ ${m} د` : `${m}m ago`; }
        if (diff < 86400) { const h = Math.floor(diff / 3600); return ar ? `منذ ${h} س` : `${h}h ago`; }
        const d = Math.floor(diff / 86400);
        return ar ? `منذ ${d} ي` : `${d}d ago`;
    }

    function postBodyHtml(p) {
        return `
            <div class="post-text">${esc(p.content).replace(/\n/g, '<br>')}</div>
            ${p.image_url ? `<img class="post-img" src="${esc(p.image_url)}" onerror="this.style.display='none'">` : ''}
        `;
    }

    function postHtml(p) {
        const mine = String(p.user_id) === me().id;
        const edited = p.updated_at && p.created_at && p.updated_at !== p.created_at;
        return `
            <div class="post-card" id="post-${p.id}">
                <div class="post-head">
                    <img class="post-avatar" src="${esc(avatarUrl(p.author_name, p.author_avatar))}" onerror="this.style.display='none'">
                    <div class="post-meta">
                        <div class="post-author">${esc(p.author_name)}</div>
                        <div class="post-time">${timeAgo(p.created_at)}${edited ? (isAr() ? ' · معدّل' : ' · edited') : ''}</div>
                    </div>
                    ${mine ? `
                        <div class="owner-actions">
                            <button onclick="window.startEditPost(${p.id})" title="${isAr() ? 'تعديل' : 'Edit'}">✏️</button>
                            <button onclick="window.deletePost(${p.id})" title="${isAr() ? 'حذف' : 'Delete'}">🗑️</button>
                        </div>` : ''}
                </div>
                <div id="post-body-${p.id}">${postBodyHtml(p)}</div>
                <div class="post-stats">❤️ ${p.likes} &nbsp;·&nbsp; 💬 ${p.comments}</div>
                <div class="post-actions">
                    <button class="act-btn like-btn ${p.liked ? 'liked' : ''}" onclick="window.toggleLike(${p.id})">
                        ${p.liked ? '❤️' : '🤍'} ${isAr() ? 'إعجاب' : 'Like'}
                    </button>
                    <button class="act-btn" onclick="window.toggleComments(${p.id})">💬 ${isAr() ? 'تعليق' : 'Comment'}</button>
                    <button class="act-btn" onclick="window.sharePost(${p.id})">🔗 ${isAr() ? 'مشاركة' : 'Share'}</button>
                </div>
                <div class="comments-box" id="comments-${p.id}" style="display: none;"></div>
            </div>
        `;
    }

    function updatePostUI(id) {
        const p = postCache[id];
        const el = document.getElementById(`post-${id}`);
        if (!p || !el) return;
        el.querySelector('.post-stats').innerHTML = `❤️ ${p.likes} &nbsp;·&nbsp; 💬 ${p.comments}`;
        const lb = el.querySelector('.like-btn');
        lb.className = 'act-btn like-btn' + (p.liked ? ' liked' : '');
        lb.innerHTML = `${p.liked ? '❤️' : '🤍'} ${isAr() ? 'إعجاب' : 'Like'}`;
    }

    function renderPostBody(id) {
        const p = postCache[id];
        const body = document.getElementById(`post-body-${id}`);
        if (p && body) body.innerHTML = postBodyHtml(p);
    }

    async function loadFeed() {
        const list = document.getElementById('feed-list');
        if (!list) return;
        const c = db();
        if (!c) { list.innerHTML = emptyBox(isAr() ? 'لا يوجد اتصال بقاعدة البيانات' : 'No database connection'); return; }

        const { data: posts, error } = await c.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) { list.innerHTML = emptyBox(isAr() ? '❌ تعذر تحميل المنشورات' : '❌ Failed to load posts'); return; }
        if (!posts || !posts.length) {
            list.innerHTML = emptyBox(isAr() ? 'لا توجد منشورات بعد. كن أول من ينشر! 🚀' : 'No posts yet. Be the first! 🚀');
            return;
        }

        const ids = posts.map(p => p.id);
        const [likesRes, cmRes] = await Promise.all([
            c.from('post_likes').select('post_id,user_id').in('post_id', ids),
            c.from('post_comments').select('post_id').in('post_id', ids)
        ]);
        const likes = likesRes.data || [];
        const cms = cmRes.data || [];

        posts.forEach(p => {
            postCache[p.id] = {
                ...p,
                likes: likes.filter(l => String(l.post_id) === String(p.id)).length,
                liked: likes.some(l => String(l.post_id) === String(p.id) && String(l.user_id) === me().id),
                comments: cms.filter(x => String(x.post_id) === String(p.id)).length
            };
        });

        list.innerHTML = posts.map(p => postHtml(postCache[p.id])).join('');
    }

    window.createPost = async function() {
        const textEl = document.getElementById('new-post-text');
        const imgEl = document.getElementById('new-post-img');
        const content = (textEl?.value || '').trim();
        const image = (imgEl?.value || '').trim();

        if (!content && !image) {
            alert(isAr() ? 'اكتب نصاً أو أضف صورة أولاً.' : 'Write something or add an image first.');
            return;
        }
        if (image && !/^https?:\/\//i.test(image)) {
            alert(isAr() ? 'رابط الصورة يجب أن يبدأ بـ http أو https' : 'Image URL must start with http or https');
            return;
        }

        const c = db();
        const u = me();
        const { error } = await c.from('posts').insert([{
            user_id: u.id,
            author_name: u.name,
            author_avatar: u.avatar,
            content: content,
            image_url: image || null
        }]);
        if (error) { alert((isAr() ? 'فشل النشر: ' : 'Post failed: ') + error.message); return; }

        textEl.value = '';
        imgEl.value = '';
        await loadFeed();
    };

    window.toggleLike = async function(id) {
        const c = db();
        const p = postCache[id];
        if (!c || !p) return;
        const uid = me().id;

        if (p.liked) {
            const { error } = await c.from('post_likes').delete().eq('post_id', id).eq('user_id', uid);
            if (error) { alert(error.message); return; }
            p.liked = false;
            p.likes = Math.max(0, p.likes - 1);
        } else {
            const { error } = await c.from('post_likes').insert([{ post_id: id, user_id: uid }]);
            if (error && error.code !== '23505') { alert(error.message); return; }
            p.liked = true;
            p.likes++;
        }
        updatePostUI(id);
    };

    window.startEditPost = function(id) {
        const p = postCache[id];
        const body = document.getElementById(`post-body-${id}`);
        if (!p || !body) return;
        body.innerHTML = `
            <textarea id="edit-text-${id}" class="edit-area" style="width:100%;">${esc(p.content)}</textarea>
            <input id="edit-img-${id}" class="cm-input" style="margin-top:8px;" value="${esc(p.image_url || '')}"
                   placeholder="${isAr() ? 'رابط الصورة (اختياري)' : 'Image URL (optional)'}">
            <div class="edit-actions">
                <button class="act-btn" style="padding:7px 14px;" onclick="window.cancelEditPost(${id})">${isAr() ? 'إلغاء' : 'Cancel'}</button>
                <button class="save-mini" onclick="window.saveEditPost(${id})">${isAr() ? 'حفظ' : 'Save'}</button>
            </div>`;
    };

    window.cancelEditPost = function(id) { renderPostBody(id); };

    window.saveEditPost = async function(id) {
        const content = document.getElementById(`edit-text-${id}`).value.trim();
        const image = document.getElementById(`edit-img-${id}`).value.trim();

        if (!content && !image) {
            alert(isAr() ? 'لا يمكن ترك المنشور فارغاً.' : 'Post cannot be empty.');
            return;
        }
        if (image && !/^https?:\/\//i.test(image)) {
            alert(isAr() ? 'رابط الصورة يجب أن يبدأ بـ http أو https' : 'Image URL must start with http or https');
            return;
        }

        const now = new Date().toISOString();
        const { error } = await db().from('posts')
            .update({ content: content, image_url: image || null, updated_at: now })
            .eq('id', id)
            .eq('user_id', me().id);
        if (error) { alert(error.message); return; }

        Object.assign(postCache[id], { content: content, image_url: image || null, updated_at: now });
        renderPostBody(id);
    };

    window.deletePost = async function(id) {
        if (!confirm(isAr() ? 'هل تريد حذف هذا المنشور؟' : 'Delete this post?')) return;
        const { error } = await db().from('posts').delete().eq('id', id).eq('user_id', me().id);
        if (error) { alert(error.message); return; }

        delete postCache[id];
        document.getElementById(`post-${id}`)?.remove();
        if (!document.querySelector('.post-card')) await loadFeed();
    };

    window.sharePost = async function(id) {
        const p = postCache[id];
        if (!p) return;
        const link = `https://t.me/Zelo_Sport_bot/app?startapp=post_${id}`;
        const text = `${p.author_name}: ${p.content || ''}`.slice(0, 200);

        if (navigator.share) {
            navigator.share({ title: 'ZELO FC', text: text, url: link }).catch(() => {});
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            alert(isAr() ? 'تم نسخ رابط المنشور 🔗' : 'Post link copied 🔗');
        } catch (e) {}
    };

    window.toggleComments = async function(postId) {
        const box = document.getElementById(`comments-${postId}`);
        if (!box) return;
        if (box.style.display === 'none') {
            box.style.display = 'block';
            await loadComments(postId);
        } else {
            box.style.display = 'none';
        }
    };

    async function loadComments(postId) {
        const box = document.getElementById(`comments-${postId}`);
        const c = db();
        if (!box || !c) return;

        const { data } = await c.from('post_comments').select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        const list = data || [];
        const kids = pid => list.filter(x => String(x.parent_id) === String(pid));

        const renderC = (cm, depth) => {
            const ind = Math.min(depth, 3) * 16;
            const side = isAr() ? 'margin-right' : 'margin-left';
            const mine = String(cm.user_id) === me().id;
            return `
                <div class="cm" style="${side}: ${ind}px;">
                    <img class="cm-avatar" src="${esc(avatarUrl(cm.author_name, cm.author_avatar))}" onerror="this.style.display='none'">
                    <div class="cm-body">
                        <div class="cm-name">${esc(cm.author_name)} <span class="cm-time">${timeAgo(cm.created_at)}</span></div>
                        <div class="cm-text">${esc(cm.content)}</div>
                        <div class="cm-actions">
                            <button onclick="window.showReplyBox(${postId}, ${cm.id})">↩️ ${isAr() ? 'رد' : 'Reply'}</button>
                            ${mine ? `<button onclick="window.deleteComment(${postId}, ${cm.id})">🗑️ ${isAr() ? 'حذف' : 'Delete'}</button>` : ''}
                        </div>
                        <div id="reply-box-${cm.id}"></div>
                    </div>
                </div>
                ${kids(cm.id).map(k => renderC(k, depth + 1)).join('')}`;
        };

        const tree = list.filter(x => !x.parent_id).map(r => renderC(r, 0)).join('');

        box.innerHTML = `
            <div class="cm-form">
                <input id="cm-input-${postId}" class="cm-input" placeholder="${isAr() ? 'اكتب تعليقاً...' : 'Write a comment...'}">
                <button class="cm-send" onclick="window.addComment(${postId}, null)">➤</button>
            </div>
            ${tree || `<div class="cm-empty">${isAr() ? 'لا توجد تعليقات بعد' : 'No comments yet'}</div>`}
        `;
    }

    window.showReplyBox = function(postId, cmId) {
        const box = document.getElementById(`reply-box-${cmId}`);
        if (!box) return;
        if (box.innerHTML) { box.innerHTML = ''; return; }
        box.innerHTML = `
            <div class="cm-form" style="margin-top:8px; margin-bottom:0;">
                <input id="reply-input-${cmId}" class="cm-input" placeholder="${isAr() ? 'اكتب رداً...' : 'Write a reply...'}">
                <button class="cm-send" onclick="window.addComment(${postId}, ${cmId})">➤</button>
            </div>`;
    };

    window.addComment = async function(postId, parentId) {
        const input = document.getElementById(parentId ? `reply-input-${parentId}` : `cm-input-${postId}`);
        const text = (input?.value || '').trim();
        if (!text) return;

        const c = db();
        const u = me();
        const { error } = await c.from('post_comments').insert([{
            post_id: postId,
            parent_id: parentId || null,
            user_id: u.id,
            author_name: u.name,
            author_avatar: u.avatar,
            content: text
        }]);
        if (error) { alert(error.message); return; }

        postCache[postId].comments++;
        updatePostUI(postId);
            };

    window.deleteComment = async function(postId, cmId) {
        if (!confirm(isAr() ? 'حذف هذا التعليق؟' : 'Delete this comment?')) return;
        const c = db();
        const { error } = await c.from('post_comments').delete().eq('id', cmId).eq('user_id', me().id);
        if (error) { alert(error.message); return; }

        const { data } = await c.from('post_comments').select('id').eq('post_id', postId);
        postCache[postId].comments = data ? data.length : 0;
        updatePostUI(postId);
        await loadComments(postId);
    };

    window.renderFriendsPage = async function(container) {
        const u = me();
        container.innerHTML = `
            <style>${STYLES}</style>

            <div class="news-head">
                <h2 class="news-title">📰 ${isAr() ? 'الأخبار' : 'News Feed'}</h2>
                <p class="news-sub">${isAr() ? 'شارك صورك وأفكارك مع مجتمع Zelo' : 'Share your moments with the Zelo community'}</p>
            </div>

            <div class="composer">
                <div class="composer-top">
                    <img class="post-avatar" src="${esc(avatarUrl(u.name, u.avatar))}" onerror="this.style.display='none'">
                    <textarea id="new-post-text" class="composer-text"
                        placeholder="${isAr() ? 'ماذا يحدث في عالم الرياضة؟' : 'What is happening?'}"></textarea>
                </div>
                <input id="new-post-img" class="cm-input"
                    placeholder="${isAr() ? 'رابط صورة (اختياري)' : 'Image URL (optional)'}">
                <div class="composer-actions">
                    <button class="publish-btn" onclick="window.createPost()">🚀 ${isAr() ? 'نشر' : 'Post'}</button>
                </div>
            </div>

            <div id="feed-list"><div class="loading-box">⏳ ${isAr() ? 'جاري تحميل الأخبار...' : 'Loading feed...'}</div></div>
            <div style="height: 20px;"></div>
        `;
        await loadFeed();
    };

    window.renderNewsPage = window.renderFriendsPage;
})();
