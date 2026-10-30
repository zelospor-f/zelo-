(function() {
    const LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const isAr = () => String(US().lang || LS.get('app_lang') || 'ar').startsWith('ar');
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

    // ===== الكتالوج =====
    // لإضافة بطاقة: أضف سطراً هنا. ضع رابط صورتك المرخّصة/الأصلية في الحقل image
    // وإن تُرك فارغاً تُرسم بطاقة تلقائية (رقم + علم + ألوان).
    const CATS = [
        { id: 'all',    ar: 'الكل',     en: 'All' },
        { id: 'mythic',  ar: 'خرافية ✨', en: 'Mythic ✨' },
        { id: 'evolve',  ar: 'متطورة 🧬', en: 'Evolving 🧬' },
        { id: 'limited', ar: 'محدودة ⏳', en: 'Limited ⏳' },
        { id: 'arab',   ar: 'عربي',     en: 'Arab' },
        { id: 'europe', ar: 'أوروبي',   en: 'European' },
        { id: 'german', ar: 'ألماني',   en: 'German' },
        { id: 'world',  ar: 'عالمي',    en: 'World' }
    ];
    const NFT_ITEMS = [
        // عربي
        { id: 'nft_ar_falcon',  cat: 'arab',   ar: 'الصقر الأخضر',   en: 'Green Falcon',   rarity: 'LEGENDARY', max: 25, price: 1.5, flag: '🇸🇦', no: 10, c1: '#0a7a3d', c2: '#04210f', image: '' },
        { id: 'nft_ar_pharaoh', cat: 'arab',   ar: 'الفرعون',        en: 'The Pharaoh',    rarity: 'LEGENDARY', max: 25, price: 1.4, flag: '🇪🇬', no: 11, c1: '#b3121f', c2: '#1a0407', image: '' },
        { id: 'nft_ar_atlas',   cat: 'arab',   ar: 'أسد الأطلس',     en: 'Atlas Lion',     rarity: 'EPIC',      price: 1.0, flag: '🇲🇦', no: 7,  c1: '#c1272d', c2: '#0b3d1e', image: '' },
        { id: 'nft_ar_desert',  cat: 'arab',   ar: 'نمر الصحراء',    en: 'Desert Tiger',   rarity: 'RARE',      price: 0.7, flag: '🇩🇿', no: 9,  c1: '#0f7a3a', c2: '#e8e8e8', image: '' },
        { id: 'nft_ar_carthage',cat: 'arab',   ar: 'نسر قرطاج',      en: 'Carthage Eagle', rarity: 'RARE',      price: 0.7, flag: '🇹🇳', no: 8,  c1: '#d11a2a', c2: '#3a0509', image: '' },
        { id: 'nft_ar_gulf',    cat: 'arab',   ar: 'عنابي الخليج',   en: 'Gulf Maroon',    rarity: 'EPIC',      price: 0.9, flag: '🇶🇦', no: 19, c1: '#8a1538', c2: '#2b0511', image: '' },
        // أوروبي
        { id: 'nft_eu_matador', cat: 'europe', ar: 'الماتادور',      en: 'The Matador',    rarity: 'LEGENDARY', max: 25, price: 1.5, flag: '🇪🇸', no: 8,  c1: '#c60b1e', c2: '#ffc400', image: '' },
        { id: 'nft_eu_azzurri', cat: 'europe', ar: 'الأزرق الإيطالي',en: 'Azzurri Wall',   rarity: 'EPIC',      price: 1.1, flag: '🇮🇹', no: 1,  c1: '#0b4fb3', c2: '#041a3d', image: '' },
        { id: 'nft_eu_lion',    cat: 'europe', ar: 'الأسد الإنجليزي',en: 'Three Lions',    rarity: 'EPIC',      price: 1.1, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', no: 9,  c1: '#ffffff', c2: '#c8102e', image: '' },
        { id: 'nft_eu_rooster', cat: 'europe', ar: 'الديك الفرنسي',  en: 'French Rooster', rarity: 'LEGENDARY', max: 25, price: 1.3, flag: '🇫🇷', no: 10, c1: '#0055a4', c2: '#ef4135', image: '' },
        { id: 'nft_eu_orange',  cat: 'europe', ar: 'البرتقالي',      en: 'Total Orange',   rarity: 'RARE',      price: 0.8, flag: '🇳🇱', no: 14, c1: '#ff6a00', c2: '#2a1100', image: '' },
        { id: 'nft_eu_seleccao',cat: 'europe', ar: 'ساحر البرتغال',  en: 'Seleção Magic',  rarity: 'LEGENDARY', max: 25, price: 1.4, flag: '🇵🇹', no: 7,  c1: '#046a38', c2: '#da291c', image: '' },
        // ألماني
        { id: 'nft_de_panzer',  cat: 'german', ar: 'البانزر',        en: 'The Panzer',     rarity: 'EPIC',      price: 1.0, flag: '🇩🇪', no: 13, c1: '#111111', c2: '#dd0000', image: '' },
        { id: 'nft_de_kaiser',  cat: 'german', ar: 'القيصر',         en: 'The Kaiser',     rarity: 'LEGENDARY', max: 25, price: 1.5, flag: '🇩🇪', no: 5,  c1: '#ffce00', c2: '#111111', image: '' },
        { id: 'nft_de_keeper',  cat: 'german', ar: 'الحارس الحديدي', en: 'Iron Keeper',    rarity: 'RARE',      price: 0.8, flag: '🇩🇪', no: 1,  c1: '#dd0000', c2: '#1b1b1b', image: '' },
        // عالمي
        { id: 'nft_wd_goat',    cat: 'world',  ar: 'الأسطورة الزرقاء', en: 'Sky Legend',   rarity: 'LEGENDARY', max: 25, price: 1.6, flag: '🇦🇷', no: 10, c1: '#75aadb', c2: '#ffffff', image: '' },
        { id: 'nft_wd_samba',   cat: 'world',  ar: 'ساحر السامبا',   en: 'Samba Wizard',   rarity: 'LEGENDARY', max: 25, price: 1.4, flag: '🇧🇷', no: 10, c1: '#ffdf00', c2: '#009c3b', image: '' },
        { id: 'nft_wd_samurai', cat: 'world',  ar: 'الساموراي',      en: 'Blue Samurai',   rarity: 'RARE',      price: 0.7, flag: '🇯🇵', no: 11, c1: '#1c3f94', c2: '#050b1f', image: '' },
        // ✨ خرافية متحركة (Mythic): لمعان + هالة + شرارات + إطار متدرّج
        { id: 'nft_my_phoenix', cat: 'world', ar: 'العنقاء الذهبية', en: 'Golden Phoenix', rarity: 'MYTHIC', max: 5, price: 3.0, flag: '🔥', no: 1,  c1: '#ff9a00', c2: '#3a0a00', image: '' },
        { id: 'nft_my_nebula',  cat: 'world', ar: 'سديم النجوم',    en: 'Star Nebula',    rarity: 'MYTHIC', max: 5, price: 3.5, flag: '🌌', no: 99, c1: '#7b2ff7', c2: '#050014', image: '' },
        { id: 'nft_my_aurora',  cat: 'world', ar: 'الشفق الزمردي',  en: 'Emerald Aurora', rarity: 'MYTHIC', max: 7, price: 2.8, flag: '💎', no: 7,  c1: '#00ffa3', c2: '#021a14', image: '' },
        // 🧬 متطورة: يرتقي مستواها (برونزي ← ألماسي) حسب نشاط صاحبها
        { id: 'nft_ev_riser',   cat: 'world', ar: 'الصاعد', en: 'The Riser',   rarity: 'EPIC', price: 0.6, flag: '⚡', no: 1, c1: '#4a6cff', c2: '#04101f', evolves: true, image: '' },
        { id: 'nft_ev_captain', cat: 'arab',  ar: 'القائد', en: 'The Captain', rarity: 'EPIC', price: 0.8, flag: '🛡️', no: 10, c1: '#f5c35a', c2: '#03170f', evolves: true, image: '' },
        // ⏳ إصدار موسمي محدود بعدّاد تنازلي
        { id: 'nft_ss_winter',  cat: 'world', ar: 'كأس الشتاء', en: 'Winter Cup', rarity: 'LEGENDARY', max: 20, price: 1.8, flag: '🏆', no: 26, c1: '#00c6ff', c2: '#0a1b3d', until: '2026-12-31T23:59:59Z', image: '' }
    ];
    const RARITY_COLOR = { MYTHIC: '#ff2e97', LEGENDARY: '#f5c35a', EPIC: '#a855f7', RARE: '#4a6cff' };

    // ===== مستويات التطور (تعتمد على نقاط نشاط اللاعب) =====
    // عرّف window.getNftActivityScore() لتعيد نقاط نشاط اللاعب، وإلا تُستخدم userState.xp / points / score
    const TIERS = [
        { id: 'bronze',  min: 0,    ar: 'برونزي', en: 'Bronze',  color: '#cd7f32' },
        { id: 'silver',  min: 100,  ar: 'فضي',    en: 'Silver',  color: '#c0c0c0' },
        { id: 'gold',    min: 500,  ar: 'ذهبي',   en: 'Gold',    color: '#f5c35a' },
        { id: 'diamond', min: 2000, ar: 'ألماسي', en: 'Diamond', color: '#7df9ff' }
    ];
    function activityScore() {
        if (typeof window.getNftActivityScore === 'function') {
            try { const v = Number(window.getNftActivityScore()); if (isFinite(v)) return v; } catch (e) {}
        }
        const u = US();
        return Number(u.xp ?? u.points ?? u.score ?? 0) || 0;
    }
    function tierOf() {
        const sc = activityScore();
        let t = TIERS[0];
        for (const x of TIERS) if (sc >= x.min) t = x;
        return t;
    }
    function nextTier(t) { return TIERS[TIERS.indexOf(t) + 1]; }

    // ===== الإصدارات المحدودة =====
    let supply = {};          // nft_id -> عدد المباع
    let supplyLoadedAt = 0;
    let catalog = {};         // nft_id -> { price_points } من قاعدة البيانات
    const POINTS_PER_USD = 100;    // احتياطي فقط: السعر الحقيقي يأتي من جدول nft_points_prices
    function priceOf(it) {
        const c = catalog[it.id];
        return { points: c ? Number(c.price_points) : Math.round(it.price * POINTS_PER_USD) };
    }
    function fmtPts(n) { return Number(n).toLocaleString('en-US'); }
    const COIN_ICON = 'https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png';
    function priceText(it) { return '<img src="' + COIN_ICON + '" alt="" style="width:15px;height:15px;vertical-align:-3px;margin-inline-end:4px;object-fit:contain">' + fmtPts(priceOf(it).points); }
    async function loadSupply() {
        const c = db();
        if (!c) return false;
        try {
            const [sup, cat] = await Promise.all([
                c.from('nft_supply').select('nft_id,sold'),
                c.from('nft_points_prices').select('nft_id,price_points')
            ]);
            let changed = false;
            if (!sup.error && sup.data) {
                const m = {};
                sup.data.forEach(r => { m[r.nft_id] = Number(r.sold) || 0; });
                if (JSON.stringify(m) !== JSON.stringify(supply)) { supply = m; changed = true; }
            }
            if (!cat.error && cat.data) {
                const k = {};
                cat.data.forEach(r => { k[r.nft_id] = r; });
                if (JSON.stringify(k) !== JSON.stringify(catalog)) { catalog = k; changed = true; }
            }
            return changed;
        } catch (e) { return false; }
    }
    function remaining(it) { return it.max ? Math.max(0, it.max - (supply[it.id] || 0)) : null; }
    function expired(it) { return !!it.until && Date.now() > Date.parse(it.until); }
    function fmtLeft(ms, ar) {
        const s = Math.max(0, Math.floor(ms / 1000));
        const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
        if (d > 0) return ar ? `${d}ي ${h}س ${m}د` : `${d}d ${h}h ${m}m`;
        return ar ? `${h}س ${m}د ${sec}ث` : `${h}h ${m}m ${sec}s`;
    }
    function serials() { try { return JSON.parse(LS.get('zelo_nft_serials') || '{}'); } catch (e) { return {}; } }
    function saveSerial(id, n) { const m = serials(); m[id] = n; LS.set('zelo_nft_serials', JSON.stringify(m)); }

    // صورة البطاقة: رابط image إن وُجد، وإلا بطاقة SVG أصلية مرسومة تلقائياً
    // (ملاحظة: حركات SVG تعمل أيضاً عند استخدامها داخل <img> أو كصورة شخصية)
    function nftImage(it, owned) {
        if (it.image) return it.image;
        const dark = ['#ffffff', '#ffce00', '#ffdf00', '#75aadb'].includes(it.c1);
        const fg = dark ? '#0a0a0a' : '#ffffff';
        const own = (owned === undefined) ? ownedList().includes(it.id) : owned;
        let extras = '';

        if (it.rarity === 'MYTHIC') {
            const sparks = [40, 85, 130, 175, 215, 110].map((x, i) => `
                <circle cx="${x}" cy="240" r="${2 + i % 3}" fill="#fff">
                    <animate attributeName="cy" from="250" to="20" dur="${3 + i * 0.5}s" begin="${i * 0.6}s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0;1;0" dur="${3 + i * 0.5}s" begin="${i * 0.6}s" repeatCount="indefinite"/>
                </circle>`).join('');
            extras = `
            <defs>
                <linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
                <clipPath id="cp"><rect width="256" height="256" rx="28"/></clipPath>
            </defs>
            <g clip-path="url(#cp)"><g transform="skewX(-20)"><rect x="-200" y="-20" width="70" height="300" fill="url(#sh)"><animate attributeName="x" from="-200" to="360" dur="3.2s" repeatCount="indefinite"/></rect></g></g>
            <circle cx="128" cy="116" r="86" fill="none" stroke="#fff" stroke-width="3"><animate attributeName="r" values="80;92;80" dur="2.4s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.15;0.7;0.15" dur="2.4s" repeatCount="indefinite"/></circle>
            ${sparks}
            <rect x="3" y="3" width="250" height="250" rx="26" fill="none" stroke-width="4"><animate attributeName="stroke" values="#ff2e97;#f5c35a;#f5c35a;#4a6cff;#ff2e97" dur="4s" repeatCount="indefinite"/></rect>
            <text x="226" y="48" font-family="Arial,sans-serif" font-size="15" font-weight="900" text-anchor="end" fill="${fg}" letter-spacing="2">MYTHIC</text>`;
        } else if (it.evolves) {
            const t = own ? tierOf() : TIERS[0];
            const shine = (t.id === 'gold' || t.id === 'diamond')
                ? `<animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>` : '';
            extras = `
            <rect x="4" y="4" width="248" height="248" rx="26" fill="none" stroke="${t.color}" stroke-width="${t.id === 'bronze' ? 5 : 8}">${shine}</rect>
            <text x="226" y="48" font-family="Arial,sans-serif" font-size="15" font-weight="900" text-anchor="end" fill="${t.color}" letter-spacing="2">${t.en.toUpperCase()}</text>`;
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${it.c1}"/><stop offset="1" stop-color="${it.c2}"/></linearGradient></defs>
            <rect width="256" height="256" rx="28" fill="url(#g)"/>
            <circle cx="128" cy="116" r="78" fill="rgba(0,0,0,0.18)"/>
            <text x="128" y="150" font-family="Arial Black,Arial,sans-serif" font-size="110" font-weight="900" text-anchor="middle" fill="${fg}" fill-opacity="0.92">${it.no}</text>
            <text x="30" y="52" font-size="38">${it.flag}</text>
            <text x="128" y="228" font-family="Arial,sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="${fg}" fill-opacity="0.85" letter-spacing="3">ZELO SPORT</text>
            ${extras}
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function ownedList() {
        if (Array.isArray(US().ownedNfts)) return US().ownedNfts;
        try { return JSON.parse(LS.get('zelo_owned_nfts') || '[]'); } catch (e) { return []; }
    }

    let target = null;
    let ownedLoadedAt = 0;
    let currentCat = 'all';

    window.renderNftMarketPage = function(container) {
        target = container || document.getElementById('main-content') || document.getElementById('app') || document.body;
        if (!target) return;
        const ar = isAr();
        const dir = ar ? 'rtl' : 'ltr';
        const owned = ownedList();
        const currentPhoto = US().photoUrl || LS.get('zelo_photo_url') || '';
        const matchCat = i => currentCat === 'all'
            || (currentCat === 'mythic'  && i.rarity === 'MYTHIC')
            || (currentCat === 'evolve'  && i.evolves)
            || (currentCat === 'limited' && (i.max || i.until))
            || i.cat === currentCat;
        const list = NFT_ITEMS.filter(matchCat);
        if (Date.now() - supplyLoadedAt > 30000) {
            supplyLoadedAt = Date.now();
            loadSupply().then(changed => {
                if (changed && target && target.isConnected && target.querySelector('.nm-wrap')) window.renderNftMarketPage(target);
            });
        }

        if (Date.now() - ownedLoadedAt > 30000) {
            ownedLoadedAt = Date.now();
            loadOwned().then(changed => {
                if (changed && target && target.isConnected && target.querySelector('.nm-wrap')) window.renderNftMarketPage(target);
            });
        }

        const chips = CATS.map(c => `
            <button class="nm-chip ${c.id === currentCat ? 'nm-chip-on' : ''}" onclick="window.nftSetCat('${c.id}')">${ar ? c.ar : c.en}</button>`).join('');

        const cards = list.map(it => {
            const isOwned = owned.includes(it.id);
            const img = nftImage(it);
            const inUse = isOwned && currentPhoto === img;
            const rem = remaining(it);
            const isExp = expired(it);
            const mythic = it.rarity === 'MYTHIC';
            let btn;
            if (inUse) btn = `<button class="nm-btn nm-btn-gray" disabled>✅ ${ar ? 'قيد الاستخدام' : 'In use'}</button>`;
            else if (isOwned) btn = `<button class="nm-btn nm-btn-blue" onclick="window.useNftAvatar('${it.id}')">🖼️ ${ar ? 'اجعلها صورتي' : 'Use as avatar'}</button>`;
            else if (isExp) btn = `<button class="nm-btn nm-btn-gray" disabled>⌛ ${ar ? 'انتهى العرض' : 'Ended'}</button>`;
            else if (rem === 0) btn = `<button class="nm-btn nm-btn-gray" disabled>🚫 ${ar ? 'نفدت الكمية' : 'Sold out'}</button>`;
            else btn = `<button class="nm-btn" onclick="window.buyPlayerNft('${it.id}')">🛒 ${ar ? 'شراء بالنقاط' : 'Buy with points'}</button>`;

            const badgeBg = mythic ? 'linear-gradient(90deg,#ff2e97,#f5c35a)' : (RARITY_COLOR[it.rarity] || '#4a6cff');
            let extra = '';
            if (it.max) {
                const sold = supply[it.id] || 0;
                const pct = Math.min(100, Math.round(sold / it.max * 100));
                extra += `<div class="nm-supply">${ar ? 'المتبقي' : 'Left'} ${rem} / ${it.max}<div class="nm-bar"><i style="width:${pct}%"></i></div></div>`;
            }
            if (it.until && !isExp) {
                extra += `<div class="nm-timer" data-until="${it.until}">⏳ ${fmtLeft(Date.parse(it.until) - Date.now(), ar)}</div>`;
            }
            if (it.evolves) {
                if (isOwned) {
                    const t = tierOf(), n = nextTier(t), sc = activityScore();
                    const pct = n ? Math.max(0, Math.min(100, Math.round((sc - t.min) / (n.min - t.min) * 100))) : 100;
                    extra += `<div class="nm-tier" style="color:${t.color}">🧬 ${ar ? t.ar : t.en}</div><div class="nm-bar"><i style="width:${pct}%;background:${t.color}"></i></div>`;
                } else {
                    extra += `<div class="nm-tier">🧬 ${ar ? 'تتطور مع نشاطك' : 'Evolves with your activity'}</div>`;
                }
            }
            const sn = serials()[it.id];
            const serialHtml = (isOwned && sn > 0) ? `<div class="nm-serial">#${sn}${it.max ? ' / ' + it.max : ''}</div>` : '';
            return `
                <div class="nm-card ${mythic ? 'mythic' : ''}">
                    <span class="nm-rarity" style="background:${badgeBg}">${it.rarity}</span>
                    <img class="nm-img" src="${img}" alt="">
                    <div class="nm-name">${esc(ar ? it.ar : it.en)}</div>
                    ${serialHtml}
                    <div class="nm-price">${priceText(it)}</div>
                    ${extra}
                    ${btn}
                </div>`;
        }).join('');

        target.innerHTML = `
            <style>
                .nm-wrap { width:100%; box-sizing:border-box; padding:4px 0 90px 0; direction:${dir}; color:#fff; }
                .nm-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
                .nm-back { background:rgba(255,255,255,0.08); color:#f5c35a; border:1px solid rgba(245, 195, 90, 0.25); padding:8px 14px; border-radius:20px; font-weight:800; font-size:0.8rem; cursor:pointer; }
                .nm-title { margin:0; font-size:1rem; font-weight:900; color:#f5c35a; }
                .nm-banner { background:rgba(44, 75, 181,0.12); border:1px solid rgba(44, 75, 181,0.3); border-radius:16px; padding:12px 14px; margin-bottom:12px; text-align:center; font-size:0.74rem; color:#94a3b8; }
                .nm-banner b { display:block; color:#fff; font-size:0.85rem; margin-bottom:2px; }
                .nm-chips { display:flex; gap:8px; overflow-x:auto; padding-bottom:10px; margin-bottom:6px; }
                .nm-chips::-webkit-scrollbar { display:none; }
                .nm-chip { flex:0 0 auto; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; padding:7px 16px; border-radius:20px; font-weight:800; font-size:0.78rem; cursor:pointer; }
                .nm-chip-on { background:linear-gradient(135deg,#4a6cff,#f5c35a); color:#04110B; border-color:transparent; }
                .nm-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
                .nm-card { position:relative; background:rgba(10, 16, 51,0.8); border:1px solid rgba(44, 75, 181,0.25); border-radius:18px; padding:10px; text-align:center; }
                .nm-rarity { position:absolute; top:14px; ${ar ? 'left' : 'right'}:14px; font-size:0.52rem; font-weight:900; color:#000; padding:2px 6px; border-radius:6px; z-index:2; }
                .nm-img { width:100%; aspect-ratio:1/1; border-radius:14px; object-fit:cover; display:block; }
                .nm-name { font-size:0.82rem; font-weight:900; margin-top:8px; }
                .nm-price { font-size:0.8rem; font-weight:900; color:#f5c35a; font-family:monospace; margin-top:3px; }
                .nm-btn { width:100%; margin-top:8px; border:none; cursor:pointer; font-weight:900; font-size:0.76rem; padding:9px; border-radius:10px; color:#000; background:linear-gradient(135deg,#f5c35a,#00bc70); }
                .nm-btn-blue { background:linear-gradient(135deg,#4a6cff,#f5c35a); }
                .nm-btn-gray { background:rgba(255,255,255,0.08); color:#cbd5e1; cursor:default; }
                .nm-btn:active:not(:disabled) { transform:scale(0.96); }
                .nm-card.mythic { border-color:transparent; box-shadow:0 0 18px rgba(255,46,151,0.35);
                    background:linear-gradient(rgba(10, 16, 51,0.94),rgba(10, 16, 51,0.94)) padding-box, linear-gradient(120deg,#ff2e97,#f5c35a,#f5c35a,#4a6cff,#ff2e97) border-box;
                    background-size:100% 100%, 300% 300%; animation:nmGlow 4s linear infinite; }
                @keyframes nmGlow { 0% { background-position:0 0, 0% 50%; } 100% { background-position:0 0, 300% 50%; } }
                .nm-supply { font-size:0.68rem; font-weight:800; color:#94a3b8; margin-top:6px; }
                .nm-bar { height:5px; border-radius:4px; background:rgba(255,255,255,0.1); overflow:hidden; margin-top:4px; }
                .nm-bar i { display:block; height:100%; background:linear-gradient(90deg,#14206b,#f5c35a); border-radius:4px; }
                .nm-timer { font-size:0.7rem; font-weight:900; color:#ff6b6b; margin-top:6px; font-family:monospace; }
                .nm-tier { font-size:0.7rem; font-weight:900; color:#94a3b8; margin-top:6px; }
                .nm-serial { font-size:0.68rem; font-weight:900; color:#f5c35a; font-family:monospace; margin-top:2px; }
            </style>
            <div class="nm-wrap">
                <div class="nm-top">
                    <button class="nm-back" onclick="window.nftBackToProfile()">${ar ? '➔ الملف الشخصي' : '➔ Profile'}</button>
                    <h3 class="nm-title">👑 ${ar ? 'سوق بطاقات NFT' : 'NFT Market'}</h3>
                    <div style="width:64px;"></div>
                </div>
                <div class="nm-banner"><b>${ar ? 'اقتنِ بطاقتك واجعلها صورة ملفك الشخصي' : 'Collect a card and use it as your avatar'}</b>${ar ? 'اشترِ البطاقات بنقاطك' : 'Buy cards with your points'}</div>
                <div class="nm-chips">${chips}</div>
                <div class="nm-grid">${cards}</div>
            </div>`;

        clearInterval(window._nmTimer);
        if (target.querySelector('[data-until]')) {
            window._nmTimer = setInterval(() => {
                if (!target.isConnected) { clearInterval(window._nmTimer); return; }
                let ended = false;
                target.querySelectorAll('[data-until]').forEach(el => {
                    const left = Date.parse(el.dataset.until) - Date.now();
                    if (left <= 0) { ended = true; return; }
                    el.textContent = '⏳ ' + fmtLeft(left, ar);
                });
                if (ended) { clearInterval(window._nmTimer); window.renderNftMarketPage(target); }
            }, 1000);
        }
    };

    window.nftSetCat = function(c) { currentCat = c; window.renderNftMarketPage(target); };

    window.nftBackToProfile = function() {
        if (typeof window.renderProfilePage === 'function') window.renderProfilePage(target);
        else if (typeof window.showPage === 'function') window.showPage('profile');
    };

    async function persist(owned, photoUrl) {
        if (typeof userState !== 'undefined') { userState.ownedNfts = owned; userState.photoUrl = photoUrl; }
        LS.set('zelo_owned_nfts', JSON.stringify(owned));
        LS.set('zelo_photo_url', photoUrl);
        const c = db();
        if (c && US().userId) {
            try {
                const { error } = await c.from('users').upsert(
                    { user_id: String(US().userId), photo_url: photoUrl },
                    { onConflict: 'user_id' });
                if (error) console.error('nft save error', error);
            } catch (e) { console.error(e); }
        }
    }

    window.useNftAvatar = async function(id) {
        const it = NFT_ITEMS.find(x => x.id === id);
        if (!it || !ownedList().includes(id)) return;
        await persist(ownedList(), nftImage(it));
        window.nftBackToProfile();
    };

    // ===== الشراء بالنقاط: خصم النقاط ومنح البطاقة يتمان داخل Supabase بعملية واحدة ذرية =====
    function errText(code, ar) {
        const M = {
            already_owned:       ['تملك هذه البطاقة بالفعل', 'You already own this card'],
            sold_out:            ['نفدت الكمية', 'Sold out'],
            ended:               ['انتهى العرض', 'Offer ended'],
            unauthorized:        ['سجّل الدخول أولاً', 'Please sign in first'],
            unknown_nft:         ['البطاقة غير متاحة', 'Card not available'],
            insufficient_points: ['رصيدك من النقاط غير كافٍ', 'Not enough points'],
            user_not_found:      ['تعذّر العثور على حسابك', 'Account not found']
        };
        const m = M[code];
        if (m) return ar ? m[0] : m[1];
        return (ar ? 'تعذّر تنفيذ الطلب' : 'Could not complete the request') + (code ? ' [' + code + ']' : '');
    }

    // الملكية تأتي من قاعدة البيانات فقط (يعيد true إن تغيّرت)
    async function loadOwned() {
        const c = db();
        if (!c) return false;
        try {
            const { data, error } = await c.from('user_nfts').select('nft_id,serial');
            if (error || !data) return false;
            const ids = data.map(x => x.nft_id).sort();
            data.forEach(x => { if (x.serial > 0) saveSerial(x.nft_id, x.serial); });
            const changed = JSON.stringify(ids) !== JSON.stringify([...ownedList()].sort());
            if (typeof userState !== 'undefined') userState.ownedNfts = ids;
            LS.set('zelo_owned_nfts', JSON.stringify(ids));
            return changed;
        } catch (e) { return false; }
    }

    // ---- الشراء بالنقاط ----
    let buying = false;
    async function buyWithPoints(it) {
        if (buying) return;
        const ar = isAr();
        const c = db();
        if (!c) { alert(errText('unauthorized', ar)); return; }
        const price = priceOf(it).points;
        const name = ar ? it.ar : it.en;
        const ok = confirm(ar
            ? `شراء «${name}» مقابل ${fmtPts(price)} نقطة؟`
            : `Buy "${name}" for ${fmtPts(price)} points?`);
        if (!ok) return;
        buying = true;
        try {
            const { data, error } = await c.rpc('buy_nft_with_points', { p_nft_id: it.id });
            if (error) { alert(errText(error.message, ar)); return; }
            if (!data || !data.ok) { alert(errText(data && data.error, ar)); return; }
            if (data.serial > 0) saveSerial(it.id, data.serial);
            // تحديث الرصيد المعروض
            if (typeof userState !== 'undefined') {
                userState.points = Number(data.balance) || 0;
                LS.set('user_coins', String(userState.points));
                if (typeof updateTopBar === 'function') { try { updateTopBar(); } catch (e) {} }
            }
            await Promise.all([loadOwned(), loadSupply()]);
            alert(ar ? '✅ تم الشراء بنجاح!' : '✅ Purchase complete!');
            window.renderNftMarketPage(target);
        } catch (e) {
            alert(errText(String((e && e.message) || ''), ar));
        } finally { buying = false; }
    }

    window.buyPlayerNft = function(id) {
        const it = NFT_ITEMS.find(x => x.id === id);
        if (!it || ownedList().includes(id)) return;
        buyWithPoints(it);
    };
})();
