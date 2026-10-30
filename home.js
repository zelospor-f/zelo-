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
    // حد طول المنشور: 280 للجميع، و1000 للمشتركين (ZELO PRO) — يُفرض أيضاً في قاعدة البيانات
    const FREE_POST_MAX = 280, PRO_POST_MAX = 1000;
    const isPro = () => !!(window.ZeloPremium && window.ZeloPremium.has(me().id));
    const postLimit = () => (isPro() ? PRO_POST_MAX : FREE_POST_MAX);
    const postErrText = (err) => String((err && err.message) || '').includes('premium_required')
        ? (isAr() ? 'المنشورات الأطول من 280 حرفاً للمشتركين فقط' : 'Posts over 280 characters are for subscribers only')
        : null;
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

    let pendingVideo = null;   // ملف الفيديو المختار قبل النشر

    // ===================== شدّ الحبل: أنماط المنشورات =====================
    let pendingTopic = { type: null, name: '', nameB: '' };
    const ropeCache = {};
    const TOPICS = {
        player:     { ar: 'لاعب',   en: 'Player',        a: ['يستحق', 'Deserves it'],      b: ['لا يستحق', "Doesn't"],        ph: ['اسم اللاعب', 'Player name'] },
        coach:      { ar: 'مدرب',   en: 'Coach',         a: ['أبقوه', 'Keep him'],         b: ['أقيلوه', 'Sack him'],         ph: ['اسم المدرب', 'Coach name'] },
        referee:    { ar: 'حكم',    en: 'Referee',       a: ['قرار صحيح', 'Correct call'], b: ['قرار خاطئ', 'Wrong call'],    ph: ['الحكم أو المباراة', 'Referee or match'] },
        club:       { ar: 'نادٍ',   en: 'Club',          a: ['أفخر به', 'Proud'],          b: ['أنتقده', 'Critical'],         ph: ['اسم النادي', 'Club name'] },
        league:     { ar: 'دوري',   en: 'League',        a: ['قوي', 'Strong'],             b: ['مبالغ فيه', 'Overrated'],     ph: ['اسم الدوري', 'League name'] },
        national:   { ar: 'منتخب',  en: 'National team', a: ['جاهز', 'Ready'],             b: ['غير جاهز', 'Not ready'],      ph: ['اسم المنتخب', 'Team name'] },
        match:      { ar: 'مباراة', en: 'Match',         a: ['عادلة', 'Fair'],             b: ['ظالمة', 'Unfair'],            ph: ['المباراة', 'The match'] },
        transfer:   { ar: 'صفقة',   en: 'Transfer',      a: ['ناجحة', 'Success'],          b: ['فاشلة', 'Flop'],              ph: ['اللاعب أو الصفقة', 'Player or deal'] },
        compare:    { ar: 'مقارنة', en: 'Compare',       a: null,                          b: null,                           ph: ['الطرف الأول', 'First side'], ph2: ['الطرف الثاني', 'Second side'] },
        prediction: { ar: 'توقع',   en: 'Prediction',    a: ['سيحدث', 'Will happen'],      b: ['لن يحدث', "Won't happen"],    ph: ['المباراة أو الحدث', 'Match or event'] }
    };
    const tl = pair => (isAr() ? pair[0] : pair[1]);
    const topicTitle = t => (isAr() ? TOPICS[t].ar : TOPICS[t].en);
    const ropeLabels = p => (p.topic_type === 'compare')
        ? [p.topic_name, p.topic_name_b]
        : [tl(TOPICS[p.topic_type].a), tl(TOPICS[p.topic_type].b)];

    // مرشّح خفيف لكلمات الاتهام والسب في منشورات الأشخاص (لا يغني عن البلاغات والمراجعة)
    const BAD_WORDS = new Set(['مرتشي', 'مرتشين', 'رشوة', 'رشاوي', 'مأجور', 'فاسد', 'سارق', 'لص', 'حقير', 'قذر', 'كلب', 'حمار', 'bribed', 'corrupt', 'thief', 'idiot']);
    const hasBadWords = text => String(text || '').toLowerCase().split(/[^\p{L}]+/u).some(w => BAD_WORDS.has(w));

    (function injectRopeCss() {
        if (document.getElementById('zrope-css')) return;
        const st = document.createElement('style');
        st.id = 'zrope-css';
        st.textContent = `
            .zrope{margin:8px 0 2px;border:1px solid rgba(245,195,90,.28);border-radius:14px;padding:9px 12px;background:linear-gradient(160deg,rgba(245,195,90,.08),rgba(15,26,92,.5));}
            .zrope-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
            .zrope-chip{padding:2px 9px;border-radius:999px;background:rgba(245,195,90,.16);color:#f5c35a;font-size:.7rem;font-weight:900;white-space:nowrap;}
            .zrope-name{font-weight:900;font-size:.86rem;color:#fff;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .zrope-tot{font-size:.7rem;color:#9aa6d8;white-space:nowrap;}
            .zrope-pcts{display:flex;justify-content:space-between;gap:8px;font-size:.72rem;font-weight:800;margin-bottom:3px;}
            .zrope-pcts .a{color:#2de2c4;} .zrope-pcts .b{color:#ff7d92;}
            .zrope-track{position:relative;padding:3px 0;}
            .zrope-bar{height:10px;border-radius:5px;overflow:hidden;display:flex;background:rgba(255,255,255,.08);}
            .zrope-bar i{display:block;height:100%;transition:width .35s ease;}
            .zrope-bar .a{background:linear-gradient(90deg,#2de2c4,#1bb89e);}
            .zrope-bar .b{background:linear-gradient(90deg,#ff7d92,#ff4d6d);}
            .zrope-knot{position:absolute;top:0;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #0a1033;box-shadow:0 0 0 2px #f5c35a;transition:inset-inline-start .35s ease;}
            .zrope-clubs{display:flex;justify-content:space-between;margin-top:5px;}
            .zrope-club{display:inline-flex;align-items:center;gap:3px;font-size:.72rem;color:#b9c3ee;margin-inline-end:8px;}
                        .zrope-btns{display:flex;gap:8px;margin-top:8px;}
            .zrope-btn{flex:1;min-height:40px;border-radius:12px;font-weight:900;font-size:.82rem;cursor:pointer;border:1.5px solid transparent;font-family:inherit;-webkit-tap-highlight-color:transparent;}
            .zrope-btn.a{background:rgba(45,226,196,.12);border-color:rgba(45,226,196,.5);color:#2de2c4;}
            .zrope-btn.a.on{background:#2de2c4;color:#062a24;}
            .zrope-btn.b{background:rgba(255,77,109,.12);border-color:rgba(255,77,109,.5);color:#ff8fa1;}
            .zrope-btn.b.on{background:#ff4d6d;color:#fff;}
            .post-card.has-rope .post-text{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;}
            .zrope-more{display:none;color:#f5c35a;font-size:.8rem;font-weight:800;margin-top:4px;}
            .post-card.has-rope .zrope-more{display:block;}
            .topic-box{padding:8px 16px 4px;border-top:1px solid rgba(255,255,255,.08);}
            .topic-title{font-size:.74rem;font-weight:800;color:#9aa6d8;margin-bottom:6px;}
            .topic-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
            .topic-chips::-webkit-scrollbar{display:none;}
            .topic-chip{flex:none;padding:7px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#cdd6ff;font-size:.8rem;font-weight:800;font-family:inherit;cursor:pointer;}
            .topic-chip.on{background:#f5c35a;color:#0a1033;border-color:#f5c35a;}
            .topic-input{width:100%;box-sizing:border-box;margin-top:6px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-family:inherit;font-size:.9rem;outline:none;}
            .topic-input:focus{border-color:#f5c35a;}
            .topic-hint{font-size:.72rem;color:#9aa6d8;margin-top:6px;line-height:1.6;}
        `;
        document.head.appendChild(st);
    })();

    // جلب أصوات الحبل لمجموعة منشورات وتخزينها (بدون رسم)
    async function fetchRope(posts) {
        const c = db();
        const ids = (posts || []).filter(p => p && p.topic_type).map(p => p.id);
        if (!c || !ids.length) return;
        ids.forEach(id => { ropeCache[id] = { n: [0, 0], clubs: [{}, {}], mine: null }; });
        try {
            const [sumRes, mineRes] = await Promise.all([
                c.rpc('rope_summary', { p_ids: ids }),
                c.from('post_rope_votes').select('post_id,side').eq('user_id', me().id).in('post_id', ids)
            ]);
            (sumRes.data || []).forEach(r => {
                const o = ropeCache[r.post_id]; if (!o) return;
                const s = r.side === 1 ? 1 : 0, n = Number(r.n) || 0;
                o.n[s] += n;
                if (r.club) o.clubs[s][r.club] = (o.clubs[s][r.club] || 0) + n;
            });
            (mineRes.data || []).forEach(r => { if (ropeCache[r.post_id]) ropeCache[r.post_id].mine = r.side; });
        } catch (e) { console.error('[ZELO] fetchRope error:', e); }
    }

    function ropeHtml(p) {
        if (!p || !p.topic_type || !TOPICS[p.topic_type]) return '';
        const o = ropeCache[p.id] || { n: [0, 0], clubs: [{}, {}], mine: null };
        const [la, lb] = ropeLabels(p);
        const tot = o.n[0] + o.n[1];
        const pa = tot ? Math.round(o.n[0] / tot * 100) : 50;
        const pb = 100 - pa;
        const subject = p.topic_type === 'compare' ? `${p.topic_name} ⟷ ${p.topic_name_b}` : p.topic_name;
        const clubs = s => Object.entries(o.clubs[s]).filter(e => e[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 3)
            .map(([k, v]) => `<span class="zrope-club">${typeof window.zeloVerifiedBadge === 'function' ? window.zeloVerifiedBadge(k, 16) : ''}<b>${v}</b></span>`).join('');
        return `
            <div class="zrope-head">
                <span class="zrope-chip">${esc(topicTitle(p.topic_type))}</span>
                <span class="zrope-name">${esc(subject)}</span>
                ${tot ? `<span class="zrope-tot">${tot} ${isAr() ? 'صوت' : 'votes'}</span>` : ''}
            </div>
            <div class="zrope-pcts">
                <span class="a">${esc(la)} ${tot ? pa + '%' : ''}</span>
                <span class="b">${esc(lb)} ${tot ? pb + '%' : ''}</span>
            </div>
            <div class="zrope-track">
                <div class="zrope-bar"><i class="a" style="width:${pa}%"></i><i class="b" style="width:${pb}%"></i></div>
                <span class="zrope-knot" style="inset-inline-start:calc(${pa}% - 8px)"></span>
            </div>
            ${(clubs(0) || clubs(1)) ? `<div class="zrope-clubs"><div>${clubs(0)}</div><div>${clubs(1)}</div></div>` : ''}
            <div class="zrope-btns">
                <button class="zrope-btn a ${o.mine === 0 ? 'on' : ''}" onclick="window.ropeVote(${p.id},0)">${esc(la)}${o.n[0] ? ' · ' + o.n[0] : ''}</button>
                <button class="zrope-btn b ${o.mine === 1 ? 'on' : ''}" onclick="window.ropeVote(${p.id},1)">${esc(lb)}${o.n[1] ? ' · ' + o.n[1] : ''}</button>
            </div>`;
    }

    function updateRope(id) {
        const p = postCache[id];
        document.querySelectorAll(`.zrope[data-pid="${id}"]`).forEach(el => { el.innerHTML = ropeHtml(p); });
    }

    window.ropeVote = async function (id, side) {
        const c = db();
        const o = ropeCache[id];
        if (!c || !o) return;
        const prev = o.mine;
        const next = prev === side ? -1 : side;
        const myClub = US().badgeClub || US().badge_club || '';
        const bump = (s, d) => { o.n[s] = Math.max(0, o.n[s] + d); if (myClub) o.clubs[s][myClub] = Math.max(0, (o.clubs[s][myClub] || 0) + d); };
        if (prev === 0 || prev === 1) bump(prev, -1);
        if (next !== -1) bump(next, 1);
        o.mine = next === -1 ? null : next;
        updateRope(id);
        const { error } = await c.rpc('rope_vote', { p_post: id, p_side: next });
        if (error) {
            console.error('[ZELO] rope_vote error:', error);
            await fetchRope([postCache[id]]);
            updateRope(id);
            alert((isAr() ? 'تعذّر تسجيل صوتك: ' : 'Could not save your vote: ') + (error.message || ''));
        }
    };

    // ===== اختيار النمط في شاشة النشر =====
    function topicBoxHtml() {
        const chips = [`<button type="button" class="topic-chip on" data-t="" onclick="window.pickTopic('')">${isAr() ? 'رأي عام' : 'General'}</button>`]
            .concat(Object.keys(TOPICS).map(k => `<button type="button" class="topic-chip" data-t="${k}" onclick="window.pickTopic('${k}')">${esc(topicTitle(k))}</button>`)).join('');
        return `
            <div class="topic-box">
                <div class="topic-title">${isAr() ? 'نوع المنشور' : 'Post type'}</div>
                <div class="topic-chips">${chips}</div>
                <div id="topic-fields"></div>
            </div>`;
    }

    window.pickTopic = function (t) {
        pendingTopic = { type: t || null, name: '', nameB: '' };
        document.querySelectorAll('.topic-chip').forEach(b => b.classList.toggle('on', (b.dataset.t || '') === (t || '')));
        const box = document.getElementById('topic-fields');
        if (!box) return;
        if (!t) { box.innerHTML = ''; return; }
        const T = TOPICS[t];
        const person = (t === 'player' || t === 'coach' || t === 'referee' || t === 'compare');
        box.innerHTML = `
            <input class="topic-input" maxlength="60" placeholder="${esc(tl(T.ph))}" oninput="window.setTopicName(this.value)">
            ${t === 'compare' ? `<input class="topic-input" maxlength="60" placeholder="${esc(tl(T.ph2))}" oninput="window.setTopicNameB(this.value)">` : ''}
            ${person ? `<div class="topic-hint">${isAr() ? 'النقد للأداء والقرارات فقط. السب والاتهامات غير مسموحة.' : 'Criticism of performance and decisions only. No insults or accusations.'}</div>` : ''}
            ${t === 'prediction' ? `<div class="topic-hint">${isAr() ? 'التوقع مجاني دائماً، ويعطيك شارة فقط ولا يرتبط بأي مال.' : 'Predictions are always free: badges only, never money.'}</div>` : ''}`;
    };
    window.setTopicName = v => { pendingTopic.name = v; };
    window.setTopicNameB = v => { pendingTopic.nameB = v; };

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
            background: linear-gradient(135deg, #f5c35a, #ffd98a);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .news-sub { color: #9aa6d6; font-size: 0.78rem; margin: 0; font-weight: bold; }

        .composer, .post-card {
            background: linear-gradient(135deg, rgba(17, 26, 74, 0.95), rgba(10, 16, 51, 0.95));
            border: 1px solid rgba(245, 195, 90, 0.3);
            border-radius: 16px; padding: 12px; margin-bottom: 12px;
            box-shadow: 0 0 12px rgba(44, 75, 181, 0.2);
        }
        .composer-top { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
        .composer-text, .edit-area {
            flex: 1; min-height: 60px; resize: vertical; box-sizing: border-box;
            background: rgba(0,0,0,0.45); border: 1px solid rgba(245,195,90,0.18);
            border-radius: 12px; padding: 10px; color: #fff; font-size: 0.86rem; outline: none;
        }
        .composer-text:focus, .edit-area:focus, .cm-input:focus { border-color: #f5c35a; }
        .cm-input {
            width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.45);
            border: 1px solid rgba(245,195,90,0.18); border-radius: 10px;
            padding: 8px 10px; color: #fff; font-size: 0.8rem; outline: none;
        }
        .tool-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
        .tool-btn {
            border: 1px solid rgba(245,195,90,0.35); cursor: pointer; padding: 8px 12px; border-radius: 12px;
            background: rgba(245,195,90,0.1); color: #f5c35a; font-weight: 800; font-size: 0.8rem;
        }
        .publish-btn {
            border: none; cursor: pointer; padding: 9px 20px; border-radius: 12px;
            background: linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a); color: #fff;
            font-weight: 900; font-size: 0.85rem; box-shadow: 0 4px 14px rgba(44,75,181,0.35);
        }
        .img-preview { position: relative; margin-top: 8px; }
        .img-preview img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 12px; border: 1px solid rgba(245,195,90,0.18); }
        .img-remove {
            position: absolute; top: 6px; left: 6px; border: none; cursor: pointer;
            background: rgba(0,0,0,0.7); color: #fff; width: 28px; height: 28px; border-radius: 50%; font-weight: 900;
        }

        .post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .post-avatar {
            width: 40px; height: 40px; min-width: 40px; border-radius: 50%;
            object-fit: cover; border: 2px solid rgba(245,195,90,0.5);
            box-shadow: 0 0 10px rgba(245,195,90,0.25);
        }
        .post-meta { flex: 1; min-width: 0; }
        .post-author { color: #fff; font-weight: 900; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .post-time { color: #7782b0; font-size: 0.68rem; font-weight: 700; margin-top: 2px; }
        .owner-actions { display: flex; gap: 6px; }
        .owner-actions button {
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem;
        }
        .post-text { color: #e2e8f0; font-size: 0.86rem; line-height: 1.6; word-break: break-word; }
        .post-img {
            width: 100%; max-height: 360px; object-fit: cover; border-radius: 12px;
            margin-top: 10px; border: 1px solid rgba(245,195,90,0.18);
        }
        .post-stats { color: #9aa6d6; font-size: 0.72rem; font-weight: 700; margin: 10px 0 6px 0; }
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
            background: linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a); color: #fff; font-weight: 900;
        }
        .cm { display: flex; gap: 8px; margin-bottom: 8px; }
        .cm-avatar { width: 28px; height: 28px; min-width: 28px; border-radius: 50%; object-fit: cover; }
        .cm-body {
            flex: 1; min-width: 0; background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 8px 10px;
        }
        .cm-name { color: #fff; font-weight: 800; font-size: 0.76rem; }
        .cm-time { color: #7782b0; font-weight: 700; font-size: 0.62rem; margin-inline-start: 4px; }
        .cm-text { color: #cbd5e1; font-size: 0.8rem; margin-top: 3px; word-break: break-word; }
        .cm-actions { display: flex; gap: 10px; margin-top: 4px; }
        .cm-actions button { background: none; border: none; color: #5a7de8; font-size: 0.7rem; font-weight: 800; cursor: pointer; padding: 0; }
        .cm-empty { text-align: center; color: #7782b0; font-size: 0.75rem; padding: 6px; }
        .save-mini {
            border: none; cursor: pointer; padding: 7px 16px; border-radius: 10px;
            background: linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a); color: #fff; font-weight: 900; font-size: 0.78rem;
        }
        .empty-box, .loading-box {
            text-align: center; padding: 26px 14px; color: #9aa6d6; font-size: 0.85rem; font-weight: 700;
            background: rgba(17,26,74,0.8); border: 1px dashed rgba(245,195,90,0.3); border-radius: 16px;
        }
        .loading-box { color: #f5c35a; }

        /* زر النشر العائم (مثل X) */
        .fab-compose {
            position: fixed; bottom: 105px; inset-inline-end: 20px;
            width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer;
            background: #2c4bb5; color: #fff; font-size: 1.8rem; line-height: 1;
            display: flex; align-items: center; justify-content: center; padding: 0;
            box-shadow: 0 6px 20px rgba(44,75,181,0.5); z-index: 1500; transition: transform 0.15s;
        }
        .fab-compose:active { transform: scale(0.92); }

        /* شاشة كتابة المنشور */
        .compose-overlay {
            position: fixed; inset: 0; z-index: 3000; background: #0a1033;
            display: flex; flex-direction: column; animation: fadeUp 0.25s ease-out;
        }
        .compose-top {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .compose-close { background: none; border: none; color: #fff; font-size: 1.4rem; cursor: pointer; padding: 4px 8px; }
        .compose-post-btn {
            border: none; cursor: pointer; padding: 8px 24px; border-radius: 999px;
            background: #2c4bb5; color: #fff; font-weight: 900; font-size: 0.9rem;
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
            display: flex; align-items: center; gap: 6px; color: #9aa6d6;
            font-size: 0.85rem; font-weight: 700;
        }
        .post-actions .act-btn .ic { font-size: 1.05rem; }
        .post-actions .act-btn.liked { color: #f91880; background: rgba(249,24,128,0.12); border: none; }
        .post-actions .act-btn.reposted { color: #14F195; background: rgba(20,241,149,0.12); }

        /* صور وملصقات وايموجي الردود */
        .cm-img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 10px; margin-top: 6px; border: 1px solid rgba(255,255,255,0.08); }
        .cm-sticker { font-size: 3.2rem; line-height: 1.1; margin-top: 2px; }
        .emoji-grid {
            display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
            padding: 8px 10px; max-height: 230px; overflow-y: auto;
            border-top: 1px solid rgba(255,255,255,0.08); background: #111a4a;
        }
        .emoji-grid.stk { grid-template-columns: repeat(4, 1fr); }
        .emoji-btn { background: none; border: none; font-size: 1.5rem; padding: 6px 0; cursor: pointer; }
        .stk-btn { font-size: 2.6rem; }

        /* رأس المنشور على طريقة X */
        .post-sub { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; color: #7782b0; font-size: 0.7rem; font-weight: 700; margin-top: 2px; }
        .post-handle { color: #7782b0; font-size: 0.72rem; font-weight: 700; direction: ltr; unicode-bidi: plaintext; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dots-btn { background: none; border: none; color: #9aa6d6; font-size: 1.25rem; cursor: pointer; padding: 2px 8px; border-radius: 50%; line-height: 1; }
        .dots-btn:active { background: rgba(255,255,255,0.1); }

        /* الردود المتداخلة */
        .cm-head { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .cm-head .dots-btn { margin-inline-start: auto; font-size: 1.05rem; padding: 0 6px; }
        .cm-children { margin-inline-start: 16px; border-inline-start: 2px solid rgba(255,255,255,0.08); padding-inline-start: 8px; }
        .cm-replying { color: #7782b0; font-size: 0.68rem; font-weight: 700; margin-top: 2px; }
        .cm-replying span { color: #f5c35a; direction: ltr; unicode-bidi: plaintext; }
        .cm-actions .cm-act { display: flex; align-items: center; gap: 4px; color: #9aa6d6; font-size: 0.74rem; font-weight: 800; padding: 2px 4px; }
        .cm-actions .cm-act.liked { color: #f91880; }
        .cm-thread.cm-focus { background: rgba(245,195,90,0.12); border-radius: 12px; transition: background .4s; }
        .fl-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; }

        /* القائمة السفلية (⋮) */
        .sheet-overlay { position: fixed; inset: 0; z-index: 4000; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; animation: zhFade 0.18s ease-out; }
        .sheet { width: 100%; max-height: 82vh; overflow-y: auto; background: #111a4a; border-radius: 20px 20px 0 0; padding: 8px 8px calc(14px + env(safe-area-inset-bottom, 0px)); animation: zhUp 0.22s ease-out; }
        .sheet-grip { width: 42px; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.25); margin: 6px auto 10px; }
        .sheet-title { color: #9aa6d6; font-size: 0.8rem; font-weight: 800; padding: 4px 14px 10px; }
        .sheet-item { width: 100%; display: flex; align-items: center; gap: 14px; background: none; border: none; color: #e7e9ea; font-size: 0.95rem; font-weight: 700; padding: 14px 12px; border-radius: 12px; cursor: pointer; text-align: start; font-family: inherit; }
        .sheet-item:active { background: rgba(255,255,255,0.08); }
        .sheet-item .si-ic { width: 26px; text-align: center; font-size: 1.2rem; }
        .sheet-item.danger { color: #f4212e; }
        .sheet-sep { height: 1px; background: rgba(255,255,255,0.1); margin: 6px 8px; }
        .sheet-stat { display: flex; justify-content: space-between; padding: 14px; color: #e7e9ea; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .zh-toast { position: fixed; left: 50%; bottom: 110px; transform: translateX(-50%); z-index: 5000; background: #2c4bb5; color: #fff; padding: 10px 16px; border-radius: 12px; font-weight: 800; font-size: 0.85rem; display: flex; gap: 12px; align-items: center; max-width: 90vw; }
        .zh-toast button { background: none; border: none; color: #fff; font-weight: 900; text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
        .post-actions .act-btn { padding: 6px 5px; gap: 4px; font-size: 0.8rem; }
        .post-actions .act-btn.saved { color: #f5c35a; background: rgba(245,195,90,0.12); }
        .post-actions .act-btn .ic { display: inline-flex; align-items: center; justify-content: center; }
        .post-actions .act-btn .ic svg { display: block; }

        /* ===== منشورات مسطحة على طريقة X (بدون بطاقات) ===== */
        #feed-list .post-card {
            background: transparent; border: none; border-radius: 0; box-shadow: none;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            margin: 0 -12px; padding: 12px 14px 4px;
        }
        #feed-list .post-img { border-radius: 16px; max-height: 420px; }
        #feed-list .comments-box { display: none !important; }

        /* ===== صفحة المنشور (تفتح عند الضغط على المنشور) ===== */
        .pp-overlay { position: fixed; inset: 0; z-index: 4600; background: #0a1033; display: flex; flex-direction: column; animation: zhFade 0.18s ease-out; }
        .pp-top { display: flex; align-items: center; gap: 22px; padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .pp-back { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; padding: 0 4px; line-height: 1; }
        .pp-title { color: #fff; font-weight: 900; font-size: 1.15rem; }
        .pp-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .pp-main { padding: 14px 16px 0; }
        .pp-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .pp-text { color: #f1f5f9; font-size: 1.12rem; line-height: 1.65; word-break: break-word; }
        .pp-img { width: 100%; max-height: 520px; object-fit: cover; border-radius: 16px; margin-top: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .pp-meta { color: #7782b0; font-size: 0.8rem; font-weight: 700; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .pp-meta b { color: #fff; }
        .pp-actions { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 4px 0; }
        .pp-actions .post-actions { padding: 4px 0; }
        .pp-comments { padding: 10px 12px 90px; }
        .pp-replybar {
            position: absolute; left: 0; right: 0; bottom: 0;
            padding: 8px 12px calc(10px + env(safe-area-inset-bottom, 0px));
            background: #0a1033; border-top: 1px solid rgba(255,255,255,0.08);
        }
        .pp-replypill {
            display: flex; align-items: center; gap: 10px; cursor: pointer;
            background: #111a4a; border-radius: 999px; padding: 8px 10px; color: #9aa6d6; font-weight: 700; font-size: 0.95rem;
        }
        .pp-replypill img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
        #reply-overlay { z-index: 4800; }
        .sheet-overlay { z-index: 4900; }
        .pc-post-body { cursor: pointer; }
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
            <div onclick="window.openPostPage(${p.id})" style="cursor:pointer;">
                <div class="post-text">${esc(p.content).replace(/\n/g, '<br>')}</div>
                ${p.topic_type && String(p.content || '').length > 260 ? `<div class="zrope-more">${isAr() ? 'عرض المزيد' : 'Show more'}</div>` : ''}
                ${p.image_url ? `<img class="post-img" src="${p.image_url}" onerror="this.style.display='none'">` : ''}
                ${p.video_url ? `<video class="post-video" src="${p.video_url}" muted loop playsinline preload="metadata" onclick="event.stopPropagation();window.openVideoViewer(${p.id})" style="width:100%;border-radius:14px;margin-top:8px;max-height:420px;background:#000;cursor:pointer;"></video>` : ''}
            </div>
        `;
    }

    // أيقونات SVG واقعية على طريقة X
    const svgIcon = (d, filled = false) =>
        `<svg viewBox="0 0 24 24" width="19" height="19" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const ICONS = {
        reply:  svgIcon('<path d="M21 11.5c0 4.14-3.8 7.5-8.5 7.5-.9 0-1.8-.12-2.6-.35L5 21l1.4-3.6C5.5 16.3 4.5 14.5 4.5 12.5 4.5 8.36 8.3 5 13 5s8 3.36 8 6.5z"/>'),
        repost: svgIcon('<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
        heart:  on => svgIcon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1.1a5.5 5.5 0 0 0 0-7.7z"/>', on),
        views:  svgIcon('<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>'),
        save:   on => svgIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', on),
        share:  svgIcon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>')
    };

    // أزرار التفاعل مع الأعداد (تعليق · إعادة نشر · إعجاب · مشاهدات · حفظ · مشاركة)
    function actionsHtml(p) {
        return `
            <button class="act-btn" onclick="window.openReply(${p.id})">
                <span class="ic">${ICONS.reply}</span><span class="cnt">${p.comments || 0}</span>
            </button>
            <button class="act-btn rp-btn ${p.reposted ? 'reposted' : ''}" onclick="window.toggleRepost(${p.id})">
                <span class="ic">${ICONS.repost}</span><span class="cnt">${p.reposts || 0}</span>
            </button>
            <button class="act-btn like-btn ${p.liked ? 'liked' : ''}" onclick="window.toggleLike(${p.id})">
                <span class="ic">${ICONS.heart(p.liked)}</span><span class="cnt">${p.likes || 0}</span>
            </button>
            <span class="act-btn" style="cursor:default;">
                <span class="ic">${ICONS.views}</span><span class="cnt">${p.views || 0}</span>
            </span>
            <button class="act-btn bm-btn ${p.saved ? 'saved' : ''}" onclick="window.toggleBookmark(${p.id})" style="opacity:${p.saved ? 1 : 0.6};">
                <span class="ic">${ICONS.save(p.saved)}</span>
            </button>
            <button class="act-btn" onclick="window.sharePost(${p.id})">
                <span class="ic">${ICONS.share}</span>
            </button>
        `;
    }

    function postHtml(p) {
        const edited = p.updated_at && p.created_at && p.updated_at !== p.created_at;
        const handle = handleOf(p.user_id);
        return `
            <div class="post-card${p.topic_type ? ' has-rope' : ''}" id="post-${p.id}" data-uid="${esc(p.user_id)}" data-pid="${p.id}" ${p._boostId ? `data-boost-id="${p._boostId}"` : ''}>
                <div class="post-head">
                    <img class="post-avatar" style="cursor:pointer" onclick="window.openUserProfile('${esc(p.user_id)}')" src="${esc(avatarUrl(p.author_name, p.author_avatar))}" onerror="this.style.display='none'">
                    <div class="post-meta">
                        <div class="post-author">${esc(p.author_name)}${badgeHtml(p.user_id)}</div>
                        <div class="post-sub">
                            ${p._boostId ? `<span style="color:#f5c35a;font-weight:800;">${isAr() ? 'معزّز' : 'Boosted'}</span><span>·</span>` : ''}
                            ${handle ? `<span class="post-handle">@${esc(handle)}</span><span>·</span>` : ''}
                            ${timeHtml(p.created_at)}
                            ${edited ? `<span>· ${isAr() ? 'معدّل' : 'edited'}</span>` : ''}
                        </div>
                    </div>
                    <button class="dots-btn" onclick="window.openPostMenu(${p.id})" aria-label="more">⋮</button>
                </div>
                <div id="post-body-${p.id}">${postBodyHtml(p)}</div>
                ${p.topic_type ? `<div class="zrope" data-pid="${p.id}">${ropeHtml(p)}</div>` : ''}
                <div class="post-actions">${actionsHtml(p)}</div>
                <div class="zsup" data-pid="${p.id}" data-owner="${esc(p.user_id)}"></div>
                <div class="comments-box" id="comments-${p.id}" style="display: none;"></div>
            </div>
        `;
    }

    function updatePostUI(id) {
        const p = postCache[id];
        if (!p) return;
        const el = document.getElementById(`post-${id}`);
        const box = el && el.querySelector('.post-actions');
        if (box) box.innerHTML = actionsHtml(p);
        // نسخة المنشور داخل صفحة البروفايل
        document.querySelectorAll(`.pc-post[data-pid="${id}"] .post-actions`).forEach(b => { b.innerHTML = actionsHtml(p); });
        document.querySelectorAll(`#pp-overlay[data-pid="${id}"] .post-actions`).forEach(b => { b.innerHTML = actionsHtml(p); });
    }

    // تحميل أعداد التفاعل لمنشورات البروفايل وتخزينها في postCache
    async function loadPostStats(posts) {
        const c = db();
        if (!c || !posts.length) return;
        const ids = posts.map(p => p.id);
        const [likesRes, cmRes, rpRes, vwRes, bmRes] = await Promise.all([
            c.from('post_likes').select('post_id,user_id').in('post_id', ids),
            c.from('post_comments').select('post_id').in('post_id', ids),
            c.from('post_reposts').select('post_id,user_id').in('post_id', ids),
            c.from('post_views').select('post_id,user_id').in('post_id', ids),
            c.from('post_bookmarks').select('post_id').eq('user_id', me().id).in('post_id', ids)
        ]);
        const likes = likesRes.data || [], cms = cmRes.data || [], reps = rpRes.data || [], views = vwRes.data || [];
        const marks = new Set((bmRes.data || []).map(r => String(r.post_id)));
        posts.forEach(p => {
            const k = String(p.id), uid = me().id;
            postCache[p.id] = {
                ...(postCache[p.id] || {}), ...p,
                likes: likes.filter(l => String(l.post_id) === k).length,
                liked: likes.some(l => String(l.post_id) === k && String(l.user_id) === uid),
                comments: cms.filter(x => String(x.post_id) === k).length,
                reposts: reps.filter(r => String(r.post_id) === k).length,
                reposted: reps.some(r => String(r.post_id) === k && String(r.user_id) === uid),
                views: views.filter(v => String(v.post_id) === k).length,
                viewedByMe: views.some(v => String(v.post_id) === k && String(v.user_id) === uid),
                saved: marks.has(k)
            };
        });
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

    // ===================== المنشورات المعززة في الخلاصة =====================
    const BOOST_EVERY = 4;          // منشور معزّز بعد كل 4 منشورات عادية
    const boostSeen = new Set();    // ظهور واحد لكل معزّز في كل جلسة (والخادم يفرض السقف اليومي أيضاً)
    let boostObserver = null;

    // يدمج المنشورات المعززة النشطة بين المنشورات العادية
    async function mixBoosts(list) {
        const c = db();
        if (!c) return list;

        let boosts = [];
        try {
            const { data, error } = await c.rpc('get_active_boosts');
            if (error) throw error;
            boosts = data || [];
        } catch (e) {
            console.error('[ZELO] get_active_boosts:', e);
            return list;
        }
        if (!boosts.length) return list;

        const boostByPost = new Map(boosts.map(b => [String(b.post_id), b]));
        const boostedIds = new Set(boostByPost.keys());

        // منشورات معززة قد لا تكون ضمن أحدث 50 منشوراً
        const have = new Set(list.map(p => String(p.id)));
        const missing = [...boostedIds].filter(id => !have.has(id)).map(Number);
        let extra = [];
        if (missing.length) {
            const { data } = await c.from('posts').select('*').in('id', missing);
            extra = data || [];
        }

        const organic = list.filter(p => !boostedIds.has(String(p.id)));
        const boosted = [...list, ...extra]
            .filter(p => boostedIds.has(String(p.id)) && !isHiddenUser(p.user_id) && !hiddenPosts.has(String(p.id)))
            .filter((p, i, arr) => arr.findIndex(x => String(x.id) === String(p.id)) === i)
            .map(p => ({ ...p, _boostId: boostByPost.get(String(p.id)).id }));

        const out = [];
        let bi = 0;
        organic.forEach((p, i) => {
            out.push(p);
            if (bi < boosted.length && (i + 1) % BOOST_EVERY === 0) out.push(boosted[bi++]);
        });
        // إذا كانت المنشورات العادية قليلة، نضع معززاً واحداً على الأقل في البداية
        if (boosted.length && !out.some(p => p._boostId)) out.unshift(boosted[0]);
        return out;
    }

    // يسجل ظهوراً واحداً للمعزّز عندما يظهر فعلياً على الشاشة
    async function recordBoostImpression(boostId, postId) {
        const c = db();
        const uid = me().id;
        const p = postCache[postId];
        if (!c || !uid || !boostId || !p) return;
        if (String(p.user_id) === uid) return; // لا يُحسب ظهور صاحب المنشور لمنشوره
        const key = String(boostId) + ':' + uid;
        if (boostSeen.has(key)) return;
        boostSeen.add(key);
        try {
            await c.rpc('record_boost_impression', { p_boost_id: Number(boostId), p_viewer_id: uid });
        } catch (e) {
            console.error('[ZELO] boost impression:', e);
        }
    }

    function observeBoosts() {
        if (boostObserver) { boostObserver.disconnect(); boostObserver = null; }
        if (!('IntersectionObserver' in window)) return;
        boostObserver = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                boostObserver.unobserve(en.target);
                recordBoostImpression(en.target.dataset.boostId, en.target.dataset.pid);
            });
        }, { threshold: 0.6 });
        document.querySelectorAll('.post-card[data-boost-id]').forEach(el => boostObserver.observe(el));
    }

    // تشغيل الفيديو بلا صوت عند ظهوره، وإيقافه عند خروجه من الشاشة
    let videoObserver = null;
    function observeVideos() {
        if (videoObserver) { videoObserver.disconnect(); videoObserver = null; }
        if (!('IntersectionObserver' in window)) return;
        videoObserver = new IntersectionObserver(entries => {
            entries.forEach(en => {
                const v = en.target;
                if (en.isIntersecting && en.intersectionRatio >= 0.6) v.play().catch(() => {});
                else v.pause();
            });
        }, { threshold: [0, 0.6] });
        document.querySelectorAll('video.post-video').forEach(v => videoObserver.observe(v));
    }

    window.notifyUser = notifyUser;
    window.zeloMe = me;

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
        // تعبئة ذاكرة الاشتراك قبل رسم المنشورات، حتى يعرف زر التعزيز حالة المستخدم
        if (window.ZeloPremium && typeof window.ZeloPremium.ensure === 'function') await window.ZeloPremium.ensure([me().id]);
        let visible = posts.filter(p => !isHiddenUser(p.user_id) && !hiddenPosts.has(String(p.id)));
        visible = await mixBoosts(visible);
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
        await fetchRope(visible.map(p => postCache[p.id]));
        list.innerHTML = visible.map(p => postHtml(postCache[p.id])).join('');
        observeViews();
        observeBoosts();
        observeVideos();
        if (window.zeloFillSupportBars) window.zeloFillSupportBars(visible.map(p => p.id));
    }

    // اختيار صورة من الهاتف للمنشور الجديد
    window.pickPostImage = async function(input) {
        pendingVideo = null;
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
        pendingVideo = null;
        const pv = document.getElementById('composer-preview');
        if (pv) pv.innerHTML = '';
    };

    window.createPost = async function() {
        const textEl = document.getElementById('new-post-text');
        const content = (textEl?.value || '').trim();

        if (!content && !pendingImage && !pendingVideo) {
            alert(isAr() ? 'اكتب نصاً أو أضف صورة أو فيديو أولاً.' : 'Write something or add an image or video first.');
            return;
        }

        const c = db();
        if (!c) { alert(isAr() ? 'لا يوجد اتصال بقاعدة البيانات' : 'No database connection'); return; }
        if (content.length > FREE_POST_MAX) {
            const ok = window.ZeloPremium ? await window.ZeloPremium.isPremium() : false;
            if (!ok) { if (window.openSubscriptions) window.openSubscriptions(); else alert(postErrText({ message: 'premium_required' })); return; }
        }
        const u = me();

        // تحقق من نمط المنشور (لاعب / مدرب / حكم ...)
        const tp = pendingTopic;
        let topicFields = {};
        if (tp.type) {
            const n = tp.name.trim(), nb = tp.nameB.trim();
            if (n.length < 2 || (tp.type === 'compare' && nb.length < 2)) {
                alert(isAr() ? 'اكتب اسم الموضوع (حرفان على الأقل).' : 'Enter the subject name (2+ characters).');
                return;
            }
            if (!content) {
                alert(isAr() ? 'اكتب رأيك في المنشور أولاً.' : 'Write your opinion first.');
                return;
            }
            if (hasBadWords(content + ' ' + n + ' ' + nb)) {
                alert(isAr() ? 'المنشور يحتوي على سب أو اتهام غير مسموح. انتقد الأداء والقرارات فقط.' : 'Your post contains an insult or accusation. Criticize performance and decisions only.');
                return;
            }
            topicFields = { topic_type: tp.type, topic_name: n, topic_name_b: tp.type === 'compare' ? nb : null };
        }

        // رفع الفيديو أولاً، ثم إنشاء المنشور برابطه
        let videoUrl = null, videoPath = null;
        if (pendingVideo) {
            try {
                videoPath = `${u.id}/${Date.now()}.mp4`;
                const { error: upErr } = await c.storage.from('post-videos')
                    .upload(videoPath, pendingVideo, { contentType: 'video/mp4', upsert: false });
                if (upErr) throw upErr;
                videoUrl = c.storage.from('post-videos').getPublicUrl(videoPath).data.publicUrl;
            } catch (e) {
                alert((isAr() ? 'فشل رفع الفيديو: ' : 'Video upload failed: ') + (e.message || ''));
                return;
            }
        }

        const { error } = await c.from('posts').insert([{
            user_id: u.id,
            author_name: u.name,
            author_avatar: u.avatar,
            content: content,
            image_url: pendingImage || null,
            video_url: videoUrl,
            video_path: videoPath,
            ...topicFields
        }]);
        if (error) {
            // إذا رُفض المنشور بعد رفع الفيديو، نحذف الملف الذي رُفع
            if (videoPath) { try { await c.storage.from('post-videos').remove([videoPath]); } catch (e) {} }
            const msg = String(error.message || '');
            if (msg.includes('video_daily_limit')) { alert(isAr() ? 'وصلت إلى حد 5 فيديوهات اليوم.' : 'You reached the limit of 5 videos today.'); return; }
            if (msg.includes('premium_required')) { if (window.openSubscriptions) window.openSubscriptions(); return; }
            alert(postErrText(error) || ((isAr() ? 'فشل النشر: ' : 'Post failed: ') + error.message));
            return;
        }

        textEl.value = '';
        window.clearPostImage();
        window.closeCompose();
        await loadFeed();
    };

    // ===== إرسال إشعار لمستخدم آخر (إعجاب / تعليق / إعادة نشر / متابعة) =====
    async function notifyUser(targetId, kind, extra) {
        try {
            const c = db(), u = me();
            targetId = String(targetId || '');
            if (!c || !targetId || targetId === u.id) return;
            const n = u.name || 'Player';
            const T = {
                like:    { ar: `${n} أعجب بمنشورك`,  en: `${n} liked your post` },
                comment: { ar: `${n} علّق على منشورك`, en: `${n} commented on your post` },
                reply:   { ar: `${n} ردّ على تعليقك`, en: `${n} replied to your comment` },
                repost:  { ar: `${n} أعاد نشر منشورك`, en: `${n} reposted your post` },
                follow:  { ar: `${n} بدأ بمتابعتك`,   en: `${n} started following you` },
                support: { ar: `${n} دعم منشورك بـ ${(extra && extra.amount) || 0} ZELO`, en: `${n} supported your post with ${(extra && extra.amount) || 0} ZELO` }
            }[kind];
            if (!T) return;
            const body = String((extra && extra.text) || '').slice(0, 120);
            const row = {
                user_id: targetId, type: 'social',
                actor_id: u.id,
                actor_avatar: avatarUrl(u.name, u.avatar),
                title_ar: T.ar, title_en: T.en,
                body_ar: body, body_en: body,
                is_read: false, action: kind === 'follow' ? 'followers' : (extra && extra.postId) ? 'post:' + extra.postId + (extra.commentId ? ':' + extra.commentId : '') : 'user:' + u.id
            };
            let { error } = await c.from('notifications').insert([row]);
            // إذا لم يكن عمود actor_id موجوداً بعد، نُرسل الإشعار بدونه حتى لا يضيع
            if (error && /actor_id|actor_avatar/i.test(String(error.message || ''))) {
                delete row.actor_id;
                delete row.actor_avatar;
                ({ error } = await c.from('notifications').insert([row]));
            }
            if (error) console.error('[ZELO] notify error:', error.message);
        } catch (e) { console.error('[ZELO] notify error:', e); }
    }

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
            notifyUser(p.user_id, 'like', { postId: id, text: p.content });
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
            notifyUser(p.user_id, 'repost', { postId: id, text: p.content });
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
        if (typeof window.closePostPage === 'function') window.closePostPage();
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
            <textarea id="edit-text-${id}" class="edit-area" maxlength="${postLimit()}" style="width:100%;">${esc(content)}</textarea>
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
        if (error) { alert(postErrText(error) || error.message); return; }

        Object.assign(p, { content: content, image_url: image, updated_at: now });
        delete editState[id];
        renderPostBody(id);
    };

    window.deletePost = async function(id) {
        if (!confirm(isAr() ? 'هل تريد حذف هذا المنشور؟' : 'Delete this post?')) return;
        const videoPath = postCache[id] && postCache[id].video_path;
        const { error } = await db().from('posts').delete().eq('id', id).eq('user_id', me().id);
        if (error) { alert(error.message); return; }
        // حذف ملف الفيديو عبر Storage API (القاعدة لا تسمح بحذفه مباشرة)
        if (videoPath) { try { await db().storage.from('post-videos').remove([videoPath]); } catch (e) { console.warn('video cleanup failed', e); } }

        if (typeof window.closePostPage === 'function') window.closePostPage();
        delete postCache[id];
        document.getElementById(`post-${id}`)?.remove();
        if (!document.querySelector('.post-card')) await loadFeed();
    };

    window.sharePost = async function(id) {
        const p = postCache[id];
        if (!p) return;
        const link = (window.zeloPostLink && window.zeloPostLink(id)) || '';
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
        const list = document.getElementById(`pp-cm-list-${id}`) || document.getElementById(`cm-list-${id}`);
        if (!list) return;
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
            <div style="padding: 12px 16px 0; color: #9aa6d6; font-size: 0.9rem;">
                ${isAr() ? 'ردا على' : 'Replying to'} <span style="color:#f5c35a; direction:ltr; unicode-bidi:plaintext;">@${esc(targetName)}</span>
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

        let newCid = null;
        try {
            const { data: last } = await c.from('post_comments').select('id')
                .eq('post_id', id).eq('user_id', u.id).order('created_at', { ascending: false }).limit(1);
            newCid = last && last[0] ? last[0].id : null;
        } catch (e) {}

        const _post = postCache[id];
        const _parent = row.parent_id != null ? cmCache[row.parent_id] : null;
        if (_post) notifyUser(_post.user_id, 'comment', { postId: id, commentId: newCid, text: content.startsWith('::sticker::') ? content.slice(11) : content });
        if (_parent && String(_parent.user_id) !== String(_post && _post.user_id)) notifyUser(_parent.user_id, 'reply', { postId: id, commentId: newCid, text: content.startsWith('::sticker::') ? content.slice(11) : content });

        window.closeReply();
        if (postCache[id]) {
            postCache[id].comments = (postCache[id].comments || 0) + 1;
            updatePostUI(id);
        }
        if (document.getElementById(`pp-cm-list-${id}`)) await loadComments(id);  // صفحة المنشور مفتوحة: حدّث الردود
        else toast(isAr() ? 'تم إرسال ردّك ✅' : 'Your reply was sent ✅');
    };


    // ===================== صفحة المنشور (مثل X) =====================
    let ppPushed = false;
    function onPpPop() {
        ppPushed = false;
        document.getElementById('pp-overlay')?.remove();
        window.removeEventListener('popstate', onPpPop);
    }
    window.closePostPage = function () {
        document.getElementById('pp-overlay')?.remove();
        window.removeEventListener('popstate', onPpPop);
        if (ppPushed) { ppPushed = false; try { history.back(); } catch (e) {} }
    };

    function focusComment(cid) {
        const el = document.getElementById('cmt-' + cid);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('cm-focus');
        setTimeout(() => el.classList.remove('cm-focus'), 2500);
    }

    window.openPostPage = async function (id, focusCid) {
        const p = postCache[id];
        if (!p) return;
        window.closePostPage();
        const handle = handleOf(p.user_id);
        const u = me();
        const edited = p.updated_at && p.created_at && p.updated_at !== p.created_at;
        const ov = document.createElement('div');
        ov.id = 'pp-overlay';
        ov.className = 'pp-overlay';
        ov.dataset.pid = String(id);
        ov.innerHTML = `
            <div class="pp-top">
                <button class="pp-back" onclick="window.closePostPage()">${isAr() ? '→' : '←'}</button>
                <div class="pp-title">${isAr() ? 'نشر' : 'Post'}</div>
            </div>
            <div class="pp-scroll">
                <div class="pp-main">
                    <div class="pp-head">
                        <img class="post-avatar" style="cursor:pointer" onclick="window.openUserProfile('${esc(p.user_id)}')" src="${esc(avatarUrl(p.author_name, p.author_avatar))}" onerror="this.style.display='none'">
                        <div class="post-meta">
                            <div class="post-author">${esc(p.author_name)}${badgeHtml(p.user_id)}</div>
                            ${handle ? `<div class="post-handle">@${esc(handle)}</div>` : ''}
                        </div>
                        <button class="dots-btn" onclick="window.openPostMenu(${p.id})" aria-label="more">⋮</button>
                    </div>
                    <div class="pp-text">${esc(p.content).replace(/\n/g, '<br>')}</div>
                    ${p.image_url ? `<img class="pp-img" src="${p.image_url}" onerror="this.style.display='none'">` : ''}
                    <div class="pp-meta">${esc(fullDate(p.created_at))}${edited ? ` · ${isAr() ? 'معدّل' : 'edited'}` : ''} · <b id="pp-views">${p.views || 0}</b> ${isAr() ? 'المشاهدات' : 'Views'}</div>
                    <div class="pp-actions"><div class="post-actions">${actionsHtml(p)}</div></div>
                </div>
                <div class="pp-comments" id="pp-cm-list-${id}"><div class="cm-empty">...</div></div>
            </div>
            <div class="pp-replybar">
                <div class="pp-replypill" onclick="window.openReply(${id})">
                    <span style="flex:1">${isAr() ? 'انشر ردّك' : 'Post your reply'}</span>
                    <img src="${esc(avatarUrl(u.name, u.avatar))}" onerror="this.style.display='none'">
                </div>
            </div>`;
        document.body.appendChild(ov);
        try { history.pushState({ pp: 1 }, ''); ppPushed = true; window.addEventListener('popstate', onPpPop); } catch (e) {}
        recordView(id).then(() => { const v = document.getElementById('pp-views'); if (v && postCache[id]) v.textContent = postCache[id].views || 0; });
        await fetchBadges([p.user_id]);
        await loadComments(id);
        if (focusCid) focusComment(focusCid);
    };

    // ===================== صفحة المتابِعين =====================
    window.openFollowers = async function () {
        const c = db();
        const mine = me().id;
        if (!c || !mine) return;
        document.getElementById('fl-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'fl-overlay';
        ov.className = 'pp-overlay';
        ov.innerHTML = `
            <div class="pp-top">
                <button class="pp-back" onclick="document.getElementById('fl-overlay')?.remove()">${isAr() ? '→' : '←'}</button>
                <div class="pp-title">${isAr() ? 'المتابِعون' : 'Followers'}</div>
            </div>
            <div class="pp-scroll"><div class="pp-main" id="fl-list"><div class="cm-empty">...</div></div></div>`;
        document.body.appendChild(ov);

        const { data, error } = await c.from('user_follows').select('follower_id').eq('following_id', mine);
        const list = document.getElementById('fl-list');
        if (!list) return;
        if (error) { list.innerHTML = `<div class="cm-empty">${isAr() ? '❌ تعذر تحميل المتابِعين' : '❌ Failed to load followers'}</div>`; return; }
        const ids = [...new Set((data || []).map(r => String(r.follower_id)))];
        if (!ids.length) { list.innerHTML = `<div class="cm-empty">${isAr() ? 'لا يوجد متابِعون بعد' : 'No followers yet'}</div>`; return; }
        await fetchBadges(ids);
        list.innerHTML = ids.map(uid => {
            const pr = profMap[uid] || {};
            const name = pr.username || (isAr() ? 'لاعب' : 'Player');
            return `<div class="fl-row" onclick="window.openUserProfile('${esc(uid)}')">
                <img class="post-avatar" src="${esc(avatarUrl(name))}" onerror="this.style.display='none'">
                <div class="post-meta">
                    <div class="post-author">${esc(name)}${badgeHtml(uid)}</div>
                    ${pr.username ? `<div class="post-handle">@${esc(pr.username)}</div>` : ''}
                </div>
            </div>`;
        }).join('');
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
            notifyUser(uid, 'follow');
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
                { icon: '🚀', label: isAr() ? 'تعزيز المنشور' : 'Boost post', action: () => {
                    if (!isPro()) {
                        if (typeof window.openSubscriptions === 'function') window.openSubscriptions();
                        else toast(isAr() ? 'التعزيز متاح للمشتركين فقط' : 'Boosting is for subscribers only');
                        return;
                    }
                    if (typeof window.zeloOpenBoost === 'function') window.zeloOpenBoost(id);
                    else toast(isAr() ? 'التعزيز غير متاح حالياً' : 'Boost is not available right now');
                } },
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
        /* شاشة كاملة قابلة للتمرير */
        .pc-overlay { position: fixed; inset: 0; z-index: 4500; background: #0a1033; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; animation: zhFade 0.18s ease-out; }
        .pc-sheet { width: 100%; max-width: 520px; min-height: 100%; margin: 0 auto; background: #0a1033; position: relative; padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px)); }
        .pc-cover { height: 110px; background: linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a); }
        .pc-close { position: fixed; top: calc(10px + env(safe-area-inset-top, 0px)); inset-inline-start: 12px; z-index: 2; width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(0,0,0,0.6); color: #fff; font-size: 1.2rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pc-top { display: flex; justify-content: space-between; align-items: flex-end; padding: 0 16px; margin-top: -36px; }
        .pc-avatar { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; border: 4px solid #0a1033; background: #0a1033; }
        .pc-btns { display: flex; gap: 8px; padding-bottom: 4px; }
        .pc-btn { border: 1px solid rgba(255,255,255,0.25); background: transparent; color: #fff; padding: 8px 16px; border-radius: 999px; font-weight: 900; font-size: 0.85rem; cursor: pointer; }
        .pc-btn.main { background: #fff; color: #000; border: none; }
        .pc-btn.on { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.25); }
        .pc-info { padding: 10px 16px 0; }
        .pc-name { color: #fff; font-weight: 900; font-size: 1.15rem; display: flex; align-items: center; gap: 4px; }
        .pc-handle { color: #7782b0; font-size: 0.85rem; direction: ltr; text-align: start; }
        .pc-stats { display: flex; gap: 18px; padding: 12px 16px; color: #9aa6d6; font-size: 0.85rem; }
        .pc-stats b { color: #fff; font-weight: 900; }
        .pc-tab { padding: 10px 16px; color: #fff; font-weight: 900; border-bottom: 3px solid #f5c35a; display: inline-block; margin-inline-start: 16px; }
        .pc-posts { border-top: 1px solid rgba(255,255,255,0.08); }
        .pc-post { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #e2e8f0; font-size: 0.86rem; line-height: 1.6; word-break: break-word; }
        .pc-post .t { color: #7782b0; font-size: 0.68rem; font-weight: 700; margin-bottom: 4px; }
        .pc-post img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 12px; margin-top: 8px; }
        .pc-empty { padding: 24px; text-align: center; color: #7782b0; font-weight: 700; }`;
        document.head.appendChild(s);
    })();

    let pcPushed = false;
    function onPcPop() {
        pcPushed = false; // زر الرجوع في الهاتف أغلق الصفحة
        const o = document.getElementById('pc-overlay');
        if (o) o.remove();
        window.removeEventListener('popstate', onPcPop);
    }
    window.closeUserProfile = function () {
        const o = document.getElementById('pc-overlay');
        if (o) o.remove();
        window.removeEventListener('popstate', onPcPop);
        if (pcPushed) { pcPushed = false; try { history.back(); } catch (e) {} }
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
        ov.innerHTML = `<div class="pc-sheet"><button class="pc-close" onclick="window.closeUserProfile()">${isAr() ? '→' : '←'}</button><div class="pc-empty">${isAr() ? 'جارٍ التحميل...' : 'Loading...'}</div></div>`;
        document.body.appendChild(ov);
        try { history.pushState({ pc: 1 }, ''); pcPushed = true; window.addEventListener('popstate', onPcPop); } catch (e) {}

        const count = (table, col) =>
            c.from(table).select('*', { count: 'exact', head: true }).eq(col, uid);
        const [, followers, following, postsCount, postsRes] = await Promise.all([
            fetchBadges([uid]),
            count('user_follows', 'following_id'),
            count('user_follows', 'follower_id'),
            count('posts', 'user_id'),
            c.from('posts').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
        ]);

        const handle = handleOf(uid);
        const followed = followSet.has(uid);
        const posts = postsRes.data || [];
        await loadPostStats(posts);
        const nf = followers.count || 0;

        const buttons = isMe ? '' : `
            <button class="pc-btn" id="pc-msg">${isAr() ? 'رسالة' : 'Message'}</button>
            <button class="pc-btn ${followed ? 'on' : 'main'}" id="pc-follow">${followed ? (isAr() ? 'متابَع' : 'Following') : (isAr() ? 'متابعة' : 'Follow')}</button>`;

        ov.firstElementChild.innerHTML = `
            <button class="pc-close" onclick="window.closeUserProfile()">${isAr() ? '→' : '←'}</button>
            <div class="pc-cover"></div>
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
                    <div class="pc-post" data-pid="${p.id}">
                        <div class="pc-post-body" onclick="window.openPostPage(${p.id})">
                            <div class="t">${timeHtml(p.created_at)}</div>
                            ${esc(p.content)}
                            ${p.image_url ? `<img src="${esc(p.image_url)}" onerror="this.style.display='none'">` : ''}
                        </div>
                        <div class="post-actions">${actionsHtml(postCache[p.id] || p)}</div>
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
        pendingTopic = { type: null, name: '', nameB: '' };
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
                    <textarea id="new-post-text" maxlength="${postLimit()}"
                              placeholder="${isAr() ? 'ماذا يحدث؟' : "What's happening?"}"></textarea>
                    <div id="composer-preview"></div>
                </div>
            </div>
            ${topicBoxHtml()}
            <div class="compose-tools" style="flex-wrap:wrap;">
                <div id="compose-notice" style="display:none; flex:0 0 100%; align-items:center; justify-content:space-between; gap:10px;
                     background:rgba(17,26,74,0.95); border:1px solid rgba(245,195,90,0.3); border-radius:14px;
                     padding:8px 12px; color:#f8fafc; font-size:0.82rem; font-weight:800;"></div>
                <label class="tool-btn" style="margin:0;">
                    📷 ${isAr() ? 'إضافة صورة' : 'Add image'}
                    <input type="file" accept="image/*" style="display:none;" onchange="window.pickPostImage(this)">
                </label>
                <button type="button" class="tool-btn" style="margin:0;" onclick="window.pickPostVideo()">
                    🎬 ${isAr() ? 'فيديو' : 'Video'}
                </button>
                <div id="post-counter" style="margin-inline-start:auto; display:flex; align-items:center; gap:6px; font-variant-numeric:tabular-nums; font-size:0.85rem; font-weight:800;"></div>
            </div>
        `;
        document.body.appendChild(ov);
        {
            const ta = document.getElementById('new-post-text');
            const cnt = document.getElementById('post-counter');
            const notice = document.getElementById('compose-notice');
            const postBtn = ov.querySelector('.compose-post-btn');
            const C = 2 * Math.PI * 10;   // محيط دائرة العدّاد
            const upd = () => {
                const max = isPro() ? PRO_POST_MAX : FREE_POST_MAX;
                ta.maxLength = PRO_POST_MAX;                  // سقف صلب؛ والحد الفعلي يُحسب بالعدّاد
                const left = max - ta.value.length;
                const ratio = Math.min(1, ta.value.length / max);
                const color = left < 0 ? '#f4212e' : (left <= 20 ? '#f5c35a' : '#7f9bff');
                cnt.innerHTML = `
                    <svg width="26" height="26" viewBox="0 0 26 26" style="transform:rotate(-90deg);">
                        <circle cx="13" cy="13" r="10" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2.5"/>
                        <circle cx="13" cy="13" r="10" fill="none" stroke="${color}" stroke-width="2.5"
                                stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ratio)}" stroke-linecap="round"/>
                    </svg>
                    <span style="color:${left < 0 ? '#f4212e' : (left <= 20 ? '#f5c35a' : '#9aa6d6')};">${left}</span>`;
                const over = left < 0;
                if (postBtn) postBtn.style.opacity = over ? '0.5' : '1';
                if (over) {
                    window.zeloComposeNotice(isAr() ? '✍️ تجاوزت الحد. اشترك لتكتب حتى ' + PRO_POST_MAX + ' حرف' : '✍️ Over the limit. Subscribe to write up to ' + PRO_POST_MAX + ' characters', true, 'over');
                } else if (notice && notice.dataset.kind === 'over') {
                    notice.style.display = 'none';
                }
            };
            ta.addEventListener('input', upd);
            upd();
            if (window.ZeloPremium) window.ZeloPremium.isPremium().then(upd);
        }
        setTimeout(() => document.getElementById('new-post-text')?.focus(), 150);
    };

    // رسالة صغيرة في شريط الأدوات؛ withBtn: يضيف زر "اشترك"
    window.zeloComposeNotice = function(text, withBtn, kind) {
        const n = document.getElementById('compose-notice');
        if (!n) return;
        n.dataset.kind = kind || '';
        n.style.display = 'flex';
        n.innerHTML = `<span>${esc(text)}</span>` + (withBtn
            ? `<button type="button" class="btn-action" onclick="window.openSubscriptions && window.openSubscriptions()"
                       style="flex-shrink:0; width:auto; margin-top:0; padding:7px 18px; font-size:0.82rem; border-radius:999px;">${isAr() ? 'اشترك' : 'Subscribe'}</button>` : '');
    };

    // زر رفع الفيديو: لغير المشترك رسالة اشتراك، وللمشترك "قريباً" إلى أن تُبنى الميزة
    const VIDEO_MAX_BYTES = 30 * 1024 * 1024;  // 30MB
    const VIDEO_MAX_SECONDS = 60;

    window.pickPostVideo = async function() {
        const ok = window.ZeloPremium ? await window.ZeloPremium.isPremium() : false;
        if (!ok) {
            window.zeloComposeNotice(isAr() ? '🎬 اشترك لكي تستطيع نشر فيديوهات' : '🎬 Subscribe to post videos', true, 'video');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4';
        input.onchange = () => handleVideoFile(input.files && input.files[0]);
        input.click();
    };

    async function handleVideoFile(file) {
        if (!file) return;
        const isMp4 = file.type === 'video/mp4' || /\.mp4$/i.test(file.name || '');
        if (!isMp4) { alert(isAr() ? 'الصيغة المقبولة MP4 فقط.' : 'Only MP4 files are allowed.'); return; }
        if (file.size > VIDEO_MAX_BYTES) { alert(isAr() ? 'حجم الفيديو يتجاوز 30 ميغابايت.' : 'Video is larger than 30 MB.'); return; }

        const url = URL.createObjectURL(file);
        const probe = document.createElement('video');
        probe.preload = 'metadata';
        probe.src = url;
        const duration = await new Promise(resolve => {
            probe.onloadedmetadata = () => resolve(probe.duration);
            probe.onerror = () => resolve(NaN);
        });
        if (!isFinite(duration)) { URL.revokeObjectURL(url); alert(isAr() ? 'تعذّر قراءة الفيديو.' : 'Could not read the video.'); return; }
        if (duration > VIDEO_MAX_SECONDS) { URL.revokeObjectURL(url); alert(isAr() ? 'مدة الفيديو يجب ألا تتجاوز 60 ثانية.' : 'Video must be 60 seconds or less.'); return; }

        pendingVideo = file;
        pendingImage = '';
        const pv = document.getElementById('composer-preview');
        if (pv) pv.innerHTML = `
            <div class="img-preview">
                <video src="${url}" controls muted playsinline style="max-width:100%;border-radius:12px;"></video>
                <button class="img-remove" onclick="window.clearPostImage()">✕</button>
            </div>`;
    }

    window.closeCompose = function() {
        document.getElementById('compose-overlay')?.remove();
        pendingImage = '';
        pendingTopic = { type: null, name: '', nameB: '' };
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
            'border-radius:50%; background: #2c4bb5; color:#fff; display:flex; align-items:center; justify-content:center;' +
            'font-size:1.2rem; font-weight:900; box-shadow:0 4px 14px rgba(44,75,181,0.5); opacity:0; pointer-events:none;' +
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

    // ===================== عارض الفيديو بملء الشاشة (على طريقة X) =====================
    function ensureVideoViewerStyles() {
        if (document.getElementById('zvv-styles')) return;
        const s = document.createElement('style');
        s.id = 'zvv-styles';
        s.textContent = `
            #zvv { position: fixed; inset: 0; z-index: 4700; background: #000; }
            #zvv .zvv-feed { height: 100%; overflow-y: scroll; scroll-snap-type: y mandatory; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
            #zvv .zvv-feed::-webkit-scrollbar { display: none; }
            #zvv .zvv-item { position: relative; height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; background: #000; overflow: hidden; }
            #zvv video { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
            #zvv .zvv-close, #zvv .zvv-mute { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; font-size: 18px; z-index: 5; display: flex; align-items: center; justify-content: center; }
            #zvv .zvv-close { inset-inline-start: 12px; }
            #zvv .zvv-mute { inset-inline-end: 12px; }
            #zvv .zvv-info { position: absolute; inset-inline: 14px 74px; bottom: calc(26px + env(safe-area-inset-bottom, 0px)); color: #fff; z-index: 4; text-shadow: 0 1px 5px #000; }
            #zvv .zvv-user { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
            #zvv .zvv-user img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; cursor: pointer; flex-shrink: 0; }
            #zvv .zvv-names { min-width: 0; flex: 1; cursor: pointer; }
            #zvv .zvv-name { font-weight: 800; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #zvv .zvv-handle { font-size: 12px; opacity: .8; direction: ltr; text-align: start; }
            #zvv .zvv-follow { border: 0; border-radius: 18px; padding: 6px 14px; font-weight: 800; font-size: 13px; background: #fff; color: #000; flex-shrink: 0; }
            #zvv .zvv-follow.on { background: transparent; color: #fff; border: 1px solid #fff; }
            #zvv .zvv-text { font-size: 14px; line-height: 1.5; max-height: 4.5em; overflow: hidden; }
            #zvv .zvv-actions { position: absolute; inset-inline-end: 10px; bottom: calc(40px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 18px; z-index: 4; align-items: center; }
            #zvv .zvv-act { background: none; border: 0; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 12px; text-shadow: 0 1px 4px #000; padding: 0; }
            #zvv .zvv-act svg { width: 28px; height: 28px; filter: drop-shadow(0 1px 3px rgba(0,0,0,.7)); }
            #zvv .zvv-act.liked { color: #ff3b6b; }
            #zvv .zvv-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.25); z-index: 5; direction: ltr; }
            #zvv .zvv-bar i { display: block; height: 100%; width: 0; background: #fff; }
            #zvv .zvv-pp { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 64px; color: #fff; opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 3; }
            #zvv .zvv-pp.show { opacity: .85; }
        `;
        document.head.appendChild(s);
    }

    let zvvIO = null;
    let zvvMuted = false;
    let zvvKeyHandler = null;

    // قائمة الفيديوهات بنفس ترتيبها في الخلاصة (بدون تكرار)
    function zvvCollectIds(startId) {
        const seen = new Set();
        const ids = [];
        document.querySelectorAll('.post-card[data-pid]').forEach(el => {
            const id = el.dataset.pid;
            const p = postCache[id];
            if (p && p.video_url && !seen.has(id)) { seen.add(id); ids.push(id); }
        });
        if (!seen.has(String(startId)) && postCache[startId] && postCache[startId].video_url) ids.unshift(String(startId));
        return ids;
    }

    function zvvItemHtml(p) {
        const mine = String(p.user_id) === me().id;
        const followed = followSet.has(String(p.user_id));
        const handle = handleOf(p.user_id);
        return `
            <div class="zvv-item" data-pid="${p.id}" data-uid="${esc(p.user_id)}">
                <video src="${esc(p.video_url)}" playsinline loop preload="auto"></video>
                <div class="zvv-pp">▶</div>
                <div class="zvv-info">
                    <div class="zvv-user">
                        <img src="${esc(avatarUrl(p.author_name, p.author_avatar))}" onclick="window.zvvOpenUser('${esc(p.user_id)}')" onerror="this.style.display='none'">
                        <div class="zvv-names" onclick="window.zvvOpenUser('${esc(p.user_id)}')">
                            <div class="zvv-name">${esc(p.author_name)}${badgeHtml(p.user_id)}</div>
                            ${handle ? `<div class="zvv-handle">@${esc(handle)}</div>` : ''}
                        </div>
                        ${mine ? '' : `<button class="zvv-follow ${followed ? 'on' : ''}" data-follow="${esc(p.user_id)}" onclick="window.zvvFollow('${esc(p.user_id)}')">${followed ? (isAr() ? 'متابَع' : 'Following') : (isAr() ? 'متابعة' : 'Follow')}</button>`}
                    </div>
                    ${p.content ? `<div class="zvv-text">${esc(p.content).replace(/\n/g, '<br>')}</div>` : ''}
                </div>
                <div class="zvv-actions">${zvvActionsHtml(p)}</div>
                <div class="zvv-bar"><i></i></div>
            </div>`;
    }

    function zvvActionsHtml(p) {
        return `
            <button class="zvv-act ${p.liked ? 'liked' : ''}" onclick="window.zvvLike(${p.id})">${ICONS.heart(p.liked)}<span>${p.likes || 0}</span></button>
            <button class="zvv-act" onclick="window.openReply(${p.id})">${ICONS.reply}<span>${p.comments || 0}</span></button>
            <button class="zvv-act ${p.reposted ? 'liked' : ''}" onclick="window.zvvRepost(${p.id})">${ICONS.repost}<span>${p.reposts || 0}</span></button>
            <button class="zvv-act" onclick="window.sharePost(${p.id})">${ICONS.share}</button>`;
    }

    function zvvRefreshActions(id) {
        const p = postCache[id];
        const box = document.querySelector(`#zvv .zvv-item[data-pid="${id}"] .zvv-actions`);
        if (p && box) box.innerHTML = zvvActionsHtml(p);
    }

    window.zvvLike = async function (id) { await window.toggleLike(id); zvvRefreshActions(id); };
    window.zvvRepost = async function (id) { await window.toggleRepost(id); zvvRefreshActions(id); };
    window.zvvFollow = async function (uid) {
        await toggleFollow(uid);
        const on = followSet.has(String(uid));
        document.querySelectorAll('#zvv .zvv-follow').forEach(b => {
            if (b.dataset.follow === String(uid)) {
                b.classList.toggle('on', on);
                b.textContent = on ? (isAr() ? 'متابَع' : 'Following') : (isAr() ? 'متابعة' : 'Follow');
            }
        });
    };
    window.zvvOpenUser = function (uid) {
        window.closeVideoViewer();
        if (typeof window.openUserProfile === 'function') window.openUserProfile(uid);
    };

    window.openVideoViewer = function (startId) {
        const ids = zvvCollectIds(startId);
        if (!ids.length) return;
        ensureVideoViewerStyles();
        if (document.getElementById('zvv')) window.closeVideoViewer();

        // أوقف فيديوهات الخلاصة أثناء العرض
        document.querySelectorAll('video.post-video').forEach(v => v.pause());

        const root = document.createElement('div');
        root.id = 'zvv';
        root.dir = isAr() ? 'rtl' : 'ltr';
        root.innerHTML = `
            <button class="zvv-close" onclick="window.closeVideoViewer()" aria-label="close">✕</button>
            <button class="zvv-mute" id="zvv-mute" aria-label="sound">${zvvMuted ? '🔇' : '🔊'}</button>
            <div class="zvv-feed">${ids.map(id => zvvItemHtml(postCache[id])).join('')}</div>`;
        document.body.appendChild(root);

        const feed = root.querySelector('.zvv-feed');
        const items = [...feed.querySelectorAll('.zvv-item')];

        // الصوت وشريط التقدّم والضغط للإيقاف/التشغيل
        items.forEach(it => {
            const v = it.querySelector('video');
            const bar = it.querySelector('.zvv-bar i');
            const pp = it.querySelector('.zvv-pp');
            v.muted = zvvMuted;
            v.addEventListener('timeupdate', () => { if (v.duration) bar.style.width = (v.currentTime / v.duration * 100) + '%'; });
            v.addEventListener('click', () => {
                if (v.paused) { v.play().catch(() => {}); pp.textContent = '▶'; }
                else { v.pause(); pp.textContent = '⏸'; }
                pp.classList.add('show');
                setTimeout(() => pp.classList.remove('show'), 500);
            });
        });
        root.querySelector('#zvv-mute').onclick = e => {
            zvvMuted = !zvvMuted;
            items.forEach(it => { it.querySelector('video').muted = zvvMuted; });
            e.currentTarget.textContent = zvvMuted ? '🔇' : '🔊';
        };

        // شغّل الفيديو الظاهر فقط
        const viewed = new Set();
        zvvIO = new IntersectionObserver(entries => {
            entries.forEach(en => {
                const v = en.target.querySelector('video');
                if (en.isIntersecting && en.intersectionRatio >= 0.7) {
                    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
                    const pid = en.target.dataset.pid;
                    if (!viewed.has(pid)) {
                        viewed.add(pid);
                        const p = postCache[pid];
                        if (p && !p.viewedByMe) recordView(Number(pid) || pid).catch(() => {});
                    }
                } else {
                    v.pause();
                }
            });
        }, { root: feed, threshold: [0, 0.7] });
        items.forEach(it => zvvIO.observe(it));

        // انتقل إلى الفيديو الذي ضغط عليه المستخدم
        const idx = Math.max(0, ids.indexOf(String(startId)));
        if (items[idx]) items[idx].scrollIntoView();

        zvvKeyHandler = e => { if (e.key === 'Escape') window.closeVideoViewer(); };
        document.addEventListener('keydown', zvvKeyHandler);
    };

    window.closeVideoViewer = function () {
        const root = document.getElementById('zvv');
        if (zvvIO) { zvvIO.disconnect(); zvvIO = null; }
        if (zvvKeyHandler) { document.removeEventListener('keydown', zvvKeyHandler); zvvKeyHandler = null; }
        if (root) {
            root.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
            root.remove();
        }
        // أعد تشغيل فيديو الخلاصة الظاهر
        if (typeof observeVideos === 'function') observeVideos();
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
