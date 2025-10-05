/**
 * Cleanup script to remove positions from old/test wallets
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOldPositions() {
  console.log('🧹 Cleaning up old positions...\n');

  try {
    // Get all positions grouped by wallet
    const positions = await prisma.position.findMany({
      select: {
        id: true,
        user: {
          select: {
            walletAddress: true,
          },
        },
        status: true,
        longMarketSymbol: true,
        shortMarketSymbol: true,
        entryTimestamp: true,
      },
      orderBy: {
        entryTimestamp: 'desc',
      },
    });

    console.log(`📊 Found ${positions.length} total positions:\n`);

    // Group by wallet
    const byWallet = {};
    positions.forEach(pos => {
      const wallet = pos.user.walletAddress;
      if (!byWallet[wallet]) {
        byWallet[wallet] = [];
      }
      byWallet[wallet].push(pos);
    });

    // Display
    Object.entries(byWallet).forEach(([wallet, positions]) => {
      const shortWallet = `${wallet.slice(0, 8)}...${wallet.slice(-8)}`;
      console.log(`👛 Wallet: ${shortWallet}`);
      console.log(`   Positions: ${positions.length}`);
      console.log(`   Status: ${positions.filter(p => p.status === 'OPEN').length} OPEN, ${positions.filter(p => p.status === 'CLOSED').length} CLOSED`);
      
      positions.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.longMarketSymbol}/${p.shortMarketSymbol} - ${p.status} (${new Date(p.entryTimestamp).toLocaleDateString()})`);
      });
      if (positions.length > 3) {
        console.log(`   ... and ${positions.length - 3} more`);
      }
      console.log('');
    });

    // Ask which wallet to keep
    console.log('\n🎯 Current connected wallet should be one of the above.');
    console.log('All positions from OTHER wallets can be safely deleted.\n');

    // For now, just show what would be deleted
    console.log('To delete positions from a specific wallet, run:');
    console.log('  node cleanup-old-positions.js DELETE <wallet_address>\n');

    // Check for broken positions (entry ratio = 0)
    const brokenPositions = positions.filter(p => {
      return p.status === 'OPEN' && (!p.entryRatio || p.entryRatio === 0);
    });

    if (brokenPositions.length > 0) {
      console.log(`\n⚠️  Found ${brokenPositions.length} BROKEN position(s) (entry ratio = 0):\n`);
      brokenPositions.forEach(p => {
        console.log(`   ❌ ${p.id}: ${p.longMarketSymbol}/${p.shortMarketSymbol}`);
      });
      console.log('\nTo delete broken positions, run:');
      console.log('  node cleanup-old-positions.js DELETE_BROKEN\n');
    }

    // Check if DELETE command given
    const command = process.argv[2];
    const targetWallet = process.argv[3];

    if (command === 'DELETE_BROKEN') {
      console.log(`\n🗑️  Deleting broken positions with entry ratio = 0\n`);

      // Delete broken positions
      const deleted = await prisma.position.deleteMany({
        where: {
          status: 'OPEN',
          entryRatio: 0,
        },
      });

      console.log(`✅ Deleted ${deleted.count} broken positions!`);
      console.log('');

      // Show remaining
      const remaining = await prisma.position.count();
      console.log(`📊 Remaining positions in database: ${remaining}`);
    } else if (command === 'DELETE' && targetWallet) {
      console.log(`\n🗑️  Deleting all positions for wallet: ${targetWallet}\n`);

      // Delete positions
      const deleted = await prisma.position.deleteMany({
        where: {
          user: {
            walletAddress: targetWallet,
          },
        },
      });

      console.log(`✅ Deleted ${deleted.count} positions!`);
      console.log('');

      // Show remaining
      const remaining = await prisma.position.count();
      console.log(`📊 Remaining positions in database: ${remaining}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOldPositions();

