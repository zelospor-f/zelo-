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
        { id: 'arab',   ar: 'عربي',     en: 'Arab' },
        { id: 'europe', ar: 'أوروبي',   en: 'European' },
        { id: 'german', ar: 'ألماني',   en: 'German' },
        { id: 'world',  ar: 'عالمي',    en: 'World' }
    ];
    const NFT_ITEMS = [
        // عربي
        { id: 'nft_ar_falcon',  cat: 'arab',   ar: 'الصقر الأخضر',   en: 'Green Falcon',   rarity: 'LEGENDARY', price: 1.5, flag: '🇸🇦', no: 10, c1: '#0a7a3d', c2: '#04210f', image: '' },
        { id: 'nft_ar_pharaoh', cat: 'arab',   ar: 'الفرعون',        en: 'The Pharaoh',    rarity: 'LEGENDARY', price: 1.4, flag: '🇪🇬', no: 11, c1: '#b3121f', c2: '#1a0407', image: '' },
        { id: 'nft_ar_atlas',   cat: 'arab',   ar: 'أسد الأطلس',     en: 'Atlas Lion',     rarity: 'EPIC',      price: 1.0, flag: '🇲🇦', no: 7,  c1: '#c1272d', c2: '#0b3d1e', image: '' },
        { id: 'nft_ar_desert',  cat: 'arab',   ar: 'نمر الصحراء',    en: 'Desert Tiger',   rarity: 'RARE',      price: 0.7, flag: '🇩🇿', no: 9,  c1: '#0f7a3a', c2: '#e8e8e8', image: '' },
        { id: 'nft_ar_carthage',cat: 'arab',   ar: 'نسر قرطاج',      en: 'Carthage Eagle', rarity: 'RARE',      price: 0.7, flag: '🇹🇳', no: 8,  c1: '#d11a2a', c2: '#3a0509', image: '' },
        { id: 'nft_ar_gulf',    cat: 'arab',   ar: 'عنابي الخليج',   en: 'Gulf Maroon',    rarity: 'EPIC',      price: 0.9, flag: '🇶🇦', no: 19, c1: '#8a1538', c2: '#2b0511', image: '' },
        // أوروبي
        { id: 'nft_eu_matador', cat: 'europe', ar: 'الماتادور',      en: 'The Matador',    rarity: 'LEGENDARY', price: 1.5, flag: '🇪🇸', no: 8,  c1: '#c60b1e', c2: '#ffc400', image: '' },
        { id: 'nft_eu_azzurri', cat: 'europe', ar: 'الأزرق الإيطالي',en: 'Azzurri Wall',   rarity: 'EPIC',      price: 1.1, flag: '🇮🇹', no: 1,  c1: '#0b4fb3', c2: '#041a3d', image: '' },
        { id: 'nft_eu_lion',    cat: 'europe', ar: 'الأسد الإنجليزي',en: 'Three Lions',    rarity: 'EPIC',      price: 1.1, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', no: 9,  c1: '#ffffff', c2: '#c8102e', image: '' },
        { id: 'nft_eu_rooster', cat: 'europe', ar: 'الديك الفرنسي',  en: 'French Rooster', rarity: 'LEGENDARY', price: 1.3, flag: '🇫🇷', no: 10, c1: '#0055a4', c2: '#ef4135', image: '' },
        { id: 'nft_eu_orange',  cat: 'europe', ar: 'البرتقالي',      en: 'Total Orange',   rarity: 'RARE',      price: 0.8, flag: '🇳🇱', no: 14, c1: '#ff6a00', c2: '#2a1100', image: '' },
        { id: 'nft_eu_seleccao',cat: 'europe', ar: 'ساحر البرتغال',  en: 'Seleção Magic',  rarity: 'LEGENDARY', price: 1.4, flag: '🇵🇹', no: 7,  c1: '#046a38', c2: '#da291c', image: '' },
        // ألماني
        { id: 'nft_de_panzer',  cat: 'german', ar: 'البانزر',        en: 'The Panzer',     rarity: 'EPIC',      price: 1.0, flag: '🇩🇪', no: 13, c1: '#111111', c2: '#dd0000', image: '' },
        { id: 'nft_de_kaiser',  cat: 'german', ar: 'القيصر',         en: 'The Kaiser',     rarity: 'LEGENDARY', price: 1.5, flag: '🇩🇪', no: 5,  c1: '#ffce00', c2: '#111111', image: '' },
        { id: 'nft_de_keeper',  cat: 'german', ar: 'الحارس الحديدي', en: 'Iron Keeper',    rarity: 'RARE',      price: 0.8, flag: '🇩🇪', no: 1,  c1: '#dd0000', c2: '#1b1b1b', image: '' },
        // عالمي
        { id: 'nft_wd_goat',    cat: 'world',  ar: 'الأسطورة الزرقاء', en: 'Sky Legend',   rarity: 'LEGENDARY', price: 1.6, flag: '🇦🇷', no: 10, c1: '#75aadb', c2: '#ffffff', image: '' },
        { id: 'nft_wd_samba',   cat: 'world',  ar: 'ساحر السامبا',   en: 'Samba Wizard',   rarity: 'LEGENDARY', price: 1.4, flag: '🇧🇷', no: 10, c1: '#ffdf00', c2: '#009c3b', image: '' },
        { id: 'nft_wd_samurai', cat: 'world',  ar: 'الساموراي',      en: 'Blue Samurai',   rarity: 'RARE',      price: 0.7, flag: '🇯🇵', no: 11, c1: '#1c3f94', c2: '#050b1f', image: '' }
    ];
    const RARITY_COLOR = { LEGENDARY: '#FCB045', EPIC: '#a855f7', RARE: '#2AABEE' };

    // صورة البطاقة: رابط image إن وُجد، وإلا بطاقة SVG أصلية مرسومة تلقائياً
    function nftImage(it) {
        if (it.image) return it.image;
        const dark = ['#ffffff', '#ffce00', '#ffdf00', '#75aadb'].includes(it.c1);
        const fg = dark ? '#0a0a0a' : '#ffffff';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${it.c1}"/><stop offset="1" stop-color="${it.c2}"/></linearGradient></defs>
            <rect width="256" height="256" rx="28" fill="url(#g)"/>
            <circle cx="128" cy="116" r="78" fill="rgba(0,0,0,0.18)"/>
            <text x="128" y="150" font-family="Arial Black,Arial,sans-serif" font-size="110" font-weight="900" text-anchor="middle" fill="${fg}" fill-opacity="0.92">${it.no}</text>
            <text x="30" y="52" font-size="38">${it.flag}</text>
            <text x="128" y="228" font-family="Arial,sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="${fg}" fill-opacity="0.85" letter-spacing="3">ZELO SPORT</text>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function ownedList() {
        if (Array.isArray(US().ownedNfts)) return US().ownedNfts;
        try { return JSON.parse(LS.get('zelo_owned_nfts') || '[]'); } catch (e) { return []; }
    }

    let target = null;
    let currentCat = 'all';

    window.renderNftMarketPage = function(container) {
        target = container || document.getElementById('main-content') || document.getElementById('app') || document.body;
        if (!target) return;
        const ar = isAr();
        const dir = ar ? 'rtl' : 'ltr';
        const owned = ownedList();
        const currentPhoto = US().photoUrl || LS.get('zelo_photo_url') || '';
        const list = NFT_ITEMS.filter(i => currentCat === 'all' || i.cat === currentCat);

        const chips = CATS.map(c => `
            <button class="nm-chip ${c.id === currentCat ? 'nm-chip-on' : ''}" onclick="window.nftSetCat('${c.id}')">${ar ? c.ar : c.en}</button>`).join('');

        const cards = list.map(it => {
            const isOwned = owned.includes(it.id);
            const img = nftImage(it);
            const inUse = isOwned && currentPhoto === img;
            const btn = inUse
                ? `<button class="nm-btn nm-btn-gray" disabled>✅ ${ar ? 'قيد الاستخدام' : 'In use'}</button>`
                : isOwned
                    ? `<button class="nm-btn nm-btn-blue" onclick="window.useNftAvatar('${it.id}')">🖼️ ${ar ? 'اجعلها صورتي' : 'Use as avatar'}</button>`
                    : `<button class="nm-btn" onclick="window.buyPlayerNft('${it.id}')">🛒 ${ar ? 'شراء' : 'Buy'}</button>`;
            return `
                <div class="nm-card">
                    <span class="nm-rarity" style="background:${RARITY_COLOR[it.rarity] || '#2AABEE'}">${it.rarity}</span>
                    <img class="nm-img" src="${img}" alt="">
                    <div class="nm-name">${esc(ar ? it.ar : it.en)}</div>
                    <div class="nm-price">${it.price} SOL</div>
                    ${btn}
                </div>`;
        }).join('');

        target.innerHTML = `
            <style>
                .nm-wrap { width:100%; box-sizing:border-box; padding:4px 0 90px 0; direction:${dir}; color:#fff; }
                .nm-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
                .nm-back { background:rgba(255,255,255,0.08); color:#00FF87; border:1px solid rgba(0,255,135,0.25); padding:8px 14px; border-radius:20px; font-weight:800; font-size:0.8rem; cursor:pointer; }
                .nm-title { margin:0; font-size:1rem; font-weight:900; color:#14F195; }
                .nm-banner { background:rgba(153,69,255,0.12); border:1px solid rgba(153,69,255,0.3); border-radius:16px; padding:12px 14px; margin-bottom:12px; text-align:center; font-size:0.74rem; color:#94a3b8; }
                .nm-banner b { display:block; color:#fff; font-size:0.85rem; margin-bottom:2px; }
                .nm-chips { display:flex; gap:8px; overflow-x:auto; padding-bottom:10px; margin-bottom:6px; }
                .nm-chips::-webkit-scrollbar { display:none; }
                .nm-chip { flex:0 0 auto; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; padding:7px 16px; border-radius:20px; font-weight:800; font-size:0.78rem; cursor:pointer; }
                .nm-chip-on { background:linear-gradient(135deg,#2AABEE,#00FF87); color:#04110B; border-color:transparent; }
                .nm-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
                .nm-card { position:relative; background:rgba(18,18,24,0.8); border:1px solid rgba(153,69,255,0.25); border-radius:18px; padding:10px; text-align:center; }
                .nm-rarity { position:absolute; top:14px; ${ar ? 'left' : 'right'}:14px; font-size:0.52rem; font-weight:900; color:#000; padding:2px 6px; border-radius:6px; z-index:2; }
                .nm-img { width:100%; aspect-ratio:1/1; border-radius:14px; object-fit:cover; display:block; }
                .nm-name { font-size:0.82rem; font-weight:900; margin-top:8px; }
                .nm-price { font-size:0.8rem; font-weight:900; color:#14F195; font-family:monospace; margin-top:3px; }
                .nm-btn { width:100%; margin-top:8px; border:none; cursor:pointer; font-weight:900; font-size:0.76rem; padding:9px; border-radius:10px; color:#000; background:linear-gradient(135deg,#14F195,#00bc70); }
                .nm-btn-blue { background:linear-gradient(135deg,#2AABEE,#00FF87); }
                .nm-btn-gray { background:rgba(255,255,255,0.08); color:#cbd5e1; cursor:default; }
                .nm-btn:active:not(:disabled) { transform:scale(0.96); }
            </style>
            <div class="nm-wrap">
                <div class="nm-top">
                    <button class="nm-back" onclick="window.nftBackToProfile()">${ar ? '➔ الملف الشخصي' : '➔ Profile'}</button>
                    <h3 class="nm-title">👑 ${ar ? 'سوق بطاقات NFT' : 'NFT Market'}</h3>
                    <div style="width:64px;"></div>
                </div>
                <div class="nm-banner"><b>${ar ? 'اقتنِ بطاقتك واجعلها صورة ملفك الشخصي' : 'Collect a card and use it as your avatar'}</b>${ar ? 'الدفع بعملة SOL عبر محفظتك' : 'Pay with SOL from your wallet'}</div>
                <div class="nm-chips">${chips}</div>
                <div class="nm-grid">${cards}</div>
            </div>`;
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
                    { user_id: String(US().userId), photo_url: photoUrl, owned_nfts: owned },
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

    window.buyPlayerNft = async function(id) {
        const it = NFT_ITEMS.find(x => x.id === id);
        if (!it) return;
        const ar = isAr();
        const name = ar ? it.ar : it.en;
        if (!confirm(ar ? `تأكيد شراء (${name}) بقيمة ${it.price} SOL؟` : `Confirm purchase of ${name} for ${it.price} SOL?`)) return;

        // الدفع الحقيقي: عرّف window.payWithSol(amount, nftId) تعيد true عند نجاح المعاملة
        if (typeof window.payWithSol === 'function') {
            let ok = false;
            try { ok = await window.payWithSol(it.price, it.id); } catch (e) { console.error(e); }
            if (!ok) { alert(ar ? 'لم تكتمل عملية الدفع' : 'Payment was not completed'); return; }
        } else {
            console.warn('payWithSol غير معرّفة: الشراء تجريبي بدون دفع حقيقي');
        }

        const owned = ownedList().slice();
        if (!owned.includes(id)) owned.push(id);
        await persist(owned, nftImage(it));
        alert(ar ? 'تم الشراء وتعيين الصورة 🎉' : 'Purchased and set as avatar 🎉');
        window.nftBackToProfile();
    };
})();
