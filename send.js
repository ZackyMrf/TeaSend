import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';
import fs from 'fs/promises';
import chalk from 'chalk';

const RPC_URL = process.env.RPC_URL || "https://tea-sepolia.g.alchemy.com/public";
const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',') : [];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key, provider));

const TOTAL_TRANSACTIONS_PER_DAY = 200;
let transactionsDone = 0;
let recipientAddresses = [];

// 🎯 Fungsi untuk membaca daftar alamat dari address.txt
async function loadRecipientAddresses() {
    try {
        const data = await fs.readFile('address.txt', 'utf8');
        recipientAddresses = data.split('\n').map(line => line.trim()).filter(line => line);
        console.log(chalk.green(`✅ Loaded ${recipientAddresses.length} recipient addresses.`));
    } catch (error) {
        console.error(chalk.red("❌ Error reading address file:", error));
    }
}

// 🔥 Ambil alamat penerima secara acak
function getRandomRecipient() {
    if (recipientAddresses.length === 0) {
        console.log(chalk.red("❌ No recipient addresses available!"));
        return null;
    }
    return recipientAddresses[Math.floor(Math.random() * recipientAddresses.length)];
}

// 🔥 Ambil wallet secara acak
function getRandomWallet() {
    if (wallets.length === 0) {
        console.log(chalk.red("❌ No wallets available!"));
        return null;
    }
    return wallets[Math.floor(Math.random() * wallets.length)];
}

// ⛽ Mengecek harga gas
async function checkGasFee() {
    const gasPrice = await provider.getFeeData();
    const estimatedGasFee = gasPrice.gasPrice ? gasPrice.gasPrice * BigInt(21000) : BigInt(0);
    console.log(chalk.blue(`⛽ Gas Price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} Gwei`));
    console.log(chalk.blue(`💰 Estimated Gas Fee: ${ethers.formatEther(estimatedGasFee)} TEA`));
}

// 📤 Mengirim transaksi ke alamat acak
async function sendTransaction() {
    if (transactionsDone >= TOTAL_TRANSACTIONS_PER_DAY) {
        console.log(chalk.yellow("🚀 Daily transaction limit has been reached!"));
        return;
    }

    try {
        const recipient = getRandomRecipient();
        if (!recipient) return;

        const wallet = getRandomWallet();
        if (!wallet) return;

        const balance = await provider.getBalance(wallet.address);
        const gasPrice = ethers.parseUnits("50", "gwei"); // Tetapkan gas fee maksimum
        const estimatedGasFee = gasPrice * BigInt(21000);
        const amount = ethers.parseEther("0.001");

        if (balance < amount + estimatedGasFee) {
            console.log(chalk.red(`❌ Insufficient balance in wallet ${wallet.address} to send transaction!`));
            return;
        }

        console.log(chalk.yellow(`🔑 Using wallet: ${wallet.address}`));

        const tx = await wallet.sendTransaction({
            to: recipient,
            value: amount,
            gasPrice: gasPrice
        });

        transactionsDone++;
        console.log(chalk.green(`📤 SEND 0.001 TEA TO ${recipient} | Transaksi ke-${transactionsDone} hari ini`));
        console.log(chalk.cyan(`🔗 Tx Hash: ${tx.hash}`));

        await tx.wait(); // Tunggu hingga transaksi selesai
    } catch (error) {
        console.error(chalk.red("❌ Transaction Error:", error));
    }
}


// 🕒 Menjadwalkan transaksi dengan waktu lebih cepat & efisien
async function scheduleTransactions() {
    const delayInMinutes = 1440 / TOTAL_TRANSACTIONS_PER_DAY; // Hitung jeda waktu dalam menit
    const delayInMilliseconds = delayInMinutes * 60 * 1000; // Konversi ke milidetik
    let count = 0;

    while (count < TOTAL_TRANSACTIONS_PER_DAY) {
        try {
            await sendTransaction(); // Tunggu hingga transaksi selesai
            count++;
            console.log(chalk.green(`✅ Transaction ${count} completed.`));

            if (count < TOTAL_TRANSACTIONS_PER_DAY) {
                console.log(chalk.yellow(`⏳ Waiting for ${delayInMinutes.toFixed(2)} minutes before the next transaction...`));

                // Timer untuk menunjukkan waktu mundur
                for (let remaining = delayInMilliseconds / 1000; remaining > 0; remaining--) {
                    process.stdout.write(`\r⏳ Time remaining: ${remaining}s `);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Tunggu 1 detik
                }
                console.log(); // Pindah ke baris baru setelah timer selesai
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error during transaction scheduling: ${error.message}`));
        }
    }

    console.log(chalk.magenta("✅ All transactions scheduled for today."));
}
// 🚀 Jalankan kode utama
(async () => {
    if (wallets.length === 0) {
        console.error(chalk.red("❌ No private keys provided in the environment variables."));
        return;
    }
    await loadRecipientAddresses();
    await checkGasFee();
    scheduleTransactions();
})();
