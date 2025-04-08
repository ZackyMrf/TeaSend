import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';
import fs from 'fs/promises';
import chalk from 'chalk';

const RPC_URL = process.env.RPC_URL || "https://tea-sepolia.g.alchemy.com/public";
const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',') : [];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key, provider));

const MIN_TRANSACTIONS = 125;
const MAX_TRANSACTIONS = 150;
const TOTAL_TRANSACTIONS_PER_DAY = Math.floor(Math.random() * (MAX_TRANSACTIONS - MIN_TRANSACTIONS + 1)) + MIN_TRANSACTIONS;

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

// 🎲 Generate random amount between 0.01 and 3 TEA
function getRandomAmount() {
    // Random between 0.01 and 3 with 2 decimal precision
    const min = 0.01;
    const max = 3;
    const randomAmount = (Math.random() * (max - min) + min).toFixed(2);
    return ethers.parseEther(randomAmount.toString());
}

// ⛽ Mengecek harga gas
async function checkGasFee() {
    try {
        const gasPrice = await provider.getFeeData();
        if (!gasPrice.gasPrice) {
            console.log(chalk.red("❌ Unable to fetch gas price from the network."));
            return;
        }
        const estimatedGasFee = gasPrice.gasPrice * BigInt(21000);
        console.log(chalk.blue(`⛽ Gas Price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} Gwei`));
        console.log(chalk.blue(`💰 Estimated Gas Fee: ${ethers.formatEther(estimatedGasFee)} TEA`));
    } catch (error) {
        console.error(chalk.red("❌ Error fetching gas fee:", error));
    }
}

// 📤 Mengirim transaksi ke alamat acak
async function sendTransaction() {
    if (transactionsDone >= TOTAL_TRANSACTIONS_PER_DAY) {
        console.log(chalk.yellow("🚀 Daily transaction limit has been reached!"));
        return;
    }

    try {
        const recipient = getRandomRecipient();
        if (!recipient || !ethers.isAddress(recipient)) {
            console.error(chalk.red(`❌ Invalid recipient address: ${recipient}`));
            return;
        }

        const wallet = getRandomWallet();
        if (!wallet) return;

        // Periksa saldo wallet
        const balance = await provider.getBalance(wallet.address);
        console.log(chalk.blue(`💰 Wallet Balance: ${ethers.formatEther(balance)} ETH`));

        // Set gas price maksimal untuk mengatasi masalah "replacement fee too low"
        const gasPriceValue = ethers.parseUnits("100", "gwei"); // Gas price tinggi untuk memastikan transaksi cepat
        
        // Generate random amount between 0.01 and 3 TEA
        const amount = getRandomAmount();
        const amountInETH = ethers.formatEther(amount);
        console.log(chalk.blue(`💸 Random Amount: ${amountInETH} TEA`));
        
        // Set gas limit default
        const gasLimit = BigInt(21000);
        
        const totalEstimatedGasFee = gasPriceValue * gasLimit;

        // Menggunakan operator perbandingan langsung untuk BigInt
        if (balance < (amount + totalEstimatedGasFee)) {
            console.log(chalk.red(`❌ Insufficient balance in wallet ${wallet.address} to send transaction!`));
            return;
        }

        console.log(chalk.yellow(`🔑 Using wallet: ${wallet.address}`));

        let tx;
        let success = false;
        let retryCount = 0;
        const MAX_RETRIES = 5;

        while (!success && retryCount < MAX_RETRIES) {
            try {
                tx = await wallet.sendTransaction({
                    to: recipient,
                    value: amount,
                    gasPrice: gasPriceValue,
                    gasLimit: gasLimit
                });

                console.log(chalk.cyan(`🔗 Tx Hash: ${tx.hash}`));
                
                // Tunggu hingga transaksi selesai
                console.log(chalk.yellow("⏳ Waiting for transaction confirmation..."));
                const receipt = await tx.wait();
                
                if (receipt && receipt.status === 1) {
                    success = true;
                    console.log(chalk.green(`✅ Transaction confirmed in block ${receipt.blockNumber}`));
                } else {
                    throw new Error("Transaction failed on the blockchain");
                }
            } catch (error) {
                retryCount++;
                console.error(chalk.red(`❌ Transaction attempt ${retryCount}/${MAX_RETRIES} failed:`, error.message));
                
                if (retryCount < MAX_RETRIES) {
                    console.log(chalk.yellow(`🔄 Retrying transaction in 10 seconds...`));
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    console.error(chalk.red("❌ Max retries reached. Moving to next transaction."));
                }
            }
        }

        if (success) {
            transactionsDone++;
            console.log(chalk.green(`✅ SEND ${amountInETH} TEA TO ${recipient} | Transaksi ke-${transactionsDone} hari ini`));
        }
    } catch (error) {
        console.error(chalk.red("❌ Error in transaction process:", error.message));
    }
}

// 🕒 Menjadwalkan transaksi dengan waktu lebih efisien
async function scheduleTransactions() {
    const delayInMinutes = 1440 / TOTAL_TRANSACTIONS_PER_DAY; // Hitung jeda waktu dalam menit
    const delayInMilliseconds = delayInMinutes * 60 * 1000; // Konversi ke milidetik
    let count = 0;

    console.log(chalk.blue(`🔄 Scheduled to send ${TOTAL_TRANSACTIONS_PER_DAY} transactions today (${delayInMinutes.toFixed(2)} minutes between each transaction).`));

    while (count < TOTAL_TRANSACTIONS_PER_DAY) {
        try {
            await sendTransaction(); // Tunggu hingga transaksi selesai
            count++;
            console.log(chalk.green(`✅ Transaction ${count}/${TOTAL_TRANSACTIONS_PER_DAY} completed.`));

            if (count < TOTAL_TRANSACTIONS_PER_DAY) {
                console.log(chalk.yellow(`⏳ Waiting for ${delayInMinutes.toFixed(2)} minutes before the next transaction...`));
                
                // Timer untuk menunjukkan waktu mundur
                const startTime = Date.now();
                const endTime = startTime + delayInMilliseconds;
                
                while (Date.now() < endTime) {
                    const remainingMs = endTime - Date.now();
                    const remainingSeconds = Math.ceil(remainingMs / 1000);
                    process.stdout.write(`\r⏳ Time remaining: ${remainingSeconds}s `);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                console.log(); // Pindah ke baris baru setelah timer selesai
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error during transaction scheduling: ${error.message}`));
        }
    }

    console.log(chalk.magenta(`✅ All ${TOTAL_TRANSACTIONS_PER_DAY} transactions scheduled for today have been completed.`));
}
// 🚀 Jalankan kode utama
(async () => {
    console.log(chalk.blue("🚀 Starting TEA Send application..."));
    
    // Validasi konfigurasi
    if (wallets.length === 0) {
        console.error(chalk.red("❌ No private keys provided in the environment variables."));
        process.exit(1);
    }
    
    console.log(chalk.green(`✅ Loaded ${wallets.length} wallet(s).`));
    
    await loadRecipientAddresses();
    await checkGasFee();
    
    console.log(chalk.blue("🔄 Starting transaction scheduler..."));
    await scheduleTransactions();
})();