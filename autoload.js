const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

let isAutoLoadRunning = false;
let isShuttingDown = false; 

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('message', (msg) => {
  if (msg === 'shutdown') {
    console.log(chalk.yellow('🛑 Received PM2 shutdown signal'));
    isShuttingDown = true;
  }
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('🛑 Received SIGINT signal'));
  isShuttingDown = true;
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('🛑 Received SIGTERM signal'));
  isShuttingDown = true;
});

// Helper function to process a single user
async function processUser(user, index, total) {
  if (isShuttingDown) {
    throw new Error('Shutdown in progress');
  }
  
  console.log(chalk.blue(`⌛ Connecting ${index + 1}/${total}: ${user}`));
  
  try {
    const startpairing = require('./pair');
    await startpairing(user);
    
    // Clean up require cache for this specific user
    delete require.cache[require.resolve('./pair')];
    
    console.log(chalk.green(`✅ Connected: ${user}`));
    return user;
  } catch (error) {
    console.log(chalk.red(`❌ Failed for ${user}: ${error.message}`));
    // Clean up cache even on error
    delete require.cache[require.resolve('./pair')];
    throw error;
  }
}

// Helper function to process users in batches
async function processBatch(users, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < users.length; i += batchSize) {
    if (isShuttingDown) {
      console.log(chalk.yellow('⏹️ Stopping batch processing due to shutdown'));
      break;
    }
    
    const batch = users.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(users.length / batchSize);
    
    console.log(chalk.cyan(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`));
    
    const batchPromises = batch.map((user, index) => 
      processUser(user, i + index, users.length)
        .catch(error => {
          return { user, error: error.message, success: false };
        })
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < users.length && !isShuttingDown) {
      console.log(chalk.gray(`⏳ Waiting 2 seconds before next batch...`));
      await delay(2000);
    }
  }
  
  return results;
}

// Helper function to count successful results
function countSuccessful(results) {
  return results.filter(result => {
    if (result.status === 'fulfilled') {
      // Check if it's a string (successful user) or an error object
      return typeof result.value === 'string';
    }
    return false;
  }).length;
}

module.exports = {
  autoLoadPairs: async (options = {}) => {
    if (isShuttingDown) {
      console.log(chalk.yellow('⚠️ Skipping auto-load (shutdown in progress)'));
      return { success: false, message: 'Shutdown in progress' };
    }
    
    if (isAutoLoadRunning) {
      console.log(chalk.yellow('⚠️ Auto-load already in progress. Skipping...'));
      return { success: false, message: 'Auto-load already running' };
    }
    
    isAutoLoadRunning = true;
    console.log(chalk.yellow('🔄 Auto-loading all paired users...'));

    try {
      const pairingDir = path.join(__dirname, 'nexstore', 'pairing');
      
      // Check if pairing directory exists
      try {
        await fs.access(pairingDir);
      } catch {
        console.log(chalk.red('❌ Pairing directory not found.'));
        return { success: false, message: 'Pairing directory not found', total: 0, successful: 0 };
      }

      // Read all directories in pairing folder
      const files = await fs.readdir(pairingDir, { withFileTypes: true });
      const pairUsers = files
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name.endsWith('@s.whatsapp.net'));

      if (pairUsers.length === 0) {
        console.log(chalk.yellow('ℹ️ No paired users found.'));
        return { success: true, message: 'No users to load', total: 0, successful: 0 };
      }

      console.log(chalk.green(`✅ Found ${pairUsers.length} paired users. Starting connections...`));

      const startTime = Date.now();
      let results;
      let successful = 0;
      
      // Option 1: Process all at once (fastest but resource intensive)
      if (options.concurrent === true) {
        console.log(chalk.cyan('🚀 Processing all users concurrently...'));
        
        const promises = pairUsers.map((user, index) => 
          processUser(user, index, pairUsers.length)
            .catch(error => {
              return { user, error: error.message, success: false };
            })
        );
        
        results = await Promise.allSettled(promises);
        successful = countSuccessful(results);
        
        console.log(chalk.green(`✅ Processed ${successful}/${pairUsers.length} users successfully`));
        
      } else {
        // Option 2: Process in batches (balanced approach - RECOMMENDED)
        const batchSize = options.batchSize || 5;
        console.log(chalk.cyan(`🔄 Processing users in batches of ${batchSize}...`));
        
        results = await processBatch(pairUsers, batchSize);
        successful = countSuccessful(results);
        
        console.log(chalk.green(`✅ Processed ${successful}/${pairUsers.length} users successfully`));
      }
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const failed = pairUsers.length - successful;
      
      console.log(chalk.green(`🎉 Auto-load completed in ${duration} seconds`));
      console.log(chalk.cyan(`📊 Success: ${successful} | Failed: ${failed} | Total: ${pairUsers.length}`));
      
      return {
        success: true,
        total: pairUsers.length,
        successful: successful,
        failed: failed,
        duration: duration
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Auto-load error:'), error);
      return {
        success: false,
        message: error.message,
        total: 0,
        successful: 0
      };
    } finally {
      isAutoLoadRunning = false;
    }
  },
  
  // Export status checkers for external use
  isRunning: () => isAutoLoadRunning,
  isShuttingDown: () => isShuttingDown
};
