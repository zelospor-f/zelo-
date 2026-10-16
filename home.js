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

    // ===== بيانات المؤلفين من العرض العام: الشارة واسم المستخدم =====
    const profMap = {};
    async function fetchBadges(userIds) {
        const c = db();
        const ids = [...new Set((userIds || []).map(String))].filter(id => id && !(id in profMap));
        if (!c || !ids.length) return;
        try {
            const { data } = await c.from('public_profiles').select('user_id,badge_club,username').in('user_id', ids);
            ids.forEach(id => { profMap[id] = { badge: '', username: '' }; });
            (data || []).forEach(r => {
                profMap[String(r.user_id)] = {
                    badge: r.badge_club ? String(r.badge_club) : '',
                    username: r.username ? String(r.username) : ''
                };
            });
        } catch (e) { console.error('[ZELO] fetchBadges error:', e); }
    }
    const handleOf = userId => {
        const id = String(userId || '');
        if (id === me().id) return US().username || (profMap[id] && profMap[id].username) || '';
        return (profMap[id] && profMap[id].username) || '';
    };
    const badgeHtml = (userId, size = 15) => {
        if (typeof window.zeloVerifiedBadge !== 'function') return '';
        const id = String(userId || '');
        const theirs = (profMap[id] && profMap[id].badge) || '';
        const club = id === me().id ? (US().badgeClub || US().badge_club || theirs) : theirs;
        return window.zeloVerifiedBadge(club, size);
    };

    // ===== المتابَعون والكتم والحظر والمنشورات المخفية =====
    let followSet = new Set();
    let muteSet = new Set();
    let blockSet = new Set();
    const hiddenKey = 'zelo_hidden_posts';
    const hiddenPosts = (() => {
        try { return new Set(JSON.parse(localStorage.getItem(hiddenKey) || '[]').map(String)); }
        catch (e) { return new Set(); }
    })();
    const saveHidden = () => {
        try { localStorage.setItem(hiddenKey, JSON.stringify([...hiddenPosts].slice(-500))); } catch (e) {}
    };
    const isHiddenUser = uid => muteSet.has(String(uid)) || blockSet.has(String(uid));

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

        /* رأس المنشور على طريقة X */
        .post-sub { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; color: #7a7f9a; font-size: 0.7rem; font-weight: 700; margin-top: 2px; }
        .post-handle { color: #7a7f9a; font-size: 0.72rem; font-weight: 700; direction: ltr; unicode-bidi: plaintext; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dots-btn { background: none; border: none; color: #94a3b8; font-size: 1.25rem; cursor: pointer; padding: 2px 8px; border-radius: 50%; line-height: 1; }
        .dots-btn:active { background: rgba(255,255,255,0.1); }

        /* الردود المتداخلة */
        .cm-head { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .cm-head .dots-btn { margin-inline-start: auto; font-size: 1.05rem; padding: 0 6px; }
        .cm-children { margin-inline-start: 16px; border-inline-start: 2px solid rgba(255,255,255,0.08); padding-inline-start: 8px; }
        .cm-replying { color: #7a7f9a; font-size: 0.68rem; font-weight: 700; margin-top: 2px; }
        .cm-replying span { color: #1d9bf0; direction: ltr; unicode-bidi: plaintext; }
        .cm-actions .cm-act { display: flex; align-items: center; gap: 4px; color: #94a3b8; font-size: 0.74rem; font-weight: 800; padding: 2px 4px; }
        .cm-actions .cm-act.liked { color: #f91880; }

        /* القائمة السفلية (⋮) */
        .sheet-overlay { position: fixed; inset: 0; z-index: 4000; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; animation: zhFade 0.18s ease-out; }
        .sheet { width: 100%; max-height: 82vh; overflow-y: auto; background: #17171c; border-radius: 20px 20px 0 0; padding: 8px 8px calc(14px + env(safe-area-inset-bottom, 0px)); animation: zhUp 0.22s ease-out; }
        .sheet-grip { width: 42px; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.25); margin: 6px auto 10px; }
        .sheet-title { color: #94a3b8; font-size: 0.8rem; font-weight: 800; padding: 4px 14px 10px; }
        .sheet-item { width: 100%; display: flex; align-items: center; gap: 14px; background: none; border: none; color: #e7e9ea; font-size: 0.95rem; font-weight: 700; padding: 14px 12px; border-radius: 12px; cursor: pointer; text-align: start; font-family: inherit; }
        .sheet-item:active { background: rgba(255,255,255,0.08); }
        .sheet-item .si-ic { width: 26px; text-align: center; font-size: 1.2rem; }
        .sheet-item.danger { color: #f4212e; }
        .sheet-sep { height: 1px; background: rgba(255,255,255,0.1); margin: 6px 8px; }
        .sheet-stat { display: flex; justify-content: space-between; padding: 14px; color: #e7e9ea; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .zh-toast { position: fixed; left: 50%; bottom: 110px; transform: translateX(-50%); z-index: 5000; background: #1d9bf0; color: #fff; padding: 10px 16px; border-radius: 12px; font-weight: 800; font-size: 0.85rem; display: flex; gap: 12px; align-items: center; max-width: 90vw; }
        .zh-toast button { background: none; border: none; color: #fff; font-weight: 900; text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
        .post-actions .act-btn { padding: 6px 5px; gap: 4px; font-size: 0.8rem; }
        .post-actions .act-btn.saved { color: #1d9bf0; background: rgba(29,155,240,0.12); }
        @keyframes zhUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes zhFade { from { opacity: 0; } to { opacity: 1; } }
    `;

    const emptyBox = msg => `<div class="empty-box">${msg}</div>`;

    // وحدة الزمن بالعربية: 1 مفرد، 2 مثنى، 3-10 جمع، 11+ تمييز مفرد
    function arUnit(n, one, two, few) {
        if (n === 1) return one;
        if (n === 2) return two;
        if (n <= 10) return `${n} ${few}`;
        return `${n} ${one}`;
    }

    // الآن · منذ دقيقة · منذ 5 دقائق · منذ ساعة · منذ يومين · ثم التاريخ
    function timeAgo(iso) {
        const t = new Date(iso).getTime();
        if (!t) return '';
        const diff = Math.floor((Date.now() - t) / 1000);
        const ar = isAr();
        if (diff < 60) return ar ? 'الآن' : 'now';
        const m = Math.floor(diff / 60);
        if (m < 60) return ar ? `منذ ${arUnit(m, 'دقيقة', 'دقيقتين', 'دقائق')}` : `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return ar ? `منذ ${arUnit(h, 'ساعة', 'ساعتين', 'ساعات')}` : `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
        const d = Math.floor(h / 24);
        if (d < 7) return ar ? `منذ ${arUnit(d, 'يوم', 'يومين', 'أيام')}` : `${d} ${d === 1 ? 'day' : 'days'} ago`;
        const dt = new Date(t);
        const sameYear = dt.getFullYear() === new Date().getFullYear();
        try {
            return dt.toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en',
                sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return dt.toDateString(); }
    }

    function fullDate(iso) {
        try { return new Date(iso).toLocaleString(isAr() ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium', timeStyle: 'short' }); }
        catch (e) { return ''; }
    }

    // عنصر وقت يتحدّث تلقائياً كل نصف دقيقة، والتاريخ الكامل يظهر عند الضغط المطوّل
    function timeHtml(iso) {
        return `<span class="js-time" data-t="${esc(iso)}" title="${esc(fullDate(iso))}">${esc(timeAgo(iso))}</span>`;
    }

    let timeTimer = null;
    function refreshTimes() {
        document.querySelectorAll('.js-time[data-t]').forEach(el => { el.textContent = timeAgo(el.dataset.t); });
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
            <span class="act-btn" style="cursor:default;">
                <span class="ic">📊</span><span class="cnt">${p.views || 0}</span>
            </span>
            <button class="act-btn bm-btn ${p.saved ? 'saved' : ''}" onclick="window.toggleBookmark(${p.id})" style="opacity:${p.saved ? 1 : 0.6};">
                <span class="ic">🔖</span>
            </button>
            <button class="act-btn" onclick="window.sharePost(${p.id})">
                <span class="ic">📤</span>
            </button>
        `;
    }

    function postHtml(p) {
        const edited = p.updated_at && p.created_at && p.updated_at !== p.created_at;
        const handle = handleOf(p.user_id);
        return `
            <div class="post-card" id="post-${p.id}" data-uid="${esc(p.user_id)}">
                <div class="post-head">
                    <img class="post-avatar" style="cursor:pointer" onclick="window.openUserProfile('${esc(p.user_id)}')" src="${esc(avatarUrl(p.author_name, p.author_avatar))}" onerror="this.style.display='none'">
                    <div class="post-meta">
                        <div class="post-author">${esc(p.author_name)}${badgeHtml(p.user_id)}</div>
                        <div class="post-sub">
                            ${handle ? `<span class="post-handle">@${esc(handle)}</span><span>·</span>` : ''}
                            ${timeHtml(p.created_at)}
                            ${edited ? `<span>· ${isAr() ? 'معدّل' : 'edited'}</span>` : ''}
                        </div>
                    </div>
                    <button class="dots-btn" onclick="window.openPostMenu(${p.id})" aria-label="more">⋮</button>
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

    // قوائم المتابعة والكتم والحظر الخاصة بي
    async function loadSocial() {
        const c = db();
        const uid = me().id;
        if (!c || !uid) return;
        try {
            const [f, m, b] = await Promise.all([
                c.from('user_follows').select('following_id').eq('follower_id', uid),
                c.from('user_mutes').select('muted_id').eq('user_id', uid),
                c.from('user_blocks').select('blocked_id').eq('user_id', uid)
            ]);
            followSet = new Set((f.data || []).map(r => String(r.following_id)));
            muteSet = new Set((m.data || []).map(r => String(r.muted_id)));
            blockSet = new Set((b.data || []).map(r => String(r.blocked_id)));
        } catch (e) { console.error('[ZELO] loadSocial error:', e); }
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

        await loadSocial();
        const visible = posts.filter(p => !isHiddenUser(p.user_id) && !hiddenPosts.has(String(p.id)));
        if (!visible.length) {
            list.innerHTML = emptyBox(isAr() ? 'لا توجد منشورات لعرضها الآن.' : 'No posts to show right now.');
            return;
        }

        const ids = visible.map(p => p.id);
        const [likesRes, cmRes, rpRes, vwRes, bmRes] = await Promise.all([
            c.from('post_likes').select('post_id,user_id').in('post_id', ids),
            c.from('post_comments').select('post_id').in('post_id', ids),
            c.from('post_reposts').select('post_id,user_id').in('post_id', ids),
            c.from('post_views').select('post_id,user_id').in('post_id', ids),
            c.from('post_bookmarks').select('post_id').eq('user_id', me().id).in('post_id', ids)
        ]);
        const likes = likesRes.data || [];
        const cms = cmRes.data || [];
        const reps = rpRes.data || [];
        const views = vwRes.data || [];
        const marks = new Set((bmRes.data || []).map(r => String(r.post_id)));

        visible.forEach(p => {
            postCache[p.id] = {
                ...p,
                likes: likes.filter(l => String(l.post_id) === String(p.id)).length,
                liked: likes.some(l => String(l.post_id) === String(p.id) && String(l.user_id) === me().id),
                comments: cms.filter(x => String(x.post_id) === String(p.id)).length,
                reposts: reps.filter(r => String(r.post_id) === String(p.id)).length,
                reposted: reps.some(r => String(r.post_id) === String(p.id) && String(r.user_id) === me().id),
                views: views.filter(v => String(v.post_id) === String(p.id)).length,
                viewedByMe: views.some(v => String(v.post_id) === String(p.id) && String(v.user_id) === me().id),
                saved: marks.has(String(p.id))
            };
        });

        await fetchBadges(visible.map(p => p.user_id));
        list.innerHTML = visible.map(p => postHtml(postCache[p.id])).join('');
        observeViews();
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

    // ===== المشاهدات: تُسجَّل مرة واحدة لكل مستخدم عند ظهور المنشور على الشاشة =====
    let viewObserver = null;
    const viewedSession = new Set();

    async function recordView(id) {
        const p = postCache[id];
        const c = db();
        const uid = me().id;
        if (!p || !c || !uid || viewedSession.has(String(id))) return;
        viewedSession.add(String(id));
        if (p.viewedByMe) return;
        const { error } = await c.from('post_views').upsert(
            [{ post_id: Number(id), user_id: uid }],
            { onConflict: 'post_id,user_id', ignoreDuplicates: true });
        if (error) { console.error('[ZELO] recordView error:', error); return; }
        p.viewedByMe = true;
        p.views = (p.views || 0) + 1;
        updatePostUI(id);
    }

    function observeViews() {
        if (viewObserver) { viewObserver.disconnect(); viewObserver = null; }
        if (!('IntersectionObserver' in window)) return;
        viewObserver = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                viewObserver.unobserve(en.target);
                recordView(en.target.id.replace('post-', ''));
            });
        }, { threshold: 0.6 });
        document.querySelectorAll('.post-card').forEach(el => viewObserver.observe(el));
    }

    // ===== حفظ المنشور (إشارة مرجعية) =====
    window.toggleBookmark = async function(id) {
        const c = db();
        const p = postCache[id];
        if (!c || !p) return;
        const uid = me().id;
        if (p.saved) {
            const { error } = await c.from('post_bookmarks').delete().eq('post_id', id).eq('user_id', uid);
            if (error) { alert(error.message); return; }
            p.saved = false;
            toast(isAr() ? 'أُزيل من المحفوظات' : 'Removed from bookmarks');
        } else {
            const { error } = await c.from('post_bookmarks').insert([{ post_id: id, user_id: uid }]);
            if (error && error.code !== '23505') { alert(error.message); return; }
            p.saved = true;
            toast(isAr() ? 'تم حفظ المنشور 🔖' : 'Post saved 🔖');
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

    // ===================== التعليقات والردود المتداخلة =====================
    const cmCache = {};

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

    // أزرار الرد: رد على الرد + إعجاب بالرد
    function cmActionsHtml(postId, cm) {
        return `
            <button class="cm-act" onclick="window.openReply(${postId}, ${cm.id})">
                <span>💬</span><span>${cm.replies || 0}</span>
            </button>
            <button class="cm-act ${cm.liked ? 'liked' : ''}" onclick="window.toggleCommentLike(${cm.id})">
                <span>${cm.liked ? '❤️' : '🤍'}</span><span>${cm.likes || 0}</span>
            </button>
        `;
    }

    // الردود تتداخل بصرياً حتى مستويين، وما بعدها يُعرض بنفس المستوى
    function commentHtml(postId, cm, depth) {
        const handle = handleOf(cm.user_id);
        const parent = cm.parent_id != null ? cmCache[cm.parent_id] : null;
        const replyingTo = parent ? (handleOf(parent.user_id) || parent.author_name || '') : '';
        const kids = (cm.children || []).map(k => commentHtml(postId, k, depth + 1)).join('');
        return `
            <div class="cm-thread" id="cmt-${cm.id}">
                <div class="cm" id="cm-${cm.id}" data-uid="${esc(cm.user_id)}">
                    <img class="cm-avatar" style="cursor:pointer" onclick="window.openUserProfile('${esc(cm.user_id)}')" src="${esc(avatarUrl(cm.author_name, cm.author_avatar))}" onerror="this.style.display='none'">
                    <div class="cm-body">
                        <div class="cm-head">
                            <span class="cm-name">${esc(cm.author_name)}${badgeHtml(cm.user_id, 13)}</span>
                            ${handle ? `<span class="post-handle">@${esc(handle)}</span>` : ''}
                            <span class="cm-time">· ${timeHtml(cm.created_at)}</span>
                            <button class="dots-btn" onclick="window.openCommentMenu(${postId}, ${cm.id})" aria-label="more">⋮</button>
                        </div>
                        ${(replyingTo && depth > 0) ? `<div class="cm-replying">${isAr() ? 'ردًا على' : 'Replying to'} <span>@${esc(replyingTo)}</span></div>` : ''}
                        ${commentContentHtml(cm)}
                        <div class="cm-actions" id="cm-actions-${cm.id}">${cmActionsHtml(postId, cm)}</div>
                    </div>
                </div>
                ${depth < 2 ? (kids ? `<div class="cm-children">${kids}</div>` : '') : kids}
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

        // العدد الحقيقي لكل الردود (بما فيها المتداخلة)
        if (postCache[id]) { postCache[id].comments = (data || []).length; updatePostUI(id); }

        const rows = (data || []).filter(cm => !isHiddenUser(cm.user_id));
        if (!rows.length) {
            list.innerHTML = `<div class="cm-empty">${isAr() ? 'لا توجد تعليقات بعد' : 'No comments yet'}</div>`;
            return;
        }

        // إعجابات الردود
        const likeRes = await c.from('comment_likes').select('comment_id,user_id').in('comment_id', rows.map(r => r.id));
        const likes = likeRes.data || [];

        const byId = {};
        rows.forEach(cm => {
            cm.likes = likes.filter(l => String(l.comment_id) === String(cm.id)).length;
            cm.liked = likes.some(l => String(l.comment_id) === String(cm.id) && String(l.user_id) === me().id);
            cm.children = [];
            cm.replies = 0;
            byId[cm.id] = cm;
            cmCache[cm.id] = cm;
        });

        // بناء الشجرة: الرد اليتيم (أبوه محذوف أو مخفي) يُعرض كرد رئيسي
        const roots = [];
        rows.forEach(cm => {
            const parent = cm.parent_id != null ? byId[cm.parent_id] : null;
            if (parent) { parent.children.push(cm); parent.replies++; }
            else roots.push(cm);
        });

        await fetchBadges(rows.map(cm => cm.user_id));
        list.innerHTML = roots.map(cm => commentHtml(id, cm, 0)).join('');
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

    window.toggleCommentLike = async function(cid) {
        const c = db();
        const cm = cmCache[cid];
        if (!c || !cm) return;
        const uid = me().id;

        if (cm.liked) {
            const { error } = await c.from('comment_likes').delete().eq('comment_id', cid).eq('user_id', uid);
            if (error) { alert(error.message); return; }
            cm.liked = false;
            cm.likes = Math.max(0, (cm.likes || 0) - 1);
        } else {
            const { error } = await c.from('comment_likes').insert([{ comment_id: cid, user_id: uid }]);
            if (error && error.code !== '23505') { alert(error.message); return; }
            cm.liked = true;
            cm.likes = (cm.likes || 0) + 1;
        }
        const box = document.getElementById(`cm-actions-${cid}`);
        if (box) box.innerHTML = cmActionsHtml(cm.post_id, cm);
    };

    window.deleteComment = async function(postId, commentId) {
        if (!confirm(isAr() ? 'هل تريد حذف هذا الرد؟' : 'Delete this reply?')) return;
        const { error } = await db().from('post_comments').delete().eq('id', commentId).eq('user_id', me().id);
        if (error) { alert(error.message); return; }
        await loadComments(postId);
    };

    // ===================== نافذة الرد (مثل X) =====================
    let replyImage = '';
    let replyTargetId = null;
    let replyParentId = null;

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

    // الرد على منشور (parentId فارغ) أو على رد آخر (parentId = رقم الرد)
    window.openReply = function(id, parentId) {
        const p = postCache[id];
        if (!p || document.getElementById('reply-overlay')) return;
        replyImage = '';
        replyTargetId = id;
        replyParentId = parentId || null;
        const target = parentId ? cmCache[parentId] : p;
        const targetName = target ? (handleOf(target.user_id) || target.author_name || '') : '';
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
                ${isAr() ? 'ردا على' : 'Replying to'} <span style="color:#1d9bf0; direction:ltr; unicode-bidi:plaintext;">@${esc(targetName)}</span>
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
        replyParentId = null;
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
        if (replyParentId) row.parent_id = replyParentId;
        if (image) row.image_url = image;

        const { error } = await c.from('post_comments').insert([row]);
        if (error) {
            alert((isAr() ? 'فشل إرسال الرد: ' : 'Reply failed: ') + error.message +
                (isAr() ? '\n(تأكد من تشغيل أوامر SQL المحدّثة)' : '\n(make sure the updated SQL has been run)'));
            return;
        }

        window.closeReply();
        const box = document.getElementById(`comments-${id}`);
        if (box && box.style.display === 'none') {
            await window.toggleComments(id);       // افتح الردود ليرى المستخدم ردّه
        } else if (box) {
            await loadComments(id);
        } else if (postCache[id]) {
            postCache[id].comments = (postCache[id].comments || 0) + 1;
            updatePostUI(id);
        }
    };

    // ===================== القوائم السفلية (⋮) على طريقة X =====================
    function toast(msg, undoFn) {
        document.getElementById('zh-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'zh-toast';
        el.className = 'zh-toast';
        el.innerHTML = `<span>${esc(msg)}</span>`;
        if (undoFn) {
            const b = document.createElement('button');
            b.textContent = isAr() ? 'تراجع' : 'Undo';
            b.onclick = () => { el.remove(); undoFn(); };
            el.appendChild(b);
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), undoFn ? 6000 : 2500);
    }

    window.closeSheet = function() { document.getElementById('sheet-overlay')?.remove(); };

    // items: { icon, label, danger, action } أو 'sep' أو { stat, label, value }
    function openSheet(items, title) {
        window.closeSheet();
        const ov = document.createElement('div');
        ov.id = 'sheet-overlay';
        ov.className = 'sheet-overlay';
        ov.addEventListener('click', e => { if (e.target === ov) window.closeSheet(); });
        const sheet = document.createElement('div');
        sheet.className = 'sheet';
        sheet.dir = isAr() ? 'rtl' : 'ltr';
        sheet.innerHTML = '<div class="sheet-grip"></div>' + (title ? `<div class="sheet-title">${esc(title)}</div>` : '');
        items.forEach(it => {
            if (it === 'sep') { sheet.insertAdjacentHTML('beforeend', '<div class="sheet-sep"></div>'); return; }
            if (it.stat) {
                sheet.insertAdjacentHTML('beforeend', `<div class="sheet-stat"><span>${esc(it.label)}</span><span>${esc(String(it.value))}</span></div>`);
                return;
            }
            const b = document.createElement('button');
            b.className = 'sheet-item' + (it.danger ? ' danger' : '');
            b.innerHTML = `<span class="si-ic">${it.icon}</span><span>${esc(it.label)}</span>`;
            b.onclick = () => { window.closeSheet(); if (it.action) it.action(); };
            sheet.appendChild(b);
        });
        ov.appendChild(sheet);
        document.body.appendChild(ov);
    }

    async function toggleFollow(uid) {
        const c = db();
        const mine = me().id;
        uid = String(uid);
        if (!c || !mine || uid === mine) return;
        if (followSet.has(uid)) {
            const { error } = await c.from('user_follows').delete().eq('follower_id', mine).eq('following_id', uid);
            if (error) { alert(error.message); return; }
            followSet.delete(uid);
            toast(isAr() ? 'تم إلغاء المتابعة' : 'Unfollowed');
        } else {
            const { error } = await c.from('user_follows').insert([{ follower_id: mine, following_id: uid }]);
            if (error && error.code !== '23505') { alert(error.message); return; }
            followSet.add(uid);
            toast(isAr() ? 'تمت المتابعة ✅' : 'Following ✅');
        }
    }

    // يُخفي محتوى مستخدم من الصفحة الحالية فوراً
    function hideUserContent(uid) {
        document.querySelectorAll('.post-card').forEach(el => { if (el.dataset.uid === String(uid)) el.remove(); });
        document.querySelectorAll('.comments-box').forEach(box => {
            if (box.style.display !== 'none') loadComments(box.id.replace('comments-', ''));
        });
        if (!document.querySelector('.post-card')) loadFeed();
    }

    async function muteUser(uid) {
        const c = db();
        const mine = me().id;
        uid = String(uid);
        if (!c || !mine || uid === mine) return;
        const { error } = await c.from('user_mutes').insert([{ user_id: mine, muted_id: uid }]);
        if (error && error.code !== '23505') { alert(error.message); return; }
        muteSet.add(uid);
        hideUserContent(uid);
        toast(isAr() ? 'تم الكتم' : 'Muted', async () => {
            await c.from('user_mutes').delete().eq('user_id', mine).eq('muted_id', uid);
            muteSet.delete(uid);
            loadFeed();
        });
    }

    async function blockUser(uid, tag) {
        const c = db();
        const mine = me().id;
        uid = String(uid);
        if (!c || !mine || uid === mine) return;
        const msg = isAr() ? `هل تريد حظر ${tag}؟ لن ترى منشوراته وردوده.` : `Block ${tag}? You won't see their posts or replies.`;
        if (!confirm(msg)) return;
        const { error } = await c.from('user_blocks').insert([{ user_id: mine, blocked_id: uid }]);
        if (error && error.code !== '23505') { alert(error.message); return; }
        await c.from('user_follows').delete().eq('follower_id', mine).eq('following_id', uid);
        followSet.delete(uid);
        blockSet.add(uid);
        hideUserContent(uid);
        toast(isAr() ? 'تم الحظر' : 'Blocked', async () => {
            await c.from('user_blocks').delete().eq('user_id', mine).eq('blocked_id', uid);
            blockSet.delete(uid);
            loadFeed();
        });
    }

    function notInterested(id) {
        hiddenPosts.add(String(id));
        saveHidden();
        document.getElementById(`post-${id}`)?.remove();
        toast(isAr() ? 'تم إخفاء المنشور' : 'Post hidden', () => {
            hiddenPosts.delete(String(id));
            saveHidden();
            loadFeed();
        });
        if (!document.querySelector('.post-card')) loadFeed();
    }

    function openReport(type, id) {
        const reasons = [
            ['spam',     '📢', 'محتوى مزعج أو إعلاني',      'Spam'],
            ['abuse',    '😡', 'إساءة أو تحرّش',            'Abuse or harassment'],
            ['hate',     '⚠️', 'خطاب كراهية',               'Hateful content'],
            ['violence', '🩸', 'عنف أو محتوى صادم',         'Violent or graphic content'],
            ['adult',    '🔞', 'محتوى للبالغين',            'Adult content'],
            ['misinfo',  '❓', 'معلومات مضللة',             'Misinformation'],
            ['other',    '…',  'سبب آخر',                   'Something else']
        ];
        openSheet(
            reasons.map(r => ({ icon: r[1], label: isAr() ? r[2] : r[3], action: () => submitReport(type, id, r[0]) })),
            isAr() ? 'ما سبب البلاغ؟' : 'Why are you reporting this?'
        );
    }

    async function submitReport(type, id, reason) {
        const c = db();
        if (!c) return;
        const { error } = await c.from('post_reports').insert([{ reporter_id: me().id, target_type: type, target_id: id, reason: reason }]);
        if (error && error.code !== '23505') { alert(error.message); return; }
        toast(isAr() ? 'تم استلام بلاغك، شكرًا لك' : 'Report received. Thank you');
    }

    function showEngagements(id) {
        const p = postCache[id];
        if (!p) return;
        openSheet([
            { stat: true, label: isAr() ? 'المشاهدات' : 'Views', value: p.views || 0 },
            { stat: true, label: isAr() ? 'الإعجابات' : 'Likes', value: p.likes || 0 },
            { stat: true, label: isAr() ? 'إعادة النشر' : 'Reposts', value: p.reposts || 0 },
            { stat: true, label: isAr() ? 'الردود' : 'Replies', value: p.comments || 0 }
        ], isAr() ? 'التفاعلات مع المنشور' : 'Post engagements');
    }

    // عناصر المتابعة والكتم والحظر المشتركة بين المنشور والرد
    function userActionItems(uid, handle, name) {
        const tag = handle ? `@${handle}` : (name || '');
        const followed = followSet.has(String(uid));
        return [
            {
                icon: followed ? '➖' : '➕',
                label: followed ? (isAr() ? `إلغاء متابعة ${tag}` : `Unfollow ${tag}`) : (isAr() ? `تابِع ${tag}` : `Follow ${tag}`),
                action: () => toggleFollow(uid)
            },
            { icon: '🔇', label: isAr() ? `كتم ${tag}` : `Mute ${tag}`, action: () => muteUser(uid) },
            { icon: '🚫', label: isAr() ? `حظر ${tag}` : `Block ${tag}`, action: () => blockUser(uid, tag) }
        ];
    }

    window.openPostMenu = function(id) {
        const p = postCache[id];
        if (!p) return;
        const mine = String(p.user_id) === me().id;
        const common = [
            { icon: '📊', label: isAr() ? 'عرض التفاعلات مع المنشور' : 'View post engagements', action: () => showEngagements(id) },
            { icon: '🔖', label: postCache[id].saved ? (isAr() ? 'إزالة من المحفوظات' : 'Remove bookmark') : (isAr() ? 'حفظ المنشور' : 'Save post'), action: () => window.toggleBookmark(id) },
            { icon: '🔗', label: isAr() ? 'نسخ رابط المنشور' : 'Copy post link', action: () => window.sharePost(id) }
        ];
        if (mine) {
            openSheet([
                { icon: '✏️', label: isAr() ? 'تعديل المنشور' : 'Edit post', action: () => window.startEditPost(id) },
                { icon: '🗑️', label: isAr() ? 'حذف المنشور' : 'Delete post', danger: true, action: () => window.deletePost(id) },
                'sep',
                ...common
            ]);
            return;
        }
        openSheet([
            { icon: '😕', label: isAr() ? 'لست مهتمًا بهذا المنشور' : 'Not interested in this post', action: () => notInterested(id) },
            'sep',
            ...userActionItems(p.user_id, handleOf(p.user_id), p.author_name),
            'sep',
            { icon: '🚩', label: isAr() ? 'الإبلاغ عن المنشور' : 'Report post', action: () => openReport('post', id) },
            'sep',
            ...common
        ]);
    };

    window.openCommentMenu = function(postId, cid) {
        const cm = cmCache[cid];
        if (!cm) return;
        const mine = String(cm.user_id) === me().id;
        if (mine) {
            openSheet([
                { icon: '🗑️', label: isAr() ? 'حذف الرد' : 'Delete reply', danger: true, action: () => window.deleteComment(postId, cid) }
            ]);
            return;
        }
        openSheet([
            ...userActionItems(cm.user_id, handleOf(cm.user_id), cm.author_name),
            'sep',
            { icon: '🚩', label: isAr() ? 'الإبلاغ عن الرد' : 'Report reply', action: () => openReport('comment', cid) }
        ]);
    };

    // ===================== بطاقة الملف الشخصي (مثل X) =====================
    (function () {
        if (document.getElementById('zelo-pc-css')) return;
        const s = document.createElement('style');
        s.id = 'zelo-pc-css';
        s.textContent = `
        .pc-overlay { position: fixed; inset: 0; z-index: 4500; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; animation: zhFade 0.18s ease-out; }
        .pc-sheet { width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; background: #0c0e20; border-radius: 20px 20px 0 0; border: 1px solid rgba(255,255,255,0.08); position: relative; }
        .pc-cover { height: 90px; background: linear-gradient(135deg, #00FF87, #14B8A6 60%, #0c0e20); border-radius: 20px 20px 0 0; }
        .pc-close { position: absolute; top: 10px; inset-inline-start: 12px; width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(0,0,0,0.55); color: #fff; font-weight: 900; cursor: pointer; }
        .pc-top { display: flex; justify-content: space-between; align-items: flex-end; padding: 0 16px; margin-top: -36px; }
        .pc-avatar { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; border: 4px solid #0c0e20; background: #0c0e20; }
        .pc-btns { display: flex; gap: 8px; padding-bottom: 4px; }
        .pc-btn { border: 1px solid rgba(255,255,255,0.25); background: transparent; color: #fff; padding: 8px 16px; border-radius: 999px; font-weight: 900; font-size: 0.85rem; cursor: pointer; }
        .pc-btn.main { background: #fff; color: #000; border: none; }
        .pc-btn.on { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.25); }
        .pc-info { padding: 10px 16px 0; }
        .pc-name { color: #fff; font-weight: 900; font-size: 1.15rem; display: flex; align-items: center; gap: 4px; }
        .pc-handle { color: #7a7f9a; font-size: 0.85rem; direction: ltr; text-align: start; }
        .pc-stats { display: flex; gap: 18px; padding: 12px 16px; color: #94a3b8; font-size: 0.85rem; }
        .pc-stats b { color: #fff; font-weight: 900; }
        .pc-tab { padding: 10px 16px; color: #fff; font-weight: 900; border-bottom: 3px solid #1d9bf0; display: inline-block; margin-inline-start: 16px; }
        .pc-posts { border-top: 1px solid rgba(255,255,255,0.08); }
        .pc-post { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #e2e8f0; font-size: 0.86rem; line-height: 1.6; word-break: break-word; }
        .pc-post .t { color: #7a7f9a; font-size: 0.68rem; font-weight: 700; margin-bottom: 4px; }
        .pc-post img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 12px; margin-top: 8px; }
        .pc-empty { padding: 24px; text-align: center; color: #7a7f9a; font-weight: 700; }`;
        document.head.appendChild(s);
    })();

    window.closeUserProfile = function () {
        const o = document.getElementById('pc-overlay');
        if (o) o.remove();
    };

    window.openUserProfile = async function (uid) {
        uid = String(uid || '');
        const c = db();
        if (!c || !uid) return;
        window.closeUserProfile();

        // الاسم والصورة من المنشورات أو الردود المحمّلة
        const src = Object.values(postCache).find(p => String(p.user_id) === uid)
                 || Object.values(cmCache).find(m => String(m.user_id) === uid) || {};
        const isMe = uid === me().id;
        const name = isMe ? me().name : (src.author_name || '');
        const avatar = isMe ? me().avatar : (src.author_avatar || '');

        const ov = document.createElement('div');
        ov.id = 'pc-overlay';
        ov.className = 'pc-overlay';
        ov.onclick = e => { if (e.target === ov) window.closeUserProfile(); };
        ov.innerHTML = `<div class="pc-sheet"><div class="pc-empty">${isAr() ? 'جارٍ التحميل...' : 'Loading...'}</div></div>`;
        document.body.appendChild(ov);

        const count = (table, col) =>
            c.from(table).select('*', { count: 'exact', head: true }).eq(col, uid);
        const [, followers, following, postsCount, postsRes] = await Promise.all([
            fetchBadges([uid]),
            count('user_follows', 'following_id'),
            count('user_follows', 'follower_id'),
            count('posts', 'user_id'),
            c.from('posts').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(10)
        ]);

        const handle = handleOf(uid);
        const followed = followSet.has(uid);
        const posts = postsRes.data || [];
        const nf = followers.count || 0;

        const buttons = isMe ? '' : `
            <button class="pc-btn" id="pc-msg">${isAr() ? 'رسالة' : 'Message'}</button>
            <button class="pc-btn ${followed ? 'on' : 'main'}" id="pc-follow">${followed ? (isAr() ? 'متابَع' : 'Following') : (isAr() ? 'متابعة' : 'Follow')}</button>`;

        ov.firstElementChild.innerHTML = `
            <div class="pc-cover"></div>
            <button class="pc-close" onclick="window.closeUserProfile()">✕</button>
            <div class="pc-top">
                <img class="pc-avatar" src="${esc(avatarUrl(name, avatar))}" onerror="this.style.display='none'">
                <div class="pc-btns">${buttons}</div>
            </div>
            <div class="pc-info">
                <div class="pc-name">${esc(name)}${badgeHtml(uid, 18)}</div>
                ${handle ? `<div class="pc-handle">@${esc(handle)}</div>` : ''}
            </div>
            <div class="pc-stats">
                <span><b id="pc-nfollowers">${nf}</b> ${isAr() ? 'متابِع' : 'Followers'}</span>
                <span><b>${following.count || 0}</b> ${isAr() ? 'يتابِع' : 'Following'}</span>
                <span><b>${postsCount.count || 0}</b> ${isAr() ? 'منشور' : 'Posts'}</span>
            </div>
            <div class="pc-tab">${isAr() ? 'المنشورات' : 'Posts'}</div>
            <div class="pc-posts">
                ${posts.length ? posts.map(p => `
                    <div class="pc-post">
                        <div class="t">${timeHtml(p.created_at)}</div>
                        ${esc(p.content)}
                        ${p.image_url ? `<img src="${esc(p.image_url)}" onerror="this.style.display='none'">` : ''}
                    </div>`).join('') : `<div class="pc-empty">${isAr() ? 'لا توجد منشورات' : 'No posts yet'}</div>`}
            </div>`;

        const fb = document.getElementById('pc-follow');
        if (fb) fb.onclick = async () => {
            const was = followSet.has(uid);
            await toggleFollow(uid);
            const now = followSet.has(uid);
            if (now === was) return;
            fb.className = 'pc-btn ' + (now ? 'on' : 'main');
            fb.textContent = now ? (isAr() ? 'متابَع' : 'Following') : (isAr() ? 'متابعة' : 'Follow');
            const el = document.getElementById('pc-nfollowers');
            if (el) el.textContent = Math.max(0, (parseInt(el.textContent, 10) || 0) + (now ? 1 : -1));
        };
        const mb = document.getElementById('pc-msg');
        if (mb) mb.onclick = () => {
            // اربطه بنظام الرسائل عندك
            if (typeof window.openChat === 'function') { window.closeUserProfile(); window.openChat(uid); }
            else alert(isAr() ? 'نظام الرسائل غير مربوط بعد' : 'Messaging is not linked yet');
        };
    };

    // ===================== زر النشر العائم (مثل X) =====================
    let fabObserver = null;

    function removeFab() {
        document.getElementById('fab-compose')?.remove();
        document.getElementById('compose-overlay')?.remove();
        document.getElementById('reply-overlay')?.remove();
        if (fabObserver) { fabObserver.disconnect(); fabObserver = null; }
        if (timeTimer) { clearInterval(timeTimer); timeTimer = null; }
        if (viewObserver) { viewObserver.disconnect(); viewObserver = null; }
        teardownPullToRefresh();
        document.getElementById('sheet-overlay')?.remove();
        document.getElementById('zh-toast')?.remove();
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

    // ===================== السحب للأسفل للتحديث =====================
    let ptrCleanup = null;

    function teardownPullToRefresh() {
        if (ptrCleanup) { ptrCleanup(); ptrCleanup = null; }
    }

    function setupPullToRefresh() {
        teardownPullToRefresh();

        const main = document.getElementById('main-content');
        const scrollTop = () => Math.max(
            window.scrollY || 0,
            document.documentElement.scrollTop || 0,
            main ? main.scrollTop : 0
        );
        const overlayOpen = () => !!document.querySelector('#compose-overlay, #reply-overlay, #sheet-overlay, #zdrawer.open');

        const ind = document.createElement('div');
        ind.id = 'ptr-indicator';
        ind.style.cssText = 'position:fixed; top:70px; left:50%; width:40px; height:40px; margin-left:-20px; z-index:1400;' +
            'border-radius:50%; background:#1d9bf0; color:#fff; display:flex; align-items:center; justify-content:center;' +
            'font-size:1.2rem; font-weight:900; box-shadow:0 4px 14px rgba(29,155,240,0.5); opacity:0; pointer-events:none;' +
            'transform:translateY(-60px); transition:transform 0.2s, opacity 0.2s;';
        ind.textContent = '↓';
        document.body.appendChild(ind);

        const THRESHOLD = 70;
        let startY = 0, dist = 0, tracking = false, busy = false;

        const show = (d, ready) => {
            ind.style.transition = 'none';
            ind.style.opacity = String(Math.min(1, d / 40));
            ind.style.transform = `translateY(${d - 60}px) rotate(${ready ? 180 : 0}deg)`;
        };
        const hide = () => {
            ind.style.transition = 'transform 0.2s, opacity 0.2s';
            ind.style.opacity = '0';
            ind.style.transform = 'translateY(-60px)';
        };

        const onStart = e => {
            if (busy || overlayOpen() || !document.getElementById('feed-list')) return;
            if (scrollTop() > 0 || e.touches.length !== 1) return;
            startY = e.touches[0].clientY;
            dist = 0;
            tracking = true;
        };
        const onMove = e => {
            if (!tracking) return;
            const dy = e.touches[0].clientY - startY;
            if (dy <= 0 || scrollTop() > 0) { dist = 0; hide(); return; }
            dist = Math.min(dy * 0.5, 110);
            show(dist, dist >= THRESHOLD);
        };
        const onEnd = async () => {
            if (!tracking) return;
            tracking = false;
            if (dist >= THRESHOLD && !busy) {
                busy = true;
                ind.style.transition = 'transform 0.2s';
                ind.style.opacity = '1';
                ind.style.transform = 'translateY(10px)';
                ind.textContent = '⏳';
                try { await loadFeed(); } catch (e) { console.error('[ZELO] refresh error:', e); }
                ind.textContent = '↓';
                busy = false;
            }
            dist = 0;
            hide();
        };

        document.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd, { passive: true });
        document.addEventListener('touchcancel', onEnd, { passive: true });

        // يمنع المتصفح من إعادة تحميل الصفحة كاملة عند السحب
        const prevOverscroll = document.documentElement.style.overscrollBehaviorY;
        document.documentElement.style.overscrollBehaviorY = 'contain';

        ptrCleanup = () => {
            document.removeEventListener('touchstart', onStart);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            document.removeEventListener('touchcancel', onEnd);
            document.documentElement.style.overscrollBehaviorY = prevOverscroll || '';
            ind.remove();
        };
    }

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
            <div id="feed-list">
                <div class="loading-box">${isAr() ? 'جاري تحميل المنشورات...' : 'Loading posts...'}</div>
            </div>
        `;

        loadFeed();
        setupFab();
        if (timeTimer) clearInterval(timeTimer);
        timeTimer = setInterval(refreshTimes, 30000);
        setupPullToRefresh();
    };

    // أسماء بديلة قديمة تبقى تعمل مع app.js
    window.renderCommunityPage = window.renderHomePage;
    window.renderNewsPage = window.renderHomePage;
})();
