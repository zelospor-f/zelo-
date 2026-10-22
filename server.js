const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
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

/* ========= إعدادات السحب ========= */
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

/* ========= السحب الحقيقي =========
 * - إن وُجد TOKEN_MINT: يُرسل رمز ZELOFC (SPL) إلى محفظة اللاعب (وينشئ حساب الرمز له تلقائياً).
 * - إن لم يوجد: يُرسل SOL حقيقي بمعدل SOL_PER_TOKEN لكل رمز.
 *
 * التسلسل (كل خطوة تُسجَّل في جدول withdrawals):
 *   1) request_withdrawal: يتحقق من الحدود، يخصم النقاط ويسجّل العملية "pending" بقفل ذري واحد.
 *   2) تجهيز المعاملة وتوقيعها وحفظ توقيعها قبل إرسالها.
 *   3) الإرسال ثم انتظار التأكيد.
 *   4) النتيجة: sent (تكتمل) | failed (تُرد النقاط) | unknown (تُترك للمراجعة اليدوية ولا تُرد النقاط
 *      لأن المعاملة قد تكون وصلت فعلاً، وإعادتها تعني دفعاً مزدوجاً).
 */
const WITHDRAW_ERRORS = {
    user_not_found:      [404, 'User record not found'],
    wallet_missing:      [400, 'Solana wallet address is required'],
    below_minimum:       [400, `Minimum claim is ${MIN_CLAIM_POINTS} points`],
    insufficient_points: [400, 'Not enough points'],
    daily_limit_reached: [429, 'Daily withdrawal limit reached. Please try again later.']
};
function mapWithdrawError(err) {
    const msg = String(err?.message || '');
    for (const key of Object.keys(WITHDRAW_ERRORS)) {
        if (msg.includes(key)) return WITHDRAW_ERRORS[key];
    }
    return null;
}

async function rpcOrThrow(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
}

// إعادة النقاط وتسجيل العملية كفاشلة (لا تُستعمل إلا حين نتأكد أن المعاملة لم تصل)
async function refundWithdrawal(id, reason) {
    try {
        await rpcOrThrow('fail_withdrawal', { p_id: id, p_error: String(reason || 'failed').slice(0, 500) });
        console.log(`Withdrawal ${id} refunded: ${reason}`);
        return true;
    } catch (e) {
        console.error(`REFUND FAILED withdrawal=${id}`, e.message);
        return false;
    }
}

async function buildPayoutTx(treasury, playerPubkey, tokens) {
    const tx = new Transaction();
    let rewardText;

    if (TOKEN_MINT) {
        const spl = require('@solana/spl-token');
        const mint = new PublicKey(TOKEN_MINT);
        const fromAta = await spl.getAssociatedTokenAddress(mint, treasury.publicKey);
        const toAta = await spl.getAssociatedTokenAddress(mint, playerPubkey);
        const rawAmount = BigInt(tokens) * (10n ** BigInt(TOKEN_DECIMALS));

        let treasuryBal;
        try {
            const b = await connection.getTokenAccountBalance(fromAta);
            treasuryBal = BigInt(b.value.amount);
        } catch (e) {
            const err = new Error('Treasury token account not found');
            err.httpStatus = 500; err.publicMessage = 'Treasury token account not found. Mint tokens to the treasury first.';
            throw err;
        }
        if (treasuryBal < rawAmount) {
            const err = new Error('Treasury has insufficient tokens');
            err.httpStatus = 503; err.publicMessage = 'Treasury has insufficient tokens. Try again later.';
            throw err;
        }

        const toInfo = await connection.getAccountInfo(toAta);
        if (!toInfo) {
            tx.add(spl.createAssociatedTokenAccountInstruction(treasury.publicKey, toAta, playerPubkey, mint));
        }
        tx.add(spl.createTransferCheckedInstruction(fromAta, mint, toAta, treasury.publicKey, rawAmount, TOKEN_DECIMALS));
        rewardText = `${tokens} ${TOKEN_NAME}`;
    } else {
        const lamports = Math.round(tokens * SOL_PER_TOKEN * 1e9);
        const treasurySol = await connection.getBalance(treasury.publicKey);
        if (treasurySol < lamports + 10000) {
            const err = new Error('Treasury has insufficient SOL');
            err.httpStatus = 503; err.publicMessage = 'Treasury has insufficient SOL. Try again later.';
            throw err;
        }
        tx.add(SystemProgram.transfer({
            fromPubkey: treasury.publicKey,
            toPubkey: playerPubkey,
            lamports
        }));
        rewardText = `${(lamports / 1e9).toFixed(4)} SOL`;
    }
    return { tx, rewardText };
}

// يحدد مصير المعاملة بعد الإرسال: 'sent' | 'failed' | 'unknown'
async function waitForOutcome(signature, latest) {
    try {
        const r = await connection.confirmTransaction({
            signature,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight
        }, 'confirmed');
        return r?.value?.err ? 'failed' : 'sent';
    } catch (e) {
        console.warn('confirmTransaction did not settle:', e.message);
    }
    try {
        const st = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
        const s = st?.value?.[0];
        if (s) {
            if (s.err) return 'failed';
            if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return 'sent';
            return 'unknown';
        }
        // لا أثر للمعاملة: إن انتهت صلاحية الـ blockhash فهي لن تصل أبداً
        const height = await connection.getBlockHeight('confirmed');
        if (height > latest.lastValidBlockHeight) return 'failed';
    } catch (e) {
        console.warn('Outcome lookup failed:', e.message);
    }
    return 'unknown';
}

app.post('/api/claim', requireAuth, async (req, res) => {
    const userId = req.authUserId;                 // من التوكن فقط، وليس من الطلب
    const { userWalletAddress } = req.body || {};
    let withdrawalId = null;
    let broadcast = false;                         // بعد true قد تكون المعاملة وصلت، فلا نُرجع النقاط دون تأكد

    try {
        const treasury = getTreasuryKeypair();
        if (!treasury) {
            return res.status(500).json({ success: false, error: "Treasury private key is missing or invalid" });
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('points, solana_wallet')
            .eq('user_id', userId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ success: false, error: "User record not found" });
        }

        // نفضّل العنوان المحفوظ في الحساب (أكثر أماناً)، ثم العنوان المرسل
        const targetWallet = (userData.solana_wallet || userWalletAddress || '').trim();
        if (!targetWallet) {
            return res.status(400).json({ success: false, error: "Solana wallet address is required" });
        }

        let playerPubkey;
        try { playerPubkey = new PublicKey(targetWallet); }
        catch (e) { return res.status(400).json({ success: false, error: "Invalid Solana wallet address" }); }

        const points = Math.floor(Number(userData.points || 0));
        if (points < MIN_CLAIM_POINTS) {
            return res.status(400).json({ success: false, error: `Minimum claim is ${MIN_CLAIM_POINTS} points` });
        }
        const requestedPoints = Math.floor(points / COINS_PER_TOKEN) * COINS_PER_TOKEN;

        // 1) حجز السحب: التحقق من الحدود + خصم النقاط + تسجيل العملية (عملية واحدة ذرية)
        let reserved;
        try {
            reserved = await rpcOrThrow('request_withdrawal', {
                p_user_id: userId,
                p_wallet: playerPubkey.toBase58(),
                p_requested_points: requestedPoints
            });
        } catch (e) {
            const mapped = mapWithdrawError(e);
            if (mapped) return res.status(mapped[0]).json({ success: false, error: mapped[1] });
            throw e;
        }
        const row = Array.isArray(reserved) ? reserved[0] : reserved;
        if (!row || !row.out_id) throw new Error('request_withdrawal returned no row');
        withdrawalId = row.out_id;
        const coinsToDeduct = Number(row.out_points);
        const newBalance = Number(row.out_balance);
        const tokens = coinsToDeduct / COINS_PER_TOKEN;

        // 2) تجهيز المعاملة (فحص رصيد الخزنة). أي فشل هنا يعني أنه لم يُرسل شيء، فنُرجع النقاط
        let built;
        try {
            built = await buildPayoutTx(treasury, playerPubkey, tokens);
        } catch (e) {
            console.error('Build payout failed:', e.message);
            await refundWithdrawal(withdrawalId, e.message);
            withdrawalId = null;
            return res.status(e.httpStatus || 500).json({
                success: false,
                error: e.publicMessage || 'Could not prepare the transfer. Your points were returned.'
            });
        }
        const { tx, rewardText } = built;

        // 3) توقيع المعاملة وحفظ توقيعها قبل الإرسال (لنستطيع تتبعها لو انقطع الاتصال)
        tx.feePayer = treasury.publicKey;
        const latest = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = latest.blockhash;
        tx.sign(treasury);
        const signature = bs58.encode(tx.signature);
        await rpcOrThrow('mark_withdrawal_signature', { p_id: withdrawalId, p_sig: signature });

        // 4) الإرسال والتأكيد
        broadcast = true;
        let outcome;
        try {
            await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
            outcome = await waitForOutcome(signature, latest);
        } catch (sendErr) {
            console.error('Send error:', sendErr.message);
            // رفض المحاكاة قبل الإرسال يعني أن المعاملة لم تدخل الشبكة إطلاقاً
            if (sendErr?.name === 'SendTransactionError' || /simulation failed/i.test(String(sendErr?.message))) {
                outcome = 'failed';
            } else {
                outcome = await waitForOutcome(signature, latest);
            }
        }

        if (outcome === 'sent') {
            try {
                await rpcOrThrow('complete_withdrawal', { p_id: withdrawalId, p_sig: signature, p_reward_text: rewardText });
            } catch (e) {
                console.error(`SENT BUT NOT RECORDED withdrawal=${withdrawalId} tx=${signature}`, e.message);
            }
            console.log(`Claim OK user=${userId} points=${coinsToDeduct} reward=${rewardText} tx=${signature}`);
            return res.json({
                success: true,
                txHash: signature,
                tokens,
                rewardText,
                pointsClaimed: coinsToDeduct,
                newBalance,
                network: SOLANA_NETWORK
            });
        }

        if (outcome === 'failed') {
            await refundWithdrawal(withdrawalId, 'transfer failed on network');
            return res.status(500).json({ success: false, error: "The transfer failed and your points were returned. Please try again." });
        }

        // مصير غير معروف: لا نُرجع النقاط تلقائياً، نتركها للمراجعة اليدوية
        await rpcOrThrow('review_withdrawal', { p_id: withdrawalId, p_note: `unconfirmed tx=${signature}` }).catch(e => console.error('review mark failed', e.message));
        console.error(`WITHDRAWAL NEEDS REVIEW id=${withdrawalId} user=${userId} tx=${signature}`);
        return res.status(202).json({
            success: false,
            pending: true,
            txHash: signature,
            error: "The transfer is still being confirmed. Do not retry; check your wallet in a few minutes."
        });

    } catch (err) {
        console.error("Claim Transfer Error:", err);

        if (withdrawalId) {
            if (!broadcast) {
                await refundWithdrawal(withdrawalId, err.message);
            } else {
                // بعد الإرسال لا نعيد النقاط دون تأكد: قد تكون المعاملة وصلت
                await rpcOrThrow('review_withdrawal', { p_id: withdrawalId, p_note: `error after broadcast: ${err.message}` }).catch(() => {});
                console.error(`WITHDRAWAL NEEDS REVIEW id=${withdrawalId} user=${userId}`);
            }
        }

        return res.status(500).json({ success: false, error: "An error occurred during transfer processing. If points were deducted, they will be reviewed." });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Zelo FC Backend Server running on port ${PORT}`));
