const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// تنظيف SUPABASE_URL: نأخذ النطاق فقط (يحذف / الزائدة و /rest/v1 والمسافات والاقتباسات)
function cleanSupabaseUrl(raw) {
    const s = String(raw || '').trim().replace(/^["']+|["']+$/g, '');
    if (!s) return '';
    try { return new URL(s).origin; } catch (e) { return s.replace(/\/+$/, ''); }
}
const supabaseUrl = cleanSupabaseUrl(process.env.SUPABASE_URL);
const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim().replace(/^["']+|["']+$/g, '');
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
console.log('Supabase URL in use:', supabaseUrl || '(missing)', '| key length:', supabaseKey.length);

// تنظيف SOLANA_RPC_URL: إن كان فارغاً أو غير صالح نستخدم رابط devnet الرسمي
const DEFAULT_RPC = 'https://solana-devnet.drpc.org';
function cleanRpcUrl(raw) {
    const s = String(raw || '').trim().replace(/^["']+|["']+$/g, '');
    if (!s) return DEFAULT_RPC;
    try {
        const u = new URL(s);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return DEFAULT_RPC;
        return s;
    } catch (e) {
        console.warn('Invalid SOLANA_RPC_URL, using default:', e.message);
        return DEFAULT_RPC;
    }
}
const rpcUrl = cleanRpcUrl(process.env.SOLANA_RPC_URL);
const connection = new Connection(rpcUrl, 'confirmed');
console.log('Solana RPC in use:', rpcUrl.replace(/(api-key|apikey|key)=[^&]+/i, '$1=***'));
// فحص اتصال عند التشغيل (يظهر في السجل)
connection.getVersion()
    .then(v => console.log('Solana RPC reachable, version:', v['solana-core']))
    .catch(e => console.error('Solana RPC NOT reachable:', e.message));

/* ========= إعدادات الشبكة والخزنة (الخزنة تستقبل مدفوعات NFT فقط) ========= */
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const TOKEN_MINT = (process.env.TOKEN_MINT || '').trim();            // عنوان رمز ZELOFC (SPL). إن تُرك فارغاً يعمل وضع SOL
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS || 9);
const TOKEN_NAME = process.env.TOKEN_NAME || 'ZELOFC';
const COINS_PER_TOKEN = 100;                                          // كل 100 نقطة = 1 رمز
const MIN_CLAIM_POINTS = 1000;                                        // الحد الأدنى للسحب
const SOL_PER_TOKEN = Number(process.env.SOL_PER_TOKEN || 0.0001);    // وضع SOL فقط: كم SOL لكل رمز (100 نقطة). 2800 نقطة = 0.0028 SOL

function getTreasuryKeypair() {
    const secretKeyString = process.env.TREASURY_PRIVATE_KEY?.trim();
    if (!secretKeyString) return null;
    try {
        return secretKeyString.startsWith('[')
            ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyString)))
            : Keypair.fromSecretKey(bs58.decode(secretKeyString));
    } catch (e) {
        console.error("Invalid TREASURY_PRIVATE_KEY format:", e.message);
        return null;
    }
}

// التحقق من هوية المستخدم: نقرأ توكن Supabase (JWT) من ترويسة Authorization
// ونأخذ المعرّف من التوكن نفسه، ولا نثق أبداً بأي userId يأتي في الطلب.
async function requireAuth(req, res, next) {
    try {
        if (!supabase) return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
        const header = String(req.headers.authorization || '');
        const m = header.match(/^Bearer\s+(.+)$/i);
        if (!m) return res.status(401).json({ success: false, error: "Authentication required" });
        const { data, error } = await supabase.auth.getUser(m[1].trim());
        if (error || !data?.user?.id) {
            return res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
        }
        req.authUserId = String(data.user.id);
        next();
    } catch (e) {
        console.error('Auth check error:', e.message);
        return res.status(401).json({ success: false, error: "Authentication failed" });
    }
}

app.get('/', (req, res) => res.send('Zelo FC Backend Server is running smoothly 🚀'));

// إعدادات عامة يقرأها التطبيق (لإظهار رصيد الرمز داخل المحفظة)
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        network: SOLANA_NETWORK,
        tokenMint: TOKEN_MINT,
        tokenName: TOKEN_NAME,
        decimals: TOKEN_DECIMALS,
        coinsPerToken: COINS_PER_TOKEN,
        minClaim: MIN_CLAIM_POINTS,
        payoutMode: TOKEN_MINT ? 'spl' : 'sol',
        solPerToken: SOL_PER_TOKEN
    });
});

// فحص حالة الخزنة (عنوان عام ورصيد فقط) — للتشخيص
// محمي: يعمل فقط عند ضبط ADMIN_TOKEN في Render وإرساله في الترويسة x-admin-token
app.get('/api/treasury-status', async (req, res) => {
    const adminToken = String(process.env.ADMIN_TOKEN || '');
    const sent = String(req.headers['x-admin-token'] || '');
    const okToken = adminToken.length >= 16 && sent.length === adminToken.length &&
        crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(adminToken));
    if (!okToken) return res.status(404).json({ success: false, error: "Not found" });
    try {
        const treasury = getTreasuryKeypair();
        if (!treasury) return res.status(500).json({ success: false, error: "Treasury key missing or invalid" });
        const lamports = await connection.getBalance(treasury.publicKey);
        res.json({
            success: true,
            network: SOLANA_NETWORK,
            rpc: rpcUrl.replace(/(api-key|apikey|key)=[^&]+/i, '$1=***'),
            treasuryAddress: treasury.publicKey.toBase58(),
            solBalance: lamports / 1e9,
            payoutMode: TOKEN_MINT ? 'spl' : 'sol'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/user-info', requireAuth, async (req, res) => {
    const userId = req.authUserId;

    if (!userId) {
        return res.status(400).json({ success: false, error: "Invalid or missing User ID" });
    }
    if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('solana_wallet, points')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        return res.json({
            success: true,
            solanaWallet: data?.solana_wallet || '',
            coins: data?.points || 0
        });
    } catch (err) {
        console.error("Fetch User Info Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/save-wallet', requireAuth, async (req, res) => {
    const { walletType, walletAddress } = req.body;
    const userId = req.authUserId;

    if (!userId) {
        return res.status(400).json({ success: false, error: "Invalid or missing User ID" });
    }
    if (!walletAddress || walletType !== 'solana') {
        return res.status(400).json({ success: false, error: "Invalid wallet type or address" });
    }
    if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
    }

    const cleanAddress = String(walletAddress).trim();

    try {
        new PublicKey(cleanAddress); // تحقق أن العنوان صالح
    } catch (e) {
        return res.status(400).json({ success: false, error: "Invalid Solana wallet address" });
    }

    try {
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('user_id')
            .eq('solana_wallet', cleanAddress)
            .neq('user_id', userId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: "This Solana wallet address is already linked to another account."
            });
        }

        const { data: updated, error: updateError } = await supabase
            .from('users')
            .update({ solana_wallet: cleanAddress })
            .eq('user_id', userId)
            .select('user_id');

        if (updateError) throw updateError;

        if (!updated || updated.length === 0) {
            return res.status(404).json({ success: false, error: "User record not found" });
        }

        return res.json({ success: true, message: "Solana wallet address saved successfully." });
    } catch (err) {
        console.error("Save Wallet Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

async function rpcOrThrow(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
}

// ملاحظة: حُذف مسار POST /api/claim (سحب الرموز من الخزنة). النقاط داخلية ولا تُسحب.
// جدول withdrawals ودوال السحب في القاعدة بقيت للسجل القديم فقط.

/* ========= شراء بطاقات NFT بعملة SOL (devnet) =========
 * الأسعار والكميات تُقرأ من هنا فقط (لا نثق بأي سعر يأتي من التطبيق).
 * التسلسل:
 *   1) /api/nft/create-order : ينشئ طلباً برقم مرجعي (reference) ويعيد رابط Solana Pay.
 *   2) اللاعب يدفع من محفظته (المحفوظة في حسابه) إلى عنوان الخزنة.
 *   3) /api/nft/verify : يتحقق من المعاملة على الشبكة (المرسل/المستلم/المبلغ) ثم يسجّل الملكية بدالة ذرية.
 */
const NFT_CATALOG = {
    nft_ar_falcon:   { price: 1.5 },                      nft_ar_pharaoh: { price: 1.4 },
    nft_ar_atlas:    { price: 1.0 },                      nft_ar_desert:  { price: 0.7 },
    nft_ar_carthage: { price: 0.7 },                      nft_ar_gulf:    { price: 0.9 },
    nft_eu_matador:  { price: 1.5 },                      nft_eu_azzurri: { price: 1.1 },
    nft_eu_lion:     { price: 1.1 },                      nft_eu_rooster: { price: 1.3 },
    nft_eu_orange:   { price: 0.8 },                      nft_eu_seleccao:{ price: 1.4 },
    nft_de_panzer:   { price: 1.0 },                      nft_de_kaiser:  { price: 1.5 },
    nft_de_keeper:   { price: 0.8 },                      nft_wd_goat:    { price: 1.6 },
    nft_wd_samba:    { price: 1.4 },                      nft_wd_samurai: { price: 0.7 },
    nft_my_phoenix:  { price: 3.0 },                      nft_my_nebula:  { price: 3.5 },
    nft_my_aurora:   { price: 2.8 },                      nft_ev_riser:   { price: 0.6 },
    nft_ev_captain:  { price: 0.8 },
    nft_ss_winter:   { price: 1.8, until: '2026-12-31T23:59:59Z' }
};
// الكميات المحدودة (يجب أن تطابق max في nft-market.js)
Object.assign(NFT_CATALOG.nft_ar_falcon,   { max: 25 });
Object.assign(NFT_CATALOG.nft_ar_pharaoh,  { max: 25 });
Object.assign(NFT_CATALOG.nft_eu_matador,  { max: 25 });
Object.assign(NFT_CATALOG.nft_eu_rooster,  { max: 25 });
Object.assign(NFT_CATALOG.nft_eu_seleccao, { max: 25 });
Object.assign(NFT_CATALOG.nft_de_kaiser,   { max: 25 });
Object.assign(NFT_CATALOG.nft_wd_goat,     { max: 25 });
Object.assign(NFT_CATALOG.nft_wd_samba,    { max: 25 });
Object.assign(NFT_CATALOG.nft_my_phoenix,  { max: 5 });
Object.assign(NFT_CATALOG.nft_my_nebula,   { max: 5 });
Object.assign(NFT_CATALOG.nft_my_aurora,   { max: 7 });
Object.assign(NFT_CATALOG.nft_ss_winter,   { max: 20 });

const NFT_ORDER_TTL_MS = 15 * 60 * 1000;      // مهلة الدفع
const NFT_VERIFY_GRACE_MS = 30 * 60 * 1000;   // سماح إضافي للتحقق من دفعة تأخر تأكيدها

async function checkNftPayment(signature, order, treasuryAddr) {
    const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx || tx.meta?.err) return false;
    const createdSec = Date.parse(order.created_at) / 1000;
    if (tx.blockTime && tx.blockTime < createdSec - 60) return false;   // معاملة أقدم من الطلب
    for (const ins of tx.transaction.message.instructions) {
        if (ins.program === 'system' && ins.parsed?.type === 'transfer') {
            const i = ins.parsed.info;
            if (i.source === order.wallet && i.destination === treasuryAddr && Number(i.lamports) >= Number(order.lamports)) return true;
        }
    }
    return false;
}

app.post('/api/nft/create-order', requireAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const nftId = String(req.body?.nftId || '');
        const item = NFT_CATALOG[nftId];
        if (!item) return res.status(404).json({ success: false, error: 'Unknown NFT' });
        if (item.until && Date.now() > Date.parse(item.until)) return res.status(400).json({ success: false, error: 'This offer has ended' });

        const treasury = getTreasuryKeypair();
        if (!treasury) return res.status(500).json({ success: false, error: 'Treasury key missing or invalid' });

        const { data: user } = await supabase.from('users').select('solana_wallet').eq('user_id', userId).maybeSingle();
        if (!user?.solana_wallet) return res.status(400).json({ success: false, error: 'wallet_missing' });

        const { data: owned } = await supabase.from('nft_owned').select('nft_id').eq('user_id', userId).eq('nft_id', nftId).maybeSingle();
        if (owned) return res.status(400).json({ success: false, error: 'You already own this card' });

        if (item.max) {
            const { data: s } = await supabase.from('nft_supply').select('sold').eq('nft_id', nftId).maybeSingle();
            if ((s?.sold || 0) >= item.max) return res.status(400).json({ success: false, error: 'Sold out' });
        }

        const lamports = Math.round(item.price * 1e9);
        const reference = Keypair.generate().publicKey.toBase58();
        const expiresAt = new Date(Date.now() + NFT_ORDER_TTL_MS).toISOString();
        const { data: order, error } = await supabase.from('nft_orders')
            .insert({ user_id: userId, nft_id: nftId, reference, wallet: user.solana_wallet, lamports, expires_at: expiresAt })
            .select('id').single();
        if (error) throw error;

        const amountSol = String(lamports / 1e9);
        const treasuryAddr = treasury.publicKey.toBase58();
        const payUrl = `solana:${treasuryAddr}?amount=${amountSol}&reference=${reference}&label=${encodeURIComponent('Zelo FC')}&message=${encodeURIComponent('NFT ' + nftId)}`;
        return res.json({ success: true, orderId: order.id, treasury: treasuryAddr, amountSol, wallet: user.solana_wallet, payUrl, expiresAt, network: SOLANA_NETWORK });
    } catch (e) {
        console.error('NFT create-order error:', e);
        return res.status(500).json({ success: false, error: 'Could not create the order' });
    }
});

app.post('/api/nft/verify', requireAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { orderId, signature: manualSig } = req.body || {};
        if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' });

        const { data: order } = await supabase.from('nft_orders').select('*').eq('id', orderId).eq('user_id', userId).maybeSingle();
        if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
        if (order.status === 'completed') return res.json({ success: true, nftId: order.nft_id, serial: order.serial || 0 });
        if (order.status !== 'pending') return res.status(409).json({ success: false, error: 'Payment received but needs manual review. Contact support.' });
        if (Date.now() > Date.parse(order.expires_at) + NFT_VERIFY_GRACE_MS) return res.status(410).json({ success: false, error: 'Order expired' });

        const treasury = getTreasuryKeypair();
        if (!treasury) return res.status(500).json({ success: false, error: 'Treasury key missing or invalid' });
        const treasuryAddr = treasury.publicKey.toBase58();

        let candidates = [];
        if (manualSig) {
            candidates = [String(manualSig).trim()];
        } else {
            const sigs = await connection.getSignaturesForAddress(new PublicKey(order.reference), { limit: 10 }, 'confirmed');
            candidates = sigs.filter(s => !s.err).map(s => s.signature);
        }

        let paidSig = null;
        for (const sig of candidates) {
            try { if (await checkNftPayment(sig, order, treasuryAddr)) { paidSig = sig; break; } }
            catch (e) { console.warn('NFT tx check failed:', e.message); }
        }
        if (!paidSig) return res.json({ success: false, pending: true });

        const item = NFT_CATALOG[order.nft_id];
        const result = await rpcOrThrow('complete_nft_order', { p_order_id: order.id, p_signature: paidSig, p_max: item?.max ?? null });
        if (result?.status === 'ok') {
            console.log(`NFT purchase OK user=${userId} nft=${order.nft_id} tx=${paidSig}`);
            return res.json({ success: true, nftId: order.nft_id, serial: Number(result.serial) || 0, txHash: paidSig });
        }
        console.error(`NFT PAID BUT NOT GRANTED order=${order.id} status=${result?.status} tx=${paidSig}`);
        return res.status(409).json({ success: false, error: 'Payment received but the card could not be granted (sold out or already owned). It will be reviewed and refunded.' });
    } catch (e) {
        console.error('NFT verify error:', e);
        return res.status(500).json({ success: false, error: 'Verification failed. Try again.' });
    }
});

app.get('/api/nft/owned', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase.from('nft_owned').select('nft_id, serial').eq('user_id', req.authUserId);
        if (error) throw error;
        return res.json({ success: true, owned: (data || []).map(r => ({ nftId: r.nft_id, serial: r.serial || 0 })) });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ===== مكافأة الإعلانات: التحقق من Google (AdMob SSV) =====
// ملاحظة: حُذف المسار القديم POST /api/reward-ad لأنه كان يسمح لأي شخص بإضافة نقاط لنفسه.
const AD_REWARD_POINTS = 50;   // نقاط كل إعلان (يجب أن تطابق الرقم المعروض في ads.js)
const AD_DAILY_LIMIT = 10;     // أقصى عدد إعلانات مكافأة لكل لاعب خلال 24 ساعة
const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let admobKeysCache = { keys: null, fetchedAt: 0 };

async function getAdmobKeys(force = false) {
    const fresh = admobKeysCache.keys && (Date.now() - admobKeysCache.fetchedAt < 24 * 60 * 60 * 1000);
    if (fresh && !force) return admobKeysCache.keys;
    const r = await fetch(ADMOB_KEYS_URL);
    if (!r.ok) throw new Error('Failed to fetch AdMob verifier keys');
    const json = await r.json();
    const map = {};
    for (const k of (json.keys || [])) map[String(k.keyId)] = k.pem;
    admobKeysCache = { keys: map, fetchedAt: Date.now() };
    return map;
}

async function verifyAdmobSignature(rawQuery) {
    const sigIdx = rawQuery.indexOf('&signature=');
    if (sigIdx === -1) return false;

    const signedData = rawQuery.substring(0, sigIdx);
    const tail = new URLSearchParams(rawQuery.substring(sigIdx + 1));
    const signature = tail.get('signature');
    const keyId = tail.get('key_id');
    if (!signature || !keyId) return false;

    let keys = await getAdmobKeys();
    if (!keys[keyId]) keys = await getAdmobKeys(true); // مفتاح جديد: نحدّث القائمة مرة واحدة
    const pem = keys[keyId];
    if (!pem) return false;

    return crypto.verify('sha256', Buffer.from(signedData), pem, Buffer.from(signature, 'base64url'));
}

// Google تستدعي هذا الرابط (GET) بعد أن يكمل اللاعب مشاهدة إعلان المكافأة
app.get('/api/admob-ssv', async (req, res) => {
    try {
        if (!supabase) return res.status(500).send('db not ready');

        const rawQuery = (req.originalUrl.split('?')[1]) || '';

        let valid = false;
        try {
            valid = await verifyAdmobSignature(rawQuery);
        } catch (e) {
            console.error('AdMob signature check error:', e.message);
        }
        if (!valid) return res.status(403).send('invalid signature');

        // نقبل فقط إعلانات وحدتك أنت (الرقم الذي بعد "/" في معرّف الوحدة)
        const expectedUnits = (process.env.ADMOB_REWARD_AD_UNIT_ID || '').split(',').map(x => x.trim()).filter(Boolean);
        const { user_id, transaction_id, ad_unit, custom_data } = req.query;
        if (!expectedUnits.length || !expectedUnits.includes(String(ad_unit))) {
            console.warn('AdMob SSV: unexpected ad_unit', ad_unit);
            return res.status(200).send('ignored');
        }
        if (!user_id || !transaction_id) return res.status(400).send('missing params');

        // مضاعفة مكافأة مهمة: custom_data = "double:<task_id>"
        // النقاط تُؤخذ من جدول task_definitions في القاعدة، ومرة واحدة لكل مهمة
        if (typeof custom_data === 'string' && custom_data.startsWith('double:')) {
            const taskId = custom_data.slice('double:'.length).trim();
            const { data: dData, error: dError } = await supabase.rpc('add_task_double_reward', {
                p_user_id: String(user_id),
                p_transaction_id: String(transaction_id),
                p_task_id: taskId
            });
            if (dError) throw dError;
            console.log('AdMob SSV double result:', dData, 'user:', user_id, 'task:', taskId);
            return res.status(200).send(String(dData));
        }

        const { data, error } = await supabase.rpc('add_ad_reward', {
            p_user_id: String(user_id),
            p_transaction_id: String(transaction_id),
            p_points: AD_REWARD_POINTS,
            p_daily_limit: AD_DAILY_LIMIT
        });
        if (error) throw error;

        console.log('AdMob SSV result:', data, 'user:', user_id);
        return res.status(200).send(String(data)); // 200 دائمًا حتى لا تعيد Google المحاولة
    } catch (err) {
        console.error('AdMob SSV error:', err);
        return res.status(500).send('error');
    }
});

// ===== مكافأة الإعلانات: تأكيد من LevelPlay (S2S) =====
// يُستدعى من خوادم LevelPlay بعد اكتمال الإعلان، وليس من الهاتف
app.get('/api/unity-ssv', async (req, res) => {
    try {
        if (!supabase) return res.status(500).send('db not ready');

        // 1) التحقق من السر: الرابط يُرسل من خوادم LevelPlay فقط
        const secret = String(process.env.LEVELPLAY_CALLBACK_SECRET || '');
        const sent = String(req.query.token || '');
        if (secret.length < 16 || sent.length !== secret.length ||
            !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(secret))) {
            return res.status(403).send('forbidden');
        }

        // 2) المعاملات القادمة من LevelPlay
        const userId = String(req.query.userid || '').trim();
        const eventId = String(req.query.eventId || '').trim();
        if (!userId || !eventId || eventId.length > 200) {
            return res.status(400).send('missing params');
        }

        // 3) النقاط من إعداداتنا وليس من الرابط. eventId فريد لكل إعلان،
        // ودالة add_ad_reward تمنع تكرار نفس المعاملة
        const { data, error } = await supabase.rpc('add_ad_reward', {
            p_user_id: userId,
            p_transaction_id: 'levelplay:' + eventId,
            p_points: AD_REWARD_POINTS,
            p_daily_limit: AD_DAILY_LIMIT
        });
        if (error) throw error;

        console.log('LevelPlay S2S result:', data, 'user:', userId);
        return res.status(200).send(String(data));
    } catch (err) {
        console.error('LevelPlay S2S error:', err);
        return res.status(500).send('error');
    }
});

/* ========= شراء Zelo Coin عبر Google Play =========
 * التطبيق يرسل productId + purchaseToken بعد أن يدفع اللاعب. السيرفر:
 *   1) يسأل Google (Play Developer API) هل الشراء حقيقي ومكتمل.
 *   2) يضيف العملات بدالة ذرية add_google_purchase (كل purchaseToken يُحتسب مرة واحدة فقط).
 * عدد العملات يُقرأ من هنا فقط، ولا نثق بأي رقم يأتي من التطبيق.
 *
 * متغيرات البيئة (Render):
 *   GOOGLE_PLAY_PACKAGE_NAME     = اسم حزمة التطبيق، مثل com.zelo.fc
 *   GOOGLE_PLAY_SERVICE_ACCOUNT  = محتوى ملف JSON الخاص بالـ Service Account كاملاً
 */
const GOOGLE_PLAY_PACKAGE = String(process.env.GOOGLE_PLAY_PACKAGE_NAME || '').trim();
const GOOGLE_COIN_PRODUCTS = {      // يجب أن تطابق gid في store.js ومنتجات Play Console
    zelo_coin_100: 100,
    zelo_coin_500: 500,
    zelo_coin_1000: 1000,
    zelo_coin_2000: 2000
};
let googlePlayAuth = null;
function getGooglePlayAuth() {
    if (googlePlayAuth) return googlePlayAuth;
    const raw = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT || '').trim();
    if (!raw) return null;
    try {
        const { GoogleAuth } = require('google-auth-library');
        googlePlayAuth = new GoogleAuth({
            credentials: JSON.parse(raw),
            scopes: ['https://www.googleapis.com/auth/androidpublisher']
        });
        return googlePlayAuth;
    } catch (e) {
        console.error('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT:', e.message);
        return null;
    }
}

app.post('/api/google-purchase', requireAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const productId = String(req.body?.productId || '').trim();
        const purchaseToken = String(req.body?.purchaseToken || '').trim();
        const coins = GOOGLE_COIN_PRODUCTS[productId];
        if (!coins || !purchaseToken || purchaseToken.length > 2000) {
            return res.status(400).json({ success: false, error: 'Invalid purchase data' });
        }

        const auth = getGooglePlayAuth();
        if (!auth || !GOOGLE_PLAY_PACKAGE) {
            console.error('Google Play verification is not configured');
            return res.status(500).json({ success: false, error: 'Purchase verification is not configured' });
        }

        // 1) اسأل Google عن الشراء
        let purchase;
        try {
            const client = await auth.getClient();
            const url = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
                encodeURIComponent(GOOGLE_PLAY_PACKAGE) + '/purchases/products/' +
                encodeURIComponent(productId) + '/tokens/' + encodeURIComponent(purchaseToken);
            const r = await client.request({ url });
            purchase = r.data;
        } catch (e) {
            const status = e?.response?.status || e?.code;
            if ([400, 404, 410].includes(Number(status))) {
                return res.status(400).json({ success: false, error: 'Purchase not found' });
            }
            throw e;
        }

        // purchaseState: 0 = مكتمل، 1 = ملغى، 2 = قيد الانتظار
        if (Number(purchase?.purchaseState) !== 0) {
            return res.status(402).json({ success: false, error: 'Purchase is not completed' });
        }

        // 2) أضف العملات مرة واحدة فقط لكل purchaseToken
        const result = await rpcOrThrow('add_google_purchase', {
            p_user_id: userId,
            p_token: purchaseToken,
            p_order_id: String(purchase.orderId || ''),
            p_product_id: productId,
            p_points: coins
        });
        if (result === 'other_user') {
            console.error(`Google purchase token already used by another user. user=${userId} product=${productId}`);
            return res.status(409).json({ success: false, error: 'Purchase already used' });
        }

        console.log(`Google purchase ${result} user=${userId} product=${productId} coins=${coins}`);
        return res.json({ success: true, coins, duplicate: result === 'duplicate' });
    } catch (e) {
        console.error('Google purchase error:', e);
        return res.status(500).json({ success: false, error: 'Verification failed. Try again.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Zelo FC Backend Server running on port ${PORT}`));
