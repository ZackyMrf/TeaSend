import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';
import fs from 'fs/promises';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import figlet from 'figlet';

// Simple application header
console.log('\n' + chalk.cyan(figlet.textSync('TEA Send', { font: 'Standard' })));
console.log(chalk.blue('Automated TEA Token Transaction Sender by MRF\n'));

// Configuration
const RPC_URL = process.env.RPC_URL || "https://tea-sepolia.g.alchemy.com/public";
const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',') : [];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key, provider));

// Transaction settings
const MIN_TRANSACTIONS = 125;
const MAX_TRANSACTIONS = 150;
const TOTAL_TRANSACTIONS_PER_DAY = Math.floor(Math.random() * (MAX_TRANSACTIONS - MIN_TRANSACTIONS + 1)) + MIN_TRANSACTIONS;

// Statistics tracking
let transactionsDone = 0;
let recipientAddresses = [];
let totalAmountSent = 0;
let successfulTransactions = 0;
let failedTransactions = 0;

// Simple box style for important messages
const boxOptions = {
  padding: 1,
  borderStyle: 'single',
  borderColor: 'blue'
};

// Display transaction statistics
function displayStats() {
  console.log('\n' + chalk.cyan('📊 STATISTICS:'));
  console.log(`- Target: ${chalk.yellow(TOTAL_TRANSACTIONS_PER_DAY)} transactions`);
  console.log(`- Completed: ${chalk.yellow(transactionsDone)} (${chalk.green(successfulTransactions)} success, ${chalk.red(failedTransactions)} failed)`);
  console.log(`- Total sent: ${chalk.yellow(totalAmountSent.toFixed(4))} TEA`);
  console.log(`- Interval: ${chalk.yellow((1440 / TOTAL_TRANSACTIONS_PER_DAY).toFixed(2))} minutes`);
  console.log('');
}

// Load recipient addresses from file
async function loadRecipientAddresses() {
  const spinner = ora('Loading recipient addresses...').start();
  
  try {
    const data = await fs.readFile('address.txt', 'utf8');
    recipientAddresses = data.split('\n').map(line => line.trim()).filter(line => line);
    spinner.succeed(`Loaded ${recipientAddresses.length} recipient addresses`);
    
    // Show a few sample addresses
    if (recipientAddresses.length > 0) {
      console.log(chalk.dim(`Sample addresses: ${recipientAddresses.slice(0, 3).join(', ')}${recipientAddresses.length > 3 ? '...' : ''}`));
    }
  } catch (error) {
    spinner.fail(`Error reading address.txt: ${error.message}`);
  }
}

// Get random recipient address
function getRandomRecipient() {
  if (recipientAddresses.length === 0) {
    console.log(chalk.red("❌ No recipient addresses available!"));
    return null;
  }
  return recipientAddresses[Math.floor(Math.random() * recipientAddresses.length)];
}

// Get random wallet
function getRandomWallet() {
  if (wallets.length === 0) {
    console.log(chalk.red("❌ No wallets available!"));
    return null;
  }
  return wallets[Math.floor(Math.random() * wallets.length)];
}

// Generate random TEA amount
function getRandomAmount() {
  const min = 0.01;
  const max = 0.1;
  const randomAmount = (Math.random() * (max - min) + min).toFixed(4);
  return [ethers.parseEther(randomAmount), randomAmount];
}

// Check current gas fee
async function checkGasFee() {
  const spinner = ora('Checking network gas price...').start();
  
  try {
    const gasPrice = await provider.getFeeData();
    if (!gasPrice.gasPrice) {
      spinner.fail("Couldn't get gas price from network.");
      return;
    }
    
    const estimatedGasFee = gasPrice.gasPrice * BigInt(21000);
    spinner.succeed(`Current gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} Gwei`);
    console.log(`Estimated fee: ${chalk.yellow(ethers.formatEther(estimatedGasFee))} TEA`);
  } catch (error) {
    spinner.fail(`Error checking gas price: ${error.message}`);
  }
}

// Get random gas price based on network conditions
async function getRandomGasPrice() {
  try {
    const feeData = await provider.getFeeData();
    if (!feeData.gasPrice) {
      return ethers.parseUnits("50", "gwei");
    }
    
    const currentGasPrice = Number(ethers.formatUnits(feeData.gasPrice, "gwei"));
    const multiplier = 1 + (Math.random() * 0.4 + 0.1);
    const randomGasPrice = currentGasPrice * multiplier;
    
    const minGasPrice = 20;
    const maxGasPrice = 2000;
    const finalGasPrice = Math.min(Math.max(randomGasPrice, minGasPrice), maxGasPrice);
    
    return ethers.parseUnits(finalGasPrice.toFixed(2), "gwei");
  } catch (error) {
    console.log(chalk.yellow(`Gas price error: ${error.message}. Using default.`));
    return ethers.parseUnits("50", "gwei");
  }
}

// Send transaction to random address
async function sendTransaction() {
  if (transactionsDone >= TOTAL_TRANSACTIONS_PER_DAY) {
    console.log(chalk.yellow("🚀 Daily transaction limit reached!"));
    return;
  }

  console.log(chalk.cyan('\n========== NEW TRANSACTION =========='));

  try {
    const recipient = getRandomRecipient();
    if (!recipient || !ethers.isAddress(recipient)) {
      console.error(chalk.red(`❌ Invalid recipient address: ${recipient}`));
      return;
    }

    const wallet = getRandomWallet();
    if (!wallet) return;

    // Check wallet balance
    const balanceSpinner = ora('Checking wallet balance...').start();
    const balance = await provider.getBalance(wallet.address);
    balanceSpinner.succeed(`Wallet balance: ${ethers.formatEther(balance)} TEA`);

    // Set random gas price
    const gasPriceValue = await getRandomGasPrice();
    
    // Generate random amount
    const [amount, amountString] = getRandomAmount();
    
    // Set default gas limit
    const gasLimit = BigInt(21000);
    const totalEstimatedGasFee = gasPriceValue * gasLimit;

    // Transaction info
    console.log(chalk.cyan('Transaction Details:'));
    console.log(`- From: ${chalk.yellow(wallet.address.slice(0, 10) + '...' + wallet.address.slice(-8))}`);
    console.log(`- To:   ${chalk.yellow(recipient.slice(0, 10) + '...' + recipient.slice(-8))}`);
    console.log(`- Amount: ${chalk.yellow(amountString)} TEA`);
    console.log(`- Fee: ~${chalk.yellow(ethers.formatEther(totalEstimatedGasFee))} TEA`);

    // Check sufficient balance
    if (balance < (amount + totalEstimatedGasFee)) {
      console.log(chalk.red(`❌ Insufficient balance for transaction!`));
      failedTransactions++;
      return;
    }

    let success = false;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    while (!success && retryCount < MAX_RETRIES) {
      try {
        const txSpinner = ora('Sending transaction...').start();
        
        const tx = await wallet.sendTransaction({
          to: recipient,
          value: amount,
          gasPrice: gasPriceValue,
          gasLimit: gasLimit
        });

        txSpinner.succeed(`Transaction sent with hash: ${tx.hash}`);
        
        const confirmSpinner = ora('Waiting for blockchain confirmation...').start();
        const receipt = await tx.wait();
        
        if (receipt && receipt.status === 1) {
          success = true;
          confirmSpinner.succeed(`Transaction confirmed in block ${receipt.blockNumber}`);
          console.log(chalk.green(`✅ Transaction successful!`));
        } else {
          confirmSpinner.fail('Transaction failed on blockchain');
          throw new Error("Transaction failed on blockchain");
        }
      } catch (error) {
        retryCount++;
        console.error(chalk.red(`❌ Transaction attempt ${retryCount}/${MAX_RETRIES} failed: ${error.message}`));
        
        if (retryCount < MAX_RETRIES) {
          const retrySpinner = ora(`Retrying in 10 seconds...`).start();
          await new Promise(resolve => setTimeout(resolve, 10000));
          retrySpinner.stop();
        } else {
          console.error(chalk.red("❌ Max retries reached. Moving to next transaction."));
          failedTransactions++;
        }
      }
    }

    if (success) {
      transactionsDone++;
      successfulTransactions++;
      totalAmountSent += parseFloat(amountString);
      
      console.log(boxen(
        chalk.green(`✅ Successfully sent ${amountString} TEA to ${recipient}\nTransaction ${transactionsDone} of ${TOTAL_TRANSACTIONS_PER_DAY} today`),
        boxOptions
      ));
    }
  } catch (error) {
    console.error(chalk.red(`❌ Transaction process error: ${error.message}`));
    failedTransactions++;
  }
}

// Schedule transactions with efficient timing
async function scheduleTransactions() {
  const delayInMinutes = 1440 / TOTAL_TRANSACTIONS_PER_DAY;
  const delayInMilliseconds = delayInMinutes * 60 * 1000;
  let count = 0;

  console.log(chalk.blue(`📅 Scheduled to send ${TOTAL_TRANSACTIONS_PER_DAY} transactions today`));
  console.log(chalk.blue(`⏱️ Interval: ${delayInMinutes.toFixed(2)} minutes between transactions`));

  // Display initial stats
  displayStats();

  while (count < TOTAL_TRANSACTIONS_PER_DAY) {
    try {
      await sendTransaction();
      count++;

      // Update stats after each transaction
      displayStats();

      if (count < TOTAL_TRANSACTIONS_PER_DAY) {
        console.log(chalk.yellow(`⏳ Waiting ${delayInMinutes.toFixed(2)} minutes before next transaction...`));
        
        // Simple timer
        const startTime = Date.now();
        const endTime = startTime + delayInMilliseconds;
        
        const timerSpinner = ora({
          text: 'Waiting for next transaction time...',
          color: 'yellow'
        }).start();
        
        while (Date.now() < endTime) {
          const remainingMs = endTime - Date.now();
          const remainingMinutes = Math.floor(remainingMs / 60000);
          const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
          timerSpinner.text = `⏳ Time remaining: ${remainingMinutes}m ${remainingSeconds}s`;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        timerSpinner.succeed('✅ Wait time complete, starting next transaction');
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error in transaction scheduling: ${error.message}`));
    }
  }

  console.log(boxen(
    chalk.green(`🎉 All ${TOTAL_TRANSACTIONS_PER_DAY} transactions completed!\n`) +
    `- Total TEA sent: ${totalAmountSent.toFixed(4)} TEA\n` +
    `- Successful: ${successfulTransactions}\n` +
    `- Failed: ${failedTransactions}`,
    {...boxOptions, borderColor: 'green'}
  ));
}

// Main execution
(async () => {
  console.log(chalk.blue(`🚀 Starting TEA Send...\n📡 Connected to: ${RPC_URL}`));
  
  // Validate configuration
  if (wallets.length === 0) {
    console.error(chalk.red("❌ No private keys provided in environment variables."));
    process.exit(1);
  }
  
  console.log(chalk.green(`✅ Successfully loaded ${wallets.length} wallets`));
  console.log(chalk.green(`🎯 Target: ${TOTAL_TRANSACTIONS_PER_DAY} transactions per day`));
  
  await loadRecipientAddresses();
  await checkGasFee();
  
  console.log(chalk.blue('\n🔄 Starting transaction scheduler...\n'));
  
  await scheduleTransactions();
})();