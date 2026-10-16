/* ========= ZELO FC Wallet (styled like Leaderboard) ========= */
const COINS_PER_ZELO_TOKEN = 100;
const MIN_CLAIM_LIMIT = 1000;
const BACKEND_URL = "https://zelo-fc.onrender.com";
const TOKEN_NAME = "ZELOFC";

// الشبكة: غيّرها إلى mainnet-beta عند الإطلاق الحقيقي
const SOLANA_NETWORK = "devnet";
const SOLANA_RPC = SOLANA_NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

// ضع هنا عنوان الـ Mint الحقيقي لرمز ZELOFC ليظهر رصيده على السلسلة (اتركه فارغًا لإخفاء الصف)
const TOKEN_MINT = "";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const fmt = n => Number(n || 0).toLocaleString('en-US');
const isArLang = () => (typeof userState !== 'undefined' && userState?.lang === 'ar');
const _trw = (k, a, e, p) => window.tr ? window.tr(k, a, e, p) : (isArLang() ? a : e);
const esc = s => (window.escapeHTML ? window.escapeHTML(String(s ?? '')) : String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])));

function getTelegramId() {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
        const id = String(tgUser.id);
        localStorage.setItem('telegram_id', id);
        if (typeof userState !== 'undefined') userState.telegramId = id;
        return id;
    }
    if (typeof userState !== 'undefined' && userState.telegramId && userState.telegramId !== 'guest') {
        return String(userState.telegramId);
    }
    const localId = localStorage.getItem('telegram_id');
    if (localId && localId !== 'guest') return localId;
    return (typeof userState !== 'undefined' && userState.userId) ? String(userState.userId) : 'guest';
}

function getUserCoins() {
    return (typeof userState !== 'undefined' && userState.points !== undefined)
        ? Number(userState.points) || 0
        : Number(localStorage.getItem('user_coins') || 0);
}

function getSolanaWallet() {
    return (typeof userState !== 'undefined' && userState.solanaWallet)
        ? userState.solanaWallet
        : (localStorage.getItem('solana_wallet') || '');
}

/* ---------- RPC مباشر (لا يحتاج مكتبة web3) ---------- */
async function solRpc(method, params) {
    const res = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

async function fetchRealSolanaBalance(address) {
    const elSol = document.getElementById('zw-sol-balance');
    const elTok = document.getElementById('zw-token-onchain');

    try {
        const r = await solRpc('getBalance', [address, { commitment: 'confirmed' }]);
        if (elSol) elSol.innerText = `${(r.value / 1e9).toFixed(4)} SOL`;
    } catch (err) {
        console.warn("Solana balance error:", err);
        if (elSol) elSol.innerText = '—';
    }

    if (TOKEN_MINT && elTok) {
        try {
            const r = await solRpc('getTokenAccountsByOwner', [
                address, { mint: TOKEN_MINT }, { encoding: 'jsonParsed' }
            ]);
            const total = (r.value || []).reduce((sum, acc) =>
                sum + (acc.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
            elTok.innerText = `${total.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${TOKEN_NAME}`;
        } catch (err) {
            console.warn("Token balance error:", err);
            elTok.innerText = '—';
        }
    }
}
window.refreshWalletBalances = function() {
    const w = getSolanaWallet();
    if (!w) return;
    const a = document.getElementById('zw-sol-balance');
    if (a) a.innerText = isArLang() ? '⏳ جاري الفحص...' : '⏳ Checking...';
    fetchRealSolanaBalance(w);
};

/* ---------- الواجهة ---------- */
function renderWalletPage(container) {
    if (!container) return;

    const isAr = isArLang();
    const dir = isAr ? 'rtl' : 'ltr';
    const userCoins = getUserCoins();
    const solanaWallet = getSolanaWallet();

    const canClaim = userCoins >= MIN_CLAIM_LIMIT;
    const neededCoins = Math.max(0, MIN_CLAIM_LIMIT - userCoins);
    const progress = Math.min(100, (userCoins / MIN_CLAIM_LIMIT) * 100);
    const tokensToReceive = (userCoins / COINS_PER_ZELO_TOKEN).toFixed(2);

    if (typeof userState !== 'undefined') {
        userState.points = userCoins;
        userState.solanaWallet = solanaWallet;
    }

    const T = {
        title:      isAr ? 'المحفظة' : 'Wallet',
        sub:        isAr ? 'اربط محفظتك واسحب رموزك' : 'Connect your wallet & claim tokens',
        solana:     isAr ? `محفظة Solana (${SOLANA_NETWORK})` : `Solana Wallet (${SOLANA_NETWORK})`,
        connected:  isAr ? '● متصل' : '● Connected',
        solBal:     isAr ? 'رصيد SOL' : 'SOL Balance',
        tokBal:     isAr ? `رصيد ${TOKEN_NAME} على الشبكة` : `On-chain ${TOKEN_NAME}`,
        checking:   isAr ? '⏳ جاري الفحص...' : '⏳ Checking...',
        copy:       isAr ? '📋 نسخ' : '📋 Copy',
        refresh:    isAr ? '🔄 تحديث' : '🔄 Refresh',
        disconnect: isAr ? '🔌 فصل' : '🔌 Disconnect',
        phantom:    isAr ? 'ربط تلقائي لمحفظة Phantom' : 'Auto Connect Phantom',
        placeholder:isAr ? 'أو ألصق عنوان محفظة Solana...' : 'Or paste Solana address...',
        save:       isAr ? '💾 حفظ العنوان' : '💾 Save Address',
        balTitle:   isAr ? `رصيد ${TOKEN_NAME}` : `${TOKEN_NAME} Balance`,
        points:     isAr ? 'نقاطك' : 'Your Points',
        willGet:    isAr ? 'ستستلم' : "You'll receive",
        rate:       isAr ? `كل ${fmt(COINS_PER_ZELO_TOKEN)} نقطة = 1 ${TOKEN_NAME}` : `${fmt(COINS_PER_ZELO_TOKEN)} points = 1 ${TOKEN_NAME}`,
        progress:   isAr ? 'التقدم نحو الحد الأدنى' : 'Progress to minimum',
        claim:      isAr ? `مطالبة برصيد ${TOKEN_NAME} ⚡` : `Claim ${TOKEN_NAME} Tokens ⚡`,
        locked:     isAr ? `الحد الأدنى ${fmt(MIN_CLAIM_LIMIT)} (تحتاج ${fmt(neededCoins)} إضافية) 🔒`
                         : `Min ${fmt(MIN_CLAIM_LIMIT)} (need ${fmt(neededCoins)} more) 🔒`,
        needWallet: isAr ? 'اربط محفظة Solana أولًا لتتمكن من السحب' : 'Connect a Solana wallet first to claim'
    };

    const safeWallet = esc(solanaWallet);

    container.innerHTML = `
    <style>
        .zw-wrap { direction: ${dir}; padding: 4px 2px 20px; color:#fff; }
        .zw-title { text-align:center; margin-bottom:16px; }
        .zw-title h2 { margin:0 0 6px; font-size:1.4rem; font-weight:900;
            background: linear-gradient(135deg,#2AABEE,#8B5CF6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .zw-title p { margin:0; color:#94a3b8; font-size:0.82rem; font-weight:700; }

        .zw-card {
            background: linear-gradient(135deg, rgba(20,22,48,0.95), rgba(12,14,32,0.95));
            border: 1px solid rgba(90,110,255,0.35); border-radius:16px; padding:14px 12px; margin-bottom:12px;
            box-shadow: 0 0 12px rgba(80,100,255,0.12), inset 0 0 10px rgba(0,0,0,0.3);
        }
        .zw-card.gold { border-color: rgba(255,215,0,0.5); box-shadow: 0 0 14px rgba(255,215,0,0.15); }
        .zw-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
        .zw-head-l { display:flex; align-items:center; gap:10px; min-width:0; }
        .zw-icon { width:44px; height:44px; min-width:44px; border-radius:12px; background:rgba(0,0,0,0.35);
            border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:1.2rem; }
        .zw-name { font-weight:800; font-size:0.9rem; color:#fff; }
        .zw-chip { font-size:0.66rem; font-weight:800; color:#7CF7C4; background:rgba(0,255,135,0.1);
            border:1px solid rgba(0,255,135,0.25); padding:2px 8px; border-radius:6px; flex-shrink:0; }

        .zw-addr { text-align:center; font-family:monospace; font-size:0.82rem; color:#8B5CF6; background:rgba(0,0,0,0.35);
            border:1px solid rgba(139,92,246,0.3); border-radius:10px; padding:9px; margin-bottom:10px; word-break:break-all; }
        .zw-row { display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3);
            border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:9px 12px; margin-bottom:8px; }
        .zw-row .lbl { color:#94a3b8; font-size:0.76rem; font-weight:700; }
        .zw-row .val { color:#00FF87; font-weight:900; font-size:0.95rem; font-family:monospace; }

        .zw-btns { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:4px; }
        .zw-btn { border:none; border-radius:10px; padding:9px 4px; font-size:0.74rem; font-weight:900; cursor:pointer; color:#fff;
            background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); }
        .zw-btn.danger { background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.4); color:#fca5a5; }
        .zw-btn:active { transform:scale(0.97); }

        .zw-btn-main { width:100%; border:none; border-radius:12px; padding:12px; font-size:0.9rem; font-weight:900; cursor:pointer; color:#fff;
            background: linear-gradient(135deg,#2AABEE,#8B5CF6); box-shadow:0 4px 12px rgba(42,171,238,0.25); margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:6px; }
        .zw-input { width:100%; padding:10px; background:rgba(0,0,0,0.45); border:1px solid rgba(139,92,246,0.35); border-radius:10px;
            color:#fff; font-family:monospace; font-size:0.8rem; text-align:center; box-sizing:border-box; margin-bottom:8px; outline:none; }
        .zw-input:focus { border-color:#00FF87; }

        .zw-big { text-align:center; padding:12px; background:rgba(0,0,0,0.35); border:1px solid rgba(255,215,0,0.25); border-radius:12px; margin-bottom:10px; }
        .zw-big .num { font-size:1.6rem; font-weight:900; font-family:monospace;
            background:linear-gradient(90deg,#2AABEE,#8B5CF6,#00FF87); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .zw-big .unit { color:#94a3b8; font-size:0.66rem; font-weight:700; }
        .zw-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
        .zw-mini { text-align:center; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:8px; }
        .zw-mini .lbl { display:block; color:#94a3b8; font-size:0.66rem; font-weight:700; margin-bottom:2px; }
        .zw-mini .val { font-size:0.9rem; font-weight:900; color:#ffd700; font-family:monospace; }

        .zw-bar-wrap { margin-bottom:12px; }
        .zw-bar-top { display:flex; justify-content:space-between; font-size:0.66rem; color:#7a7f9a; font-weight:800; margin-bottom:4px; }
        .zw-bar { height:8px; background:rgba(255,255,255,0.08); border-radius:6px; overflow:hidden; }
        .zw-bar > div { height:100%; border-radius:6px; background:linear-gradient(90deg,#2AABEE,#8B5CF6,#00FF87); }

        .zw-claim { width:100%; border:none; border-radius:12px; padding:13px; font-size:0.92rem; font-weight:900; cursor:pointer;
            background:linear-gradient(135deg,#00FF87,#2AABEE); color:#04121a; box-shadow:0 4px 15px rgba(0,255,135,0.3); }
        .zw-claim:disabled { background:#2a2c3a; color:#8a8fa8; box-shadow:none; cursor:not-allowed; border:1px solid rgba(255,255,255,0.08); }
        .zw-claim:active:not(:disabled) { transform:scale(0.98); }
        .zw-hint { text-align:center; color:#fca5a5; font-size:0.7rem; font-weight:700; margin-top:8px; }
    </style>

    <div class="zw-wrap">
        <div class="zw-title">
            <h2>👛 ${T.title}</h2>
            <p>${T.sub}</p>
        </div>

        <!-- بطاقة Solana -->
        <div class="zw-card">
            <div class="zw-head">
                <div class="zw-head-l">
                    <div class="zw-icon"><img src="https://cryptologos.cc/logos/solana-sol-logo.png" style="width:22px;height:22px;" alt="Solana" onerror="this.style.display='none'"></div>
                    <div class="zw-name">${T.solana}</div>
                </div>
                ${solanaWallet ? `<span class="zw-chip">${T.connected}</span>` : ''}
            </div>

            ${solanaWallet ? `
                <div class="zw-addr">${safeWallet.slice(0, 8)}...${safeWallet.slice(-8)}</div>
                <div class="zw-row"><span class="lbl">${T.solBal}</span><span class="val" id="zw-sol-balance">${T.checking}</span></div>
                ${TOKEN_MINT ? `<div class="zw-row"><span class="lbl">${T.tokBal}</span><span class="val" id="zw-token-onchain" style="color:#ffd700;">${T.checking}</span></div>` : ''}
                <div class="zw-btns">
                    <button class="zw-btn" onclick="copyToClipboard('${safeWallet}')">${T.copy}</button>
                    <button class="zw-btn" onclick="refreshWalletBalances()">${T.refresh}</button>
                    <button class="zw-btn danger" onclick="disconnectSolanaWallet()">${T.disconnect}</button>
                </div>
            ` : `
                <button class="zw-btn-main" onclick="connectPhantomWallet()">👻 ${T.phantom}</button>
                <input type="text" id="solana-address-input" class="zw-input" placeholder="${T.placeholder}" autocomplete="off" spellcheck="false">
                <button id="btn-save-sol-addr" class="zw-btn" style="width:100%; padding:11px;" onclick="saveSolanaWalletAddress()">${T.save}</button>
            `}
        </div>

        <div id="zw-ref-box"></div>

        <!-- بطاقة الرصيد والسحب -->
        <div class="zw-card gold">
            <div class="zw-head">
                <div class="zw-head-l">
                    <div class="zw-icon">🪙</div>
                    <div class="zw-name">${T.balTitle}</div>
                </div>
            </div>

            <div class="zw-big">
                <div class="num">${fmt(userCoins)}</div>
                <div class="unit">🏆 ${T.points}</div>
            </div>

            <div class="zw-grid">
                <div class="zw-mini"><span class="lbl">${T.willGet}</span><span class="val">${fmt(tokensToReceive)} ${TOKEN_NAME}</span></div>
                <div class="zw-mini"><span class="lbl">${isAr ? 'سعر التحويل' : 'Rate'}</span><span class="val" style="font-size:0.72rem;">${T.rate}</span></div>
            </div>

            <div class="zw-bar-wrap">
                <div class="zw-bar-top"><span>${T.progress}</span><span>${fmt(Math.min(userCoins, MIN_CLAIM_LIMIT))} / ${fmt(MIN_CLAIM_LIMIT)}</span></div>
                <div class="zw-bar"><div style="width:${progress.toFixed(1)}%"></div></div>
            </div>

            <button class="zw-claim" id="btn-claim-action" onclick="claimCoinsToSolanaWallet()" ${!canClaim ? 'disabled' : ''}>
                ${canClaim ? T.claim : T.locked}
            </button>
            ${canClaim && !solanaWallet ? `<div class="zw-hint">${T.needWallet}</div>` : ''}
        </div>
    </div>`;

    if (solanaWallet) fetchRealSolanaBalance(solanaWallet);
    syncWalletPoolFromDB(container);
}
window.renderWalletPage = renderWalletPage;

/* ---------- مجمع النقاط: مزامنة الرصيد + ملخص الإحالات (من referrals.js) ---------- */
let _walletSyncing = false;
async function syncWalletPoolFromDB(container) {
    if (_walletSyncing || typeof window.zeloSyncPointsPool !== 'function') return;
    _walletSyncing = true;
    try {
        const isAr = isArLang();
        const pool = await window.zeloSyncPointsPool();
        if (pool && pool.changed && container && document.getElementById('zw-ref-box')) {
            _walletSyncing = false;
            renderWalletPage(container); // إعادة الرسم بالرصيد الجديد (المزامنة التالية لن تجد فرقاً)
            return;
        }

        const sum = await window.zeloReferralSummary();
        const box = document.getElementById('zw-ref-box');
        if (!box || !sum) return;

        box.innerHTML = `
        <div class="zw-card">
            <div class="zw-head">
                <div class="zw-head-l">
                    <div class="zw-icon">👥</div>
                    <div class="zw-name">${_trw('refEarningsTitle', 'أرباح الإحالات', 'Referral Earnings')}</div>
                </div>
            </div>
            <div class="zw-big">
                <div class="num">+${fmt(sum.earned)}</div>
                <div class="unit">🏆 ${_trw('refEarningsUnit', 'نقطة (ضمن رصيدك)', 'points (included in your balance)')}</div>
            </div>
            <div class="zw-grid">
                <div class="zw-mini"><span class="lbl">${_trw('refCompleted', 'إحالات مكتملة', 'Completed')}</span><span class="val">${fmt(sum.done)}</span></div>
                <div class="zw-mini"><span class="lbl">${_trw('refPendingShort', 'بانتظار أول كسب', 'Pending')}</span><span class="val">${fmt(sum.pending)}</span></div>
            </div>
            <button class="zw-btn" style="width:100%;padding:11px;margin-top:10px;" onclick="window.copyReferralLink()">${_trw('refCopyBtn', 'نسخ رابط الدعوة 🔗', 'Copy invite link 🔗')}</button>
        </div>`;
    } catch (e) {
        console.warn('Wallet sync error:', e);
    } finally {
        _walletSyncing = false;
    }
}

/* ---------- الحفظ والربط ---------- */
async function saveSolanaAddressToStateAndDB(solAddress, walletType = 'solana') {
    const isAr = isArLang();
    const saveBtn = document.getElementById('btn-save-sol-addr');
    const originalText = saveBtn ? saveBtn.innerText : '';

    try {
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = isAr ? '⏳ جاري الحفظ...' : '⏳ Saving...'; }

        const response = await fetch(`${BACKEND_URL}/api/save-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: getTelegramId(), walletType, walletAddress: solAddress })
        });
        const resData = await response.json().catch(() => ({}));

        if (response.ok && resData.success) {
            localStorage.setItem('solana_wallet', solAddress);
            if (typeof userState !== 'undefined') userState.solanaWallet = solAddress;
            if (typeof showPage === 'function') showPage('wallet');
            alert(isAr ? '✅ تم حفظ المحفظة بنجاح!' : '✅ Wallet saved successfully!');
        } else {
            throw new Error(resData.error || resData.message || (isAr ? 'فشل حفظ العنوان في السيرفر' : 'Failed to save address to server'));
        }
    } catch (err) {
        console.error("Save Wallet Error:", err);
        alert(`❌ ${err.message}`);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = originalText || (isAr ? '💾 حفظ العنوان' : '💾 Save Address'); }
    }
}

window.connectPhantomWallet = async function() {
    const isAr = isArLang();
    const provider = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
    if (provider?.isPhantom) {
        try {
            const res = await provider.connect();
            await saveSolanaAddressToStateAndDB(res.publicKey.toString(), 'solana');
        } catch (err) { console.error(err); }
    } else {
        alert(isAr
            ? 'تعذر العثور على Phantom داخل هذا المتصفح. انسخ عنوان محفظتك من تطبيق Phantom والصقه في الحقل.'
            : 'Phantom was not found in this browser. Copy your address from the Phantom app and paste it in the field.');
    }
};

window.saveSolanaWalletAddress = function() {
    const isAr = isArLang();
    const input = document.getElementById('solana-address-input');
    if (!input) return;
    const addr = input.value.trim();
    if (SOLANA_ADDRESS_REGEX.test(addr)) {
        saveSolanaAddressToStateAndDB(addr, 'solana');
    } else {
        alert(isAr ? '⚠️ يرجى إدخال عنوان محفظة Solana صحيح (Base58).' : '⚠️ Please enter a valid Solana wallet address.');
    }
};

/* ---------- السحب ---------- */
window.claimCoinsToSolanaWallet = async function() {
    const isAr = isArLang();
    const solWallet = getSolanaWallet();
    const userCoins = getUserCoins();

    if (userCoins < MIN_CLAIM_LIMIT) {
        alert(isAr
            ? `⚠️ الحد الأدنى للسحب هو ${fmt(MIN_CLAIM_LIMIT)} نقطة. رصيدك الحالي لا يكفي.`
            : `⚠️ Minimum claim is ${fmt(MIN_CLAIM_LIMIT)} points. Your balance is not enough.`);
        return;
    }
    if (!solWallet) {
        alert(isAr ? '⚠️ يرجى ربط أو حفظ محفظة Solana أولاً!' : '⚠️ Please connect or save your Solana wallet first!');
        return;
    }

    const tokens = (userCoins / COINS_PER_ZELO_TOKEN).toFixed(2);
    const ok = confirm(isAr
        ? `تأكيد خصم ${fmt(userCoins)} نقطة لاستلام ${fmt(tokens)} ${TOKEN_NAME}؟`
        : `Confirm deducting ${fmt(userCoins)} points to receive ${fmt(tokens)} ${TOKEN_NAME}?`);
    if (!ok) return;

    const claimBtn = document.getElementById('btn-claim-action');
    let done = false;

    try {
        if (claimBtn) { claimBtn.disabled = true; claimBtn.innerText = isAr ? '⏳ جاري المعالجة والتحويل...' : '⏳ Processing transfer...'; }

        const response = await fetch(`${BACKEND_URL}/api/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: getTelegramId(), userWalletAddress: solWallet })
        });
        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
            done = true;
            const remaining = result.newBalance !== undefined ? Number(result.newBalance) : 0;
            localStorage.setItem('user_coins', remaining);
            if (typeof userState !== 'undefined') userState.points = remaining;
            if (typeof showPage === 'function') showPage('wallet');

            alert(isAr
                ? `✅ تم بنجاح! تم تحويل الرموز على الشبكة.\n\nمعرف المعاملة:\n${result.txHash}`
                : `✅ Success! Tokens transferred on-chain.\n\nTx Hash:\n${result.txHash}`);
        } else {
            const details = result?.error || result?.message || `HTTP ${response.status}`;
            alert(isAr ? `❌ فشلت عملية التحويل:\n${details}` : `❌ Transfer failed:\n${details}`);
        }
    } catch (error) {
        console.error("Claim Error:", error);
        alert(isAr
            ? `❌ خطأ في الاتصال بالسيرفر: ${error.message}`
            : `❌ Server connection error: ${error.message}`);
    } finally {
        if (!done && claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = isAr ? `مطالبة برصيد ${TOKEN_NAME} ⚡` : `Claim ${TOKEN_NAME} Tokens ⚡`;
        }
    }
};

/* ---------- فصل المحفظة ونسخ العنوان ---------- */
window.disconnectSolanaWallet = async function() {
    const isAr = isArLang();
    if (!confirm(isAr ? 'هل تريد فصل المحفظة؟' : 'Disconnect your wallet?')) return;
    try {
        const provider = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
        if (provider?.disconnect) await provider.disconnect();
    } catch (e) {}
    localStorage.removeItem('solana_wallet');
    if (typeof userState !== 'undefined') userState.solanaWallet = '';
    if (typeof showPage === 'function') showPage('wallet');
};

if (typeof window.copyToClipboard !== 'function') {
    window.copyToClipboard = async function(text) {
        try { await navigator.clipboard.writeText(text); }
        catch (e) {
            const t = document.createElement('textarea');
            t.value = text; document.body.appendChild(t); t.select();
            try { document.execCommand('copy'); } catch (e2) {}
            t.remove();
        }
        alert(isArLang() ? 'تم النسخ ✅' : 'Copied ✅');
    };
}
