const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const bs58 = require('bs58');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');

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

app.get('/', (req, res) => res.send('Zelo FC Backend Server is running smoothly 🚀'));

app.get('/api/user-info', async (req, res) => {
    const { telegramId } = req.query;

    if (!telegramId || telegramId === 'guest') {
        return res.status(400).json({ success: false, error: "Invalid or missing User ID" });
    }
    if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('solana_wallet, points')
            .eq('telegram_id', telegramId)
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

app.post('/api/save-wallet', async (req, res) => {
    const { telegramId, walletType, walletAddress } = req.body;

    if (!telegramId || telegramId === 'guest') {
        return res.status(400).json({ success: false, error: "Invalid or missing User ID" });
    }
    if (!walletAddress || walletType !== 'solana') {
        return res.status(400).json({ success: false, error: "Invalid wallet type or address" });
    }
    if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
    }

    const cleanAddress = walletAddress.trim();

    try {
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('telegram_id')
            .eq('solana_wallet', cleanAddress)
            .neq('telegram_id', telegramId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: "This Solana wallet address is already linked to another account."
            });
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ solana_wallet: cleanAddress })
            .eq('telegram_id', telegramId);

        if (updateError) throw updateError;

        return res.json({ success: true, message: "Solana wallet address saved successfully." });
    } catch (err) {
        console.error("Save Wallet Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/claim', async (req, res) => {
    const { userWalletAddress, telegramId } = req.body;

    try {
        if (!telegramId || telegramId === 'guest') {
            return res.status(400).json({ success: false, error: "Invalid User ID" });
        }
        if (!supabase) {
            return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
        }

        const treasuryKeypair = getTreasuryKeypair();
        if (!treasuryKeypair) {
            return res.status(500).json({ success: false, error: "Treasury private key is missing or invalid" });
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('points, solana_wallet')
            .eq('telegram_id', telegramId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ success: false, error: "User record not found" });
        }

        const targetWallet = (userWalletAddress || userData.solana_wallet || '').trim();

        if (!targetWallet) {
            return res.status(400).json({ success: false, error: "Solana wallet address is required" });
        }

        const userCoins = Number(userData.points || 0);

        if (userCoins <= 0) {
            return res.status(400).json({ success: false, error: "Insufficient points balance to claim rewards" });
        }

        const playerPubkey = new PublicKey(targetWallet);
        const solRewardInLamports = 1000000;

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: treasuryKeypair.publicKey,
                toPubkey: playerPubkey,
                lamports: solRewardInLamports,
            })
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair]);

        await supabase
            .from('users')
            .update({ points: 0 })
            .eq('telegramId', telegramId); // تم التصحيح ليتوافق مع العمود في جدول users

        return res.json({ 
            success: true, 
            txHash: signature,
            pointsClaimed: userCoins,
            solReward: 0.001,
            newBalance: 0
        });

    } catch (err) {
        console.error("Claim Transfer Error:", err);
        return res.status(500).json({ success: false, error: err.message || "An error occurred during transfer processing" });
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
        const expectedUnit = (process.env.ADMOB_REWARD_AD_UNIT_ID || '').trim();
        const { user_id, transaction_id, ad_unit } = req.query;
        if (!expectedUnit || String(ad_unit) !== expectedUnit) {
            console.warn('AdMob SSV: unexpected ad_unit', ad_unit);
            return res.status(200).send('ignored');
        }
        if (!user_id || !transaction_id) return res.status(400).send('missing params');

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
                                         
