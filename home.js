(function() {
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const isAr = () => US().lang === 'ar';
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const myName = () => {
        const fallback = isAr() ? 'لاعب' : 'Player';
        return isAr()
            ? (US().nickname_ar || US().nickname_en || fallback)
            : (US().nickname_en || US().nickname_ar || fallback);
    };
    const me = () => ({ id: String(US().userId || ''), name: myName(), avatar: US().photoUrl || '' });
    const avatarUrl = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'P')}&background=0c0e20&color=00FF87&size=96&bold=true`;

    // ===== شارة التوثيق (شعار النادي الذي اختاره الناشر) =====
    const badgeMap = {};
    async function fetchBadges(userIds) {
        const c = db();
        const ids = [...new Set((userIds || []).map(String))].filter(id => id && !(id in badgeMap));
        if (!c || !ids.length) return;
        try {
            const { data } = await c.from('users').select('user_id,badge_club').in('user_id', ids);
            ids.forEach(id => { badgeMap[id] = ''; });
            (data || []).forEach(r => { badgeMap[String(r.user_id)] = r.badge_club ? String(r.badge_club) : ''; });
        } catch (e) { console.error('[ZELO] fetchBadges error:', e); }
    }
    const badgeHtml = (userId, size = 15) => {
        if (typeof window.zeloVerifiedBadge !== 'function') return '';
        const id = String(userId || '');
        const club = id === me().id ? (US().badgeClub || US().badge_club || badgeMap[id] || '') : (badgeMap[id] || '');
        return window.zeloVerifiedBadge(club, size);
    };

    const postCache = {};
    const editState = {};
    let pendingImage = '';

    // تحويل الصورة المختارة من الهاتف إلى صورة مضغوطة
    function readImage(file, maxSize = 900, quality = 0.75) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve('');
            if (!file.type.startsWith('image/')) return reject(new Error(isAr() ? 'الملف ليس صورة' : 'Not an image'));
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read failed'));
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const w = Math.round(img.width * scale);
                    const h = Math.round(img.height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('bad image'));
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

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
        .tool-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
        .tool-btn {
            border: 1px solid rgba(0,255,135,0.3); cursor: pointer; padding: 8px 12px; border-radius: 12px;
            background: rgba(0,255,135,0.1); color: #7CF7C4; font-weight: 800; font-size: 0.8rem;
        }
        .publish-btn {
            border: none; cursor: pointer; padding: 9px 20px; border-radius: 12px;
            background: linear-gradient(135deg, #2AABEE, #8B5CF6); color: #fff;
            font-weight: 900; font-size: 0.85rem; box-shadow: 0 4px 14px rgba(42,171,238,0.35);
        }
        .img-preview { position: relative; margin-top: 8px; }
        .img-preview img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 12px; border: 1px solid rgba(90,110,255,0.25); }
        .img-remove {
            position: absolute; top: 6px; left: 6px; border: none; cursor: pointer;
            background: rgba(0,0,0,0.7); color: #fff; width: 28px; height: 28px; border-radius: 50%; font-weight: 900;
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

        .comments-box { margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; }
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
        .cm-actions button { background: none; border: none; color: #2AABEE; font-size: 0.7rem; font-weight: 800; cursor: pointer; padding: 0; }
        .cm-empty { text-align: center; color: #7a7f9a; font-size: 0.75rem; padding: 6px; }
        .save-mini {
            border: none; cursor: pointer; padding: 7px 16px; border-radius: 10px;
            background: linear-gradient(135deg, #00FF87, #14B8A6); color: #04110B; font-weight: 900; font-size: 0.78rem;
        }
        .empty-box, .loading-box {
            text-align: center; padding: 26px 14px; color: #94a3b8; font-size: 0.85rem; font-weight: 700;
            background: rgba(20,22,48,0.8); border: 1px dashed rgba(90,110,255,0.4); border-radius: 16px;
        }
        .loading-box { color: #00FF87; }

        /* زر النشر العائم (مثل X) */
        .fab-compose {
            position: fixed; bottom: 105px; inset-inline-end: 20px;
            width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer;
            background: #1d9bf0; color: #fff; font-size: 1.8rem; line-height: 1;
            display: flex; align-items: center; justify-content: center; padding: 0;
            box-shadow: 0 6px 20px rgba(29,155,240,0.5); z-index: 1500; transition: transform 0.15s;
        }
        .fab-compose:active { transform: scale(0.92); }

        /* شاشة كتابة المنشور */
        .compose-overlay {
            position: fixed; inset: 0; z-index: 3000; background: #121215;
            display: flex; flex-direction: column; animation: fadeUp 0.25s ease-out;
        }
        .compose-top {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .compose-close { background: none; border: none; color: #fff; font-size: 1.4rem; cursor: pointer; padding: 4px 8px; }
        .compose-post-btn {
            border: none; cursor: pointer; padding: 8px 24px; border-radius: 999px;
            background: #1d9bf0; color: #fff; font-weight: 900; font-size: 0.9rem;
        }
        .compose-body { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start; }
        .compose-body textarea {
            width: 100%; min-height: 140px; background: transparent; border: none; outline: none;
            resize: none; color: #fff; font-size: 1.05rem; font-family: inherit; box-sizing: border-box;
        }
        .compose-tools {
            display: flex; align-items: center; gap: 10px; padding: 10px 16px;
            padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid rgba(255,255,255,0.08);
        }

        /* أزرار التفاعل على طريقة X */
        .post-actions {
            display: flex; justify-content: space-between; align-items: center;
            border-top: none; padding: 6px 2px 0;
        }
        .post-actions .act-btn {
            background: none; border: none; border-radius: 999px; padding: 6px 10px;
            display: flex; align-items: center; gap: 6px; color: #94a3b8;
            font-size: 0.85rem; font-weight: 700;
        }
        .post-actions .act-btn .ic { font-size: 1.05rem; }
        .post-actions .act-btn.liked { color: #f91880; background: rgba(249,24,128,0.12); border: none; }
        .post-actions .act-btn.reposted { color: #00ba7c; background: rgba(0,186,124,0.12); }

        /* صور وملصقات وايموجي الردود */
        .cm-img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 10px; margin-top: 6px; border: 1px solid rgba(255,255,255,0.08); }
        .cm-sticker { font-size: 3.2rem; line-height: 1.1; margin-top: 2px; }
        .emoji-grid {
            display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
            padding: 8px 10px; max-height: 230px; overflow-y: auto;
            border-top: 1px solid rgba(255,255,255,0.08); background: #17171c;
        }
        .emoji-grid.stk { grid-template-columns: repeat(4, 1fr); }
        .emoji-btn { background: none; border: none; font-size: 1.5rem; padding: 6px 0; cursor: pointer; }
        .stk-btn { font-size: 2.6rem; }
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
            <div onclick="window.toggleComments(${p.id})" style="cursor:pointer;">
                <div class="post-text">${esc(p.content).replace(/\n/g, '<br>')}</div>
                ${p.image_url ? `<img class="post-img" src="${p.image_url}" onerror="this.style.display='none'">` : ''}
            </div>
        `;
    }

    // أزرار التفاعل مع الأعداد (تعليق · إعادة نشر · إعجاب · مشاركة)
    function actionsHtml(p) {
        return `
            <button class="act-btn" onclick="window.openReply(${p.id})">
                <span class="ic">💬</span><span class="cnt">${p.comments || 0}</span>
            </button>
            <button class="act-btn rp-btn ${p.reposted ? 'reposted' : ''}" onclick="window.toggleRepost(${p.id})">
                <span class="ic">🔁</span><span class="cnt">${p.reposts || 0}</span>
            </button>
            <button class="act-btn like-btn ${p.liked ? 'liked' : ''}" onclick="window.toggleLike(${p.id})">
                <span class="ic">${p.liked ? '❤️' : '🤍'}</span><span class="cnt">${p.likes || 0}</span>
            </button>
            <button class="act-btn" onclick="window.sharePost(${p.id})">
                <span class="ic">🔗</span>
            </button>
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
                        <div class="post-author">${esc(p.author_name)}${badgeHtml(p.user_id)}</div>
                        <div class="post-time">${timeAgo(p.created_at)}${edited ? (isAr() ? ' · معدّل' : ' · edited') : ''}</div>
                    </div>
                    ${mine ? `
                        <div class="owner-actions">
                            <button onclick="window.startEditPost(${p.id})">✏️</button>
                            <button onclick="window.deletePost(${p.id})">🗑️</button>
                        </div>` : ''}
                </div>
                <div id="post-body-${p.id}">${postBodyHtml(p)}</div>
                <div class="post-actions">${actionsHtml(p)}</div>
                <div class="comments-box" id="comments-${p.id}" style="display: none;"></div>
            </div>
        `;
    }

    function updatePostUI(id) {
        const p = postCache[id];
        const el = document.getElementById(`post-${id}`);
        if (!p || !el) return;
        const box = el.querySelector('.post-actions');
        if (box) box.innerHTML = actionsHtml(p);
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
        if (error) {
            console.error('[ZELO] loadFeed error:', error);
            list.innerHTML = emptyBox((isAr() ? '❌ تعذر تحميل المنشورات: ' : '❌ Failed to load posts: ') + esc(error.message));
            return;
        }
        if (!posts || !posts.length) {
            list.innerHTML = emptyBox(isAr() ? 'لا توجد منشورات بعد. كن أول من ينشر! 🚀' : 'No posts yet. Be the first! 🚀');
            return;
        }

        const ids = posts.map(p => p.id);
        const [likesRes, cmRes, rpRes] = await Promise.all([
            c.from('post_likes').select('post_id,user_id').in('post_id', ids),
            c.from('post_comments').select('post_id').in('post_id', ids),
            c.from('post_reposts').select('post_id,user_id').in('post_id', ids)
        ]);
        const likes = likesRes.data || [];
        const cms = cmRes.data || [];
        const reps = rpRes.data || []; // إن لم يوجد الجدول بعد تبقى القائمة فارغة

        posts.forEach(p => {
            postCache[p.id] = {
                ...p,
                likes: likes.filter(l => String(l.post_id) === String(p.id)).length,
                liked: likes.some(l => String(l.post_id) === String(p.id) && String(l.user_id) === me().id),
                comments: cms.filter(x => String(x.post_id) === String(p.id)).length,
                reposts: reps.filter(r => String(r.post_id) === String(p.id)).length,
                reposted: reps.some(r => String(r.post_id) === String(p.id) && String(r.user_id) === me().id)
            };
        });

        await fetchBadges(posts.map(p => p.user_id));
        list.innerHTML = posts.map(p => postHtml(postCache[p.id])).join('');
    }

    // اختيار صورة من الهاتف للمنشور الجديد
    window.pickPostImage = async function(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
            pendingImage = await readImage(file);
            document.getElementById('composer-preview').innerHTML = `
                <div class="img-preview">
                    <img src="${pendingImage}">
                    <button class="img-remove" onclick="window.clearPostImage()">✕</button>
                </div>`;
        } catch (e) {
            alert(e.message);
        }
        input.value = '';
    };

    window.clearPostImage = function() {
        pendingImage = '';
        const pv = document.getElementById('composer-preview');
        if (pv) pv.innerHTML = '';
    };

    window.createPost = async function() {
        const textEl = document.getElementById('new-post-text');
        const content = (textEl?.value || '').trim();

        if (!content && !pendingImage) {
            alert(isAr() ? 'اكتب نصاً أو أضف صورة أولاً.' : 'Write something or add an image first.');
            return;
        }

        const c = db();
        if (!c) { alert(isAr() ? 'لا يوجد اتصال بقاعدة البيانات' : 'No database connection'); return; }
        const u = me();
        const { error } = await c.from('posts').insert([{
            user_id: u.id,
            author_name: u.name,
            author_avatar: u.avatar,
            content: content,
            image_url: pendingImage || null
        }]);
        if (error) { alert((isAr() ? 'فشل النشر: ' : 'Post failed: ') + error.message); return; }

        textEl.value = '';
        window.clearPostImage();
        window.closeCompose();
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

    window.toggleRepost = async function(id) {
        const c = db();
        const p = postCache[id];
        if (!c || !p) return;
        const uid = me().id;

        if (p.reposted) {
            const { error } = await c.from('post_reposts').delete().eq('post_id', id).eq('user_id', uid);
            if (error) { alert(error.message); return; }
            p.reposted = false;
            p.reposts = Math.max(0, (p.reposts || 0) - 1);
        } else {
            const { error } = await c.from('post_reposts').insert([{ post_id: id, user_id: uid }]);
            if (error && error.code !== '23505') { alert(error.message); return; }
            p.reposted = true;
            p.reposts = (p.reposts || 0) + 1;
        }
        updatePostUI(id);
    };

    // تعديل المنشور مع إمكانية تغيير الصورة أو حذفها
    window.startEditPost = function(id) {
        const p = postCache[id];
        if (!p) return;
        editState[id] = { newImage: null, removed: false };
        renderEdit(id, p.content);
    };

    function renderEdit(id, content) {
        const p = postCache[id];
        const body = document.getElementById(`post-body-${id}`);
        if (!p || !body) return;
        const st = editState[id];
        const shownImage = st.removed ? '' : (st.newImage || p.image_url || '');

        body.innerHTML = `
            <textarea id="edit-text-${id}" class="edit-area" style="width:100%;">${esc(content)}</textarea>
            ${shownImage ? `
                <div class="img-preview">
                    <img src="${shownImage}">
                    <button class="img-remove" onclick="window.removeEditImage(${id})">✕</button>
                </div>` : ''}
            <div class="tool-row">
                <label class="tool-btn" style="margin:0;">
                    📷 ${isAr() ? 'تغيير الصورة' : 'Change image'}
                    <input type="file" accept="image/*" style="display:none;" onchange="window.pickEditImage(${id}, this)">
                </label>
                <div style="display:flex; gap:8px;">
                    <button class="act-btn" style="padding:7px 14px;" onclick="window.cancelEditPost(${id})">${isAr() ? 'إلغاء' : 'Cancel'}</button>
                    <button class="save-mini" onclick="window.saveEditPost(${id})">${isAr() ? 'حفظ' : 'Save'}</button>
                </div>
            </div>`;
    }

    window.pickEditImage = async function(id, input) {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
            editState[id].newImage = await readImage(file);
            editState[id].removed = false;
            const txt = document.getElementById(`edit-text-${id}`)?.value ?? postCache[id].content;
            renderEdit(id, txt);
        } catch (e) { alert(e.message); }
    };

    window.removeEditImage = function(id) {
        editState[id].removed = true;
        editState[id].newImage = null;
        const txt = document.getElementById(`edit-text-${id}`)?.value ?? postCache[id].content;
        renderEdit(id, txt);
    };

    window.cancelEditPost = function(id) {
        delete editState[id];
        renderPostBody(id);
    };

    window.saveEditPost = async function(id) {
        const content = document.getElementById(`edit-text-${id}`).value.trim();
        const st = editState[id] || {};
        const p = postCache[id];

        let image = p.image_url || null;
        if (st.removed) image = null;
        if (st.newImage) image = st.newImage;

        if (!content && !image) {
            alert(isAr() ? 'لا يمكن ترك المنشور فارغاً.' : 'Post cannot be empty.');
            return;
        }

        const now = new Date().toISOString();
        const { error } = await db().from('posts')
            .update({ content: content, image_url: image, updated_at: now })
            .eq('id', id)
            .eq('user_id', me().id);
        if (error) { alert(error.message); return; }

        Object.assign(p, { content: content, image_url: image, updated_at: now });
        delete editState[id];
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
            alert(isAr() ? 'تم نسخ رابط المنشور بنجاح! 🔗' : 'Post link copied successfully! 🔗');
        } catch (e) {
            prompt(isAr() ? 'انسخ الرابط:' : 'Copy link:', link);
        }
    };

    // ===================== التعليقات =====================
    // نص الرد: ملصق كبير، أو نص عادي، مع صورة إن وُجدت
    function commentContentHtml(cm) {
        const t = String(cm.content || '');
        let html = '';
        if (t.startsWith('::sticker::')) {
            html += `<div class="cm-sticker">${esc(t.slice(11))}</div>`;
        } else if (t) {
            html += `<div class="cm-text">${esc(t).replace(/\n/g, '<br>')}</div>`;
        }
        if (cm.image_url) {
            html += `<img class="cm-img" src="${cm.image_url}" onerror="this.style.display='none'">`;
        }
        return html;
    }

    function commentHtml(postId, cm) {
        const mine = String(cm.user_id) === me().id;
        return `
            <div class="cm" id="cm-${cm.id}">
                <img class="cm-avatar" src="${esc(avatarUrl(cm.author_name, cm.author_avatar))}" onerror="this.style.display='none'">
                <div class="cm-body">
                    <div>
                        <span class="cm-name">${esc(cm.author_name)}${badgeHtml(cm.user_id, 13)}</span>
                        <span class="cm-time">${timeAgo(cm.created_at)}</span>
                    </div>
                    ${commentContentHtml(cm)}
                    ${mine ? `
                        <div class="cm-actions">
                            <button onclick="window.deleteComment(${postId}, ${cm.id})">${isAr() ? 'حذف' : 'Delete'}</button>
                        </div>` : ''}
                </div>
            </div>
        `;
    }

    async function loadComments(id) {
        const box = document.getElementById(`comments-${id}`);
        const list = document.getElementById(`cm-list-${id}`);
        if (!box || !list) return;
        const c = db();
        if (!c) { list.innerHTML = `<div class="cm-empty">${isAr() ? 'لا يوجد اتصال' : 'No connection'}</div>`; return; }

        const { data, error } = await c.from('post_comments')
            .select('*')
            .eq('post_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[ZELO] loadComments error:', error);
            list.innerHTML = `<div class="cm-empty">${isAr() ? '❌ تعذر تحميل التعليقات' : '❌ Failed to load comments'}</div>`;
            return;
        }
        if (!data || !data.length) {
            list.innerHTML = `<div class="cm-empty">${isAr() ? 'لا توجد تعليقات بعد' : 'No comments yet'}</div>`;
            return;
        }
        await fetchBadges(data.map(cm => cm.user_id));
        list.innerHTML = data.map(cm => commentHtml(id, cm)).join('');
    }

    window.toggleComments = async function(id) {
        const box = document.getElementById(`comments-${id}`);
        if (!box) return;

        if (box.style.display !== 'none') {
            box.style.display = 'none';
            return;
        }

        box.style.display = 'block';
        box.innerHTML = `<div id="cm-list-${id}"><div class="cm-empty">...</div></div>`;
        await loadComments(id);
    };

    window.addComment = async function(id) {
        const input = document.getElementById(`cm-input-${id}`);
        const content = (input?.value || '').trim();
        if (!content) return;

        const c = db();
        if (!c) { alert(isAr() ? 'لا يوجد اتصال بقاعدة البيانات' : 'No database connection'); return; }
        const u = me();

        const { error } = await c.from('post_comments').insert([{
            post_id: id,
            user_id: u.id,
            author_name: u.name,
            author_avatar: u.avatar,
            content: content
        }]);
        if (error) { alert((isAr() ? 'فشل إرسال التعليق: ' : 'Comment failed: ') + error.message); return; }

        input.value = '';
        if (postCache[id]) { postCache[id].comments++; updatePostUI(id); }
        await loadComments(id);
    };

    window.deleteComment = async function(postId, commentId) {
        if (!confirm(isAr() ? 'هل تريد حذف هذا التعليق؟' : 'Delete this comment?')) return;
        const { error } = await db().from('post_comments').delete().eq('id', commentId).eq('user_id', me().id);
        if (error) { alert(error.message); return; }

        if (postCache[postId]) { postCache[postId].comments = Math.max(0, postCache[postId].comments - 1); updatePostUI(postId); }
        await loadComments(postId);
    };

    // ===================== نافذة الرد (مثل X) =====================
    let replyImage = '';
    let replyTargetId = null;

    const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😎',
        '🤩','🥳','😏','😒','😞','😔','😢','😭','😤','😡','🤬','😱','😨','🤔','🙄','😴',
        '🤗','🤭','🫡','👍','👎','👏','🙌','🙏','💪','🤝','✌️','👀','🔥','💯','❤️','💔',
        '💙','💚','⚽','🏆','🥅','🎯','🥇','🏟️','🎉','👑','🐐','🌟','🚀','⚡','🤯','😬'];
    const STICKERS = ['⚽','🏆','🔥','👏','😂','😍','🤩','😭','💪','🥅','🎉','👑','🐐','🙌','🥇','🤝'];

    function updateReplyBtn() {
        const t = (document.getElementById('reply-text')?.value || '').trim();
        const b = document.getElementById('reply-send');
        if (b) b.style.opacity = (t || replyImage) ? 1 : 0.5;
    }
    window.updateReplyBtn = updateReplyBtn;

    window.openReply = function(id) {
        const p = postCache[id];
        if (!p || document.getElementById('reply-overlay')) return;
        replyImage = '';
        replyTargetId = id;
        const u = me();
        const ov = document.createElement('div');
        ov.id = 'reply-overlay';
        ov.className = 'compose-overlay';
        ov.innerHTML = `
            <div class="compose-top">
                <button class="compose-close" onclick="window.closeReply()">✕</button>
                <button class="compose-post-btn" id="reply-send" style="opacity:0.5;" onclick="window.submitReply(${id})">${isAr() ? 'الرّد' : 'Reply'}</button>
            </div>
            <div style="padding: 12px 16px 0; color: #94a3b8; font-size: 0.9rem;">
                ${isAr() ? 'ردا على' : 'Replying to'} <span style="color:#1d9bf0;">@${esc(p.author_name)}</span>
            </div>
            <div class="compose-body">
                <img class="post-avatar" src="${esc(avatarUrl(u.name, u.avatar))}" onerror="this.style.display='none'">
                <div style="flex:1; min-width:0;">
                    <textarea id="reply-text" maxlength="500"
                              placeholder="${isAr() ? 'انشر ردّك' : 'Post your reply'}"
                              oninput="window.updateReplyBtn()"></textarea>
                    <div id="reply-preview"></div>
                </div>
            </div>
            <div id="reply-panel" style="display:none;"></div>
            <div class="compose-tools">
                <label class="tool-btn" style="margin:0;">
                    📷
                    <input type="file" accept="image/*" style="display:none;" onchange="window.pickReplyImage(this)">
                </label>
                <button class="tool-btn" onclick="window.toggleReplyPanel('emoji')">😀</button>
                <button class="tool-btn" onclick="window.toggleReplyPanel('stickers')">🎉 ${isAr() ? 'ملصقات' : 'Stickers'}</button>
            </div>
        `;
        document.body.appendChild(ov);
        setTimeout(() => document.getElementById('reply-text')?.focus(), 150);
    };

    window.closeReply = function() {
        document.getElementById('reply-overlay')?.remove();
        replyImage = '';
    };

    window.pickReplyImage = async function(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
            replyImage = await readImage(file, 800, 0.7);
            document.getElementById('reply-preview').innerHTML = `
                <div class="img-preview">
                    <img src="${replyImage}">
                    <button class="img-remove" onclick="window.clearReplyImage()">✕</button>
                </div>`;
            updateReplyBtn();
        } catch (e) { alert(e.message); }
        input.value = '';
    };

    window.clearReplyImage = function() {
        replyImage = '';
        const pv = document.getElementById('reply-preview');
        if (pv) pv.innerHTML = '';
        updateReplyBtn();
    };

    // لوحة الايموجي والملصقات
    window.toggleReplyPanel = function(kind) {
        const panel = document.getElementById('reply-panel');
        if (!panel) return;
        if (panel.dataset.kind === kind && panel.style.display !== 'none') {
            panel.style.display = 'none';
            return;
        }
        panel.dataset.kind = kind;
        panel.style.display = 'block';
        document.getElementById('reply-text')?.blur(); // لإخفاء لوحة المفاتيح وإظهار اللوحة
        if (kind === 'emoji') {
            panel.innerHTML = `<div class="emoji-grid">${EMOJIS.map(e =>
                `<button class="emoji-btn" onclick="window.insertReplyEmoji('${e}')">${e}</button>`).join('')}</div>`;
        } else {
            panel.innerHTML = `<div class="emoji-grid stk">${STICKERS.map(e =>
                `<button class="emoji-btn stk-btn" onclick="window.sendSticker('${e}')">${e}</button>`).join('')}</div>`;
        }
    };

    window.insertReplyEmoji = function(emoji) {
        const t = document.getElementById('reply-text');
        if (!t) return;
        const a = t.selectionStart ?? t.value.length;
        const b = t.selectionEnd ?? a;
        t.value = t.value.slice(0, a) + emoji + t.value.slice(b);
        const pos = a + emoji.length;
        try { t.setSelectionRange(pos, pos); } catch (e) {}
        updateReplyBtn();
    };

    // الملصق يُرسل مباشرة كرد كامل
    window.sendSticker = function(emoji) {
        if (replyTargetId == null) return;
        window.submitReply(replyTargetId, '::sticker::' + emoji);
    };

    window.submitReply = async function(id, forcedContent) {
        const raw = (forcedContent !== undefined) ? forcedContent : (document.getElementById('reply-text')?.value || '');
        const content = String(raw).trim();
        const image = (forcedContent === undefined) ? replyImage : '';
        if (!content && !image) return;

        const c = db();
        if (!c) { alert(isAr() ? 'لا يوجد اتصال بقاعدة البيانات' : 'No database connection'); return; }
        const u = me();

        const row = { post_id: id, user_id: u.id, author_name: u.name, author_avatar: u.avatar, content: content };
        if (image) row.image_url = image;

        const { error } = await c.from('post_comments').insert([row]);
        if (error) {
            alert((isAr() ? 'فشل إرسال الرد: ' : 'Reply failed: ') + error.message +
                (image ? (isAr() ? '\n(تأكد من إضافة عمود image_url لجدول post_comments)' : '\n(make sure post_comments has an image_url column)') : ''));
            return;
        }

        window.closeReply();
        if (postCache[id]) { postCache[id].comments = (postCache[id].comments || 0) + 1; updatePostUI(id); }
        const box = document.getElementById(`comments-${id}`);
        if (box && box.style.display !== 'none') await loadComments(id);
    };

    // ===================== زر النشر العائم (مثل X) =====================
    let fabObserver = null;

    function removeFab() {
        document.getElementById('fab-compose')?.remove();
        document.getElementById('compose-overlay')?.remove();
        document.getElementById('reply-overlay')?.remove();
        if (fabObserver) { fabObserver.disconnect(); fabObserver = null; }
    }

    function setupFab() {
        removeFab();
        const fab = document.createElement('button');
        fab.id = 'fab-compose';
        fab.className = 'fab-compose';
        fab.textContent = '⚽';
        fab.onclick = () => window.openCompose();
        document.body.appendChild(fab);

        // يختفي الزر تلقائياً عند مغادرة الصفحة
        const main = document.getElementById('main-content');
        if (main) {
            fabObserver = new MutationObserver(() => {
                if (!document.getElementById('feed-list')) removeFab();
            });
            fabObserver.observe(main, { childList: true });
        }
    }

    window.openCompose = function() {
        if (document.getElementById('compose-overlay')) return;
        pendingImage = '';
        const u = me();
        const ov = document.createElement('div');
        ov.id = 'compose-overlay';
        ov.className = 'compose-overlay';
        ov.innerHTML = `
            <div class="compose-top">
                <button class="compose-close" onclick="window.closeCompose()">✕</button>
                <button class="compose-post-btn" onclick="window.createPost()">${isAr() ? 'نشر' : 'Post'}</button>
            </div>
            <div class="compose-body">
                <img class="post-avatar" src="${esc(avatarUrl(u.name, u.avatar))}" onerror="this.style.display='none'">
                <div style="flex:1; min-width:0;">
                    <textarea id="new-post-text" maxlength="1000"
                              placeholder="${isAr() ? 'ماذا يحدث؟' : "What's happening?"}"></textarea>
                    <div id="composer-preview"></div>
                </div>
            </div>
            <div class="compose-tools">
                <label class="tool-btn" style="margin:0;">
                    📷 ${isAr() ? 'إضافة صورة' : 'Add image'}
                    <input type="file" accept="image/*" style="display:none;" onchange="window.pickPostImage(this)">
                </label>
            </div>
        `;
        document.body.appendChild(ov);
        setTimeout(() => document.getElementById('new-post-text')?.focus(), 150);
    };

    window.closeCompose = function() {
        document.getElementById('compose-overlay')?.remove();
        pendingImage = '';
    };

    // ===================== رسم الصفحة =====================
    window.renderHomePage = function(container) {
        if (!container) return;

        if (!document.getElementById('news-styles')) {
            const st = document.createElement('style');
            st.id = 'news-styles';
            st.textContent = STYLES;
            document.head.appendChild(st);
        }

        pendingImage = '';
        const u = me();

        container.innerHTML = `
            <div class="news-head">
                <h2 class="news-title">⚽ ZELO FC</h2>
                <p class="news-sub">${isAr() ? 'شارك أفكارك وصورك مع المشجعين' : 'Share your thoughts and photos with fans'}</p>
            </div>

            <div id="feed-list">
                <div class="loading-box">${isAr() ? 'جاري تحميل المنشورات...' : 'Loading posts...'}</div>
            </div>
        `;

        loadFeed();
        setupFab();
    };

    // أسماء بديلة قديمة تبقى تعمل مع app.js
    window.renderCommunityPage = window.renderHomePage;
    window.renderNewsPage = window.renderHomePage;
})();
