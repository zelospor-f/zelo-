const express = require('express');
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
        return res.status(400).json({ success: false, error: "Invalid or missing Telegram ID" });
    }
    if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('solana_wallet, ton_wallet, points')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (error) throw error;

        return res.json({
            success: true,
            solanaWallet: data?.solana_wallet || '',
            tonWallet: data?.ton_wallet || '',
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
        return res.status(400).json({ success: false, error: "Invalid or missing Telegram ID" });
    }
    if (!walletAddress || !walletType || !['solana', 'ton'].includes(walletType)) {
        return res.status(400).json({ success: false, error: "Invalid wallet type or address" });
    }
    if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase connection not initialized" });
    }

    const walletColumn = walletType === 'solana' ? 'solana_wallet' : 'ton_wallet';
    const cleanAddress = walletAddress.trim();

    try {
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('telegram_id')
            .eq(walletColumn, cleanAddress)
            .neq('telegram_id', telegramId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: "This wallet address is already linked to another account."
            });
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ [walletColumn]: cleanAddress })
            .eq('telegram_id', telegramId);

        if (updateError) throw updateError;

        return res.json({ success: true, message: "Wallet address saved successfully." });
    } catch (err) {
        console.error("Save Wallet Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/claim', async (req, res) => {
    const { userWalletAddress, telegramId } = req.body;

    try {
        if (!telegramId || telegramId === 'guest') {
            return res.status(400).json({ success: false, error: "Invalid Telegram ID" });
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
            .eq('telegram_id', telegramId);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Zelo FC Backend Server running on port ${PORT}`));
