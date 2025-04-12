import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';
import fs from 'fs/promises';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import figlet from 'figlet';
import gradient from 'gradient-string';

// Tampilkan header aplikasi yang menarik
console.log('\n');
console.log(
  gradient.pastel.multiline(
    figlet.textSync('TEA Send', {
      font: 'Standard',
      horizontalLayout: 'default'
    })
  )
);
console.log(gradient.rainbow('✨ Automated TEA Token Transaction Sender  by MRF✨\n'));

const RPC_URL = process.env.RPC_URL || "https://tea-sepolia.g.alchemy.com/public";
const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',') : [];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key, provider));

// Konfigurasi transaksi
const MIN_TRANSACTIONS = 125;
const MAX_TRANSACTIONS = 150;
const TOTAL_TRANSACTIONS_PER_DAY = Math.floor(Math.random() * (MAX_TRANSACTIONS - MIN_TRANSACTIONS + 1)) + MIN_TRANSACTIONS;

// Statistik
let transactionsDone = 0;
let recipientAddresses = [];
let totalAmountSent = 0;
let successfulTransactions = 0;
let failedTransactions = 0;

// Opsi boxen untuk panel
const boxenOptions = {
  padding: 1,
  margin: 1,
  borderStyle: 'round',
  borderColor: 'green'
};

// 📊 Tampilkan statistik transaksi
function displayStats() {
  const statsTable = new Table({
    head: [chalk.cyan('Statistik'), chalk.cyan('Nilai')],
    style: { head: [], border: [] }
  });
  
  statsTable.push(
    [chalk.green('Total Transaksi Target'), chalk.yellow(TOTAL_TRANSACTIONS_PER_DAY)],
    [chalk.green('Transaksi Selesai'), chalk.yellow(transactionsDone)],
    [chalk.green('Transaksi Sukses'), chalk.green(successfulTransactions)],
    [chalk.green('Transaksi Gagal'), chalk.red(failedTransactions)],
    [chalk.green('Total TEA Terkirim'), chalk.yellow(`${totalAmountSent.toFixed(4)} TEA`)],
    [chalk.green('Interval Antar Transaksi'), chalk.yellow(`${(1440 / TOTAL_TRANSACTIONS_PER_DAY).toFixed(2)} menit`)]
  );
  
  console.log(boxen(statsTable.toString(), {
    ...boxenOptions,
    title: chalk.white.bold('📊 Statistik Transaksi'),
    titleAlignment: 'center',
    borderColor: 'cyan'
  }));
}

// 🎯 Fungsi untuk membaca daftar alamat dari address.txt
async function loadRecipientAddresses() {
  const spinner = ora('Memuat daftar alamat penerima...').start();
  
  try {
    const data = await fs.readFile('address.txt', 'utf8');
    recipientAddresses = data.split('\n').map(line => line.trim()).filter(line => line);
    spinner.succeed(chalk.green(`Berhasil memuat ${recipientAddresses.length} alamat penerima`));
    
    const addressTable = new Table({
      head: [chalk.cyan('#'), chalk.cyan('Contoh Alamat')],
      colWidths: [5, 45],
      style: { head: [], border: [] }
    });
    
    // Tampilkan 5 alamat contoh
    for (let i = 0; i < Math.min(5, recipientAddresses.length); i++) {
      addressTable.push([i + 1, recipientAddresses[i]]);
    }
    
    if (recipientAddresses.length > 5) {
      addressTable.push(['...', `... dan ${recipientAddresses.length - 5} lainnya`]);
    }
    
    console.log(boxen(addressTable.toString(), {
      ...boxenOptions,
      title: chalk.white.bold('📋 Daftar Alamat'),
      titleAlignment: 'center',
      borderColor: 'yellow'
    }));
    
  } catch (error) {
    spinner.fail(chalk.red(`Error membaca file address.txt: ${error.message}`));
  }
}

// 🔥 Ambil alamat penerima secara acak
function getRandomRecipient() {
  if (recipientAddresses.length === 0) {
    console.log(boxen(
      chalk.red("❌ Tidak ada alamat penerima yang tersedia!"),
      {...boxenOptions, borderColor: 'red'}
    ));
    return null;
  }
  return recipientAddresses[Math.floor(Math.random() * recipientAddresses.length)];
}

// 🔥 Ambil wallet secara acak
function getRandomWallet() {
  if (wallets.length === 0) {
    console.log(boxen(
      chalk.red("❌ Tidak ada wallet yang tersedia!"),
      {...boxenOptions, borderColor: 'red'}
    ));
    return null;
  }
  return wallets[Math.floor(Math.random() * wallets.length)];
}

// 🎲 Generate random amount between 0.01 and 3 TEA
function getRandomAmount() {
  const min = 0.01;
  const max = 0.1;
  const randomAmount = (Math.random() * (max - min) + min).toFixed(4);
  return [ethers.parseEther(randomAmount), randomAmount];
}

// ⛽ Mengecek harga gas
async function checkGasFee() {
  const spinner = ora('Memeriksa harga gas jaringan...').start();
  
  try {
    const gasPrice = await provider.getFeeData();
    if (!gasPrice.gasPrice) {
      spinner.fail(chalk.red("Tidak dapat mengambil harga gas dari jaringan."));
      return;
    }
    
    const estimatedGasFee = gasPrice.gasPrice * BigInt(21000);
    spinner.succeed(chalk.green(`Berhasil mendapatkan harga gas jaringan`));
    
    const gasTable = new Table({
      style: { head: [], border: [] }
    });
    
    gasTable.push(
      [chalk.blue('⛽ Gas Price:'), chalk.yellow(`${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} Gwei`)],
      [chalk.blue('💰 Estimasi Fee:'), chalk.yellow(`${ethers.formatEther(estimatedGasFee)} TEA`)]
    );
    
    console.log(boxen(gasTable.toString(), {
      ...boxenOptions,
      title: chalk.white.bold('⛽ Informasi Gas'),
      titleAlignment: 'center',
      borderColor: 'blue'
    }));
  } catch (error) {
    spinner.fail(chalk.red(`Error saat memeriksa harga gas: ${error.message}`));
  }
}

// Fungsi untuk mendapatkan gas price acak berdasarkan kondisi jaringan
async function getRandomGasPrice() {
  const spinner = ora('Mengkonfigurasi harga gas...').start();
  
  try {
    const feeData = await provider.getFeeData();
    if (!feeData.gasPrice) {
      spinner.warn(chalk.yellow("Tidak dapat mengambil harga gas dari jaringan. Menggunakan nilai default."));
      return ethers.parseUnits("50", "gwei");
    }
    
    // Konversi gasPrice ke number untuk manipulasi
    const currentGasPrice = Number(ethers.formatUnits(feeData.gasPrice, "gwei"));
    
    // Tambahkan faktor acak antara 10% hingga 50% ke gas price saat ini
    const multiplier = 1 + (Math.random() * 0.4 + 0.1);
    const randomGasPrice = currentGasPrice * multiplier;
    
    // Pastikan gas price minimal 20 gwei dan maksimal 150 gwei
    const minGasPrice = 20;
    const maxGasPrice = 2000;
    const finalGasPrice = Math.min(Math.max(randomGasPrice, minGasPrice), maxGasPrice);
    
    spinner.succeed(chalk.green(`Gas price dikonfigurasi dengan bonus ${((multiplier-1)*100).toFixed(0)}%`));
    
    const gasTable = new Table({
      style: { head: [], border: [] }
    });
    
    gasTable.push(
      [chalk.blue('Network Gas Price:'), chalk.yellow(`${currentGasPrice.toFixed(2)} Gwei`)],
      [chalk.blue('Configured Gas Price:'), chalk.yellow(`${finalGasPrice.toFixed(2)} Gwei`)]
    );
    
    console.log(boxen(gasTable.toString(), {
      padding: 1,
      margin: 0,
      borderStyle: 'round',
      borderColor: 'blue'
    }));
    
    return ethers.parseUnits(finalGasPrice.toFixed(2), "gwei");
  } catch (error) {
    spinner.fail(chalk.red(`Error pada gas price: ${error.message}`));
    return ethers.parseUnits("50", "gwei"); // Default fallback
  }
}

// 📤 Mengirim transaksi ke alamat acak
async function sendTransaction() {
  if (transactionsDone >= TOTAL_TRANSACTIONS_PER_DAY) {
    console.log(boxen(
      chalk.yellow("🚀 Batas transaksi harian telah tercapai!"),
      {...boxenOptions, borderColor: 'yellow'}
    ));
    return;
  }

  console.log('\n' + gradient.cristal('━━━━━━━━━━━━━━━━ TRANSAKSI BARU ━━━━━━━━━━━━━━━━') + '\n');

  try {
    const recipient = getRandomRecipient();
    if (!recipient || !ethers.isAddress(recipient)) {
      console.error(boxen(
        chalk.red(`❌ Alamat penerima tidak valid: ${recipient}`),
        {...boxenOptions, borderColor: 'red'}
      ));
      return;
    }

    const wallet = getRandomWallet();
    if (!wallet) return;

    // Periksa saldo wallet
    const balanceSpinner = ora('Memeriksa saldo wallet...').start();
    const balance = await provider.getBalance(wallet.address);
    balanceSpinner.succeed(chalk.green(`Saldo wallet: ${ethers.formatEther(balance)} TEA`));

    // Set gas price acak
    const gasPriceValue = await getRandomGasPrice();
    
    // Generate random amount
    const [amount, amountString] = getRandomAmount();
    console.log(chalk.green(`💸 Jumlah transaksi: ${amountString} TEA`));
    
    // Set gas limit default
    const gasLimit = BigInt(21000);
    const totalEstimatedGasFee = gasPriceValue * gasLimit;

    // Informasi transaksi
    const txInfoTable = new Table({
      style: { head: [], border: [] }
    });
    
    txInfoTable.push(
      [chalk.cyan('Dari Wallet:'), chalk.yellow(wallet.address)],
      [chalk.cyan('Ke Alamat:'), chalk.yellow(recipient)],
      [chalk.cyan('Jumlah:'), chalk.yellow(`${amountString} TEA`)],
      [chalk.cyan('Estimasi Fee:'), chalk.yellow(`${ethers.formatEther(totalEstimatedGasFee)} TEA`)]
    );
    
    console.log(boxen(txInfoTable.toString(), {
      ...boxenOptions,
      title: chalk.white.bold('🔄 Detail Transaksi'),
      titleAlignment: 'center',
      borderColor: 'magenta'
    }));

    // Cek saldo mencukupi
    if (balance < (amount + totalEstimatedGasFee)) {
      console.log(boxen(
        chalk.red(`❌ Saldo tidak mencukupi di wallet ${wallet.address} untuk melakukan transaksi!`),
        {...boxenOptions, borderColor: 'red'}
      ));
      failedTransactions++;
      return;
    }

    let tx;
    let success = false;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    while (!success && retryCount < MAX_RETRIES) {
      try {
        const txSpinner = ora('Mengirim transaksi...').start();
        
        tx = await wallet.sendTransaction({
          to: recipient,
          value: amount,
          gasPrice: gasPriceValue,
          gasLimit: gasLimit
        });

        txSpinner.succeed(chalk.green(`Transaksi terkirim dengan hash: ${tx.hash}`));
        
        const confirmSpinner = ora('Menunggu konfirmasi blockchain...').start();
        const receipt = await tx.wait();
        
        if (receipt && receipt.status === 1) {
          success = true;
          confirmSpinner.succeed(chalk.green(`Transaksi terkonfirmasi di blok ${receipt.blockNumber}`));
          
          console.log(boxen(
            gradient.pastel(`✅ Transaksi berhasil!`),
            {...boxenOptions, borderColor: 'green'}
          ));
        } else {
          confirmSpinner.fail(chalk.red('Transaksi gagal di blockchain'));
          throw new Error("Transaksi gagal pada blockchain");
        }
      } catch (error) {
        retryCount++;
        console.error(boxen(
          chalk.red(`❌ Percobaan transaksi ${retryCount}/${MAX_RETRIES} gagal: ${error.message}`),
          {...boxenOptions, borderColor: 'red'}
        ));
        
        if (retryCount < MAX_RETRIES) {
          const retrySpinner = ora(`Mencoba ulang dalam 10 detik...`).start();
          await new Promise(resolve => setTimeout(resolve, 10000));
          retrySpinner.stop();
        } else {
          console.error(boxen(
            chalk.red("❌ Batas percobaan ulang tercapai. Beralih ke transaksi berikutnya."),
            {...boxenOptions, borderColor: 'red'}
          ));
          failedTransactions++;
        }
      }
    }

    if (success) {
      transactionsDone++;
      successfulTransactions++;
      totalAmountSent += parseFloat(amountString);
      
      console.log(boxen(
        gradient.rainbow(`✅ BERHASIL mengirim ${amountString} TEA ke ${recipient}\nTransaksi ke-${transactionsDone} dari ${TOTAL_TRANSACTIONS_PER_DAY} hari ini`),
        {...boxenOptions, title: chalk.white.bold('💎 SUKSES'), titleAlignment: 'center', borderColor: 'green'}
      ));
    }
  } catch (error) {
    console.error(boxen(
      chalk.red(`❌ Error dalam proses transaksi: ${error.message}`),
      {...boxenOptions, borderColor: 'red'}
    ));
    failedTransactions++;
  }
}

// 🕒 Menjadwalkan transaksi dengan waktu lebih efisien
async function scheduleTransactions() {
  const delayInMinutes = 1440 / TOTAL_TRANSACTIONS_PER_DAY; // Hitung jeda waktu dalam menit
  const delayInMilliseconds = delayInMinutes * 60 * 1000; // Konversi ke milidetik
  let count = 0;

  console.log(boxen(
    gradient.atlas(`📅 Terjadwal untuk mengirim ${TOTAL_TRANSACTIONS_PER_DAY} transaksi hari ini\n⏱️ Interval: ${delayInMinutes.toFixed(2)} menit antar transaksi`),
    {...boxenOptions, title: chalk.white.bold('🚀 Scheduler'), titleAlignment: 'center', borderColor: 'blue'}
  ));

  // Tampilkan statistik awal
  displayStats();

  while (count < TOTAL_TRANSACTIONS_PER_DAY) {
    try {
      await sendTransaction(); // Tunggu hingga transaksi selesai
      count++;

      // Update statistik setelah setiap transaksi
      displayStats();

      if (count < TOTAL_TRANSACTIONS_PER_DAY) {
        console.log(boxen(
          chalk.yellow(`⏳ Menunggu ${delayInMinutes.toFixed(2)} menit sebelum transaksi berikutnya...`),
          {...boxenOptions, title: chalk.white.bold('⏱️ Timer'), borderColor: 'yellow'}
        ));
        
        // Timer dengan tampilan yang lebih menarik
        const startTime = Date.now();
        const endTime = startTime + delayInMilliseconds;
        
        const timerSpinner = ora({
          text: 'Menunggu waktu transaksi berikutnya...',
          color: 'yellow'
        }).start();
        
        while (Date.now() < endTime) {
          const remainingMs = endTime - Date.now();
          const remainingMinutes = Math.floor(remainingMs / 60000);
          const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
          timerSpinner.text = chalk.yellow(`⏳ Waktu tersisa: ${remainingMinutes}m ${remainingSeconds}s`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        timerSpinner.succeed(chalk.green('✅ Waktu tunggu selesai, memulai transaksi berikutnya'));
      }
    } catch (error) {
      console.error(boxen(
        chalk.red(`❌ Error saat penjadwalan transaksi: ${error.message}`),
        {...boxenOptions, borderColor: 'red'}
      ));
    }
  }

  console.log(boxen(
    gradient.rainbow(`🎉 Semua ${TOTAL_TRANSACTIONS_PER_DAY} transaksi untuk hari ini telah selesai!\n` +
    `📊 Total TEA terkirim: ${totalAmountSent.toFixed(4)} TEA\n` +
    `✅ Transaksi sukses: ${successfulTransactions}\n` +
    `❌ Transaksi gagal: ${failedTransactions}`),
    {...boxenOptions, title: chalk.white.bold('✨ SELESAI'), titleAlignment: 'center', borderColor: 'magenta'}
  ));
}

// 🚀 Jalankan kode utama
(async () => {
  console.log(boxen(
    gradient.pastel('🚀 Memulai aplikasi TEA Send...\n📡 Terhubung ke: ' + RPC_URL),
    {...boxenOptions, title: chalk.white.bold('🔰 Inisialisasi'), titleAlignment: 'center', borderColor: 'blue'}
  ));
  
  // Validasi konfigurasi
  if (wallets.length === 0) {
    console.error(boxen(
      chalk.red("❌ Tidak ada private key yang disediakan dalam environment variables."),
      {...boxenOptions, borderColor: 'red'}
    ));
    process.exit(1);
  }
  
  console.log(boxen(
    chalk.green(`✅ Berhasil memuat ${wallets.length} wallet\n🎯 Target transaksi: ${TOTAL_TRANSACTIONS_PER_DAY} per hari`),
    {...boxenOptions, borderColor: 'green'}
  ));
  
  await loadRecipientAddresses();
  await checkGasFee();
  
  console.log(boxen(
    gradient.cristal('🔄 Memulai penjadwal transaksi...'),
    {...boxenOptions, borderColor: 'blue'}
  ));
  
  await scheduleTransactions();
})();