/**
 * Test script to debug getProductsByOwner
 * Run with: node test-owner-query.js
 */

const query = require('./query');

async function testGetProductsByOwner() {
    console.log('=== Testing getProductsByOwner ===\n');

    const testOwners = ['admin', 'farmer01', 'distributor01', 'manufacturer01', 'retailer01'];

    for (const ownerId of testOwners) {
        console.log(`\n--- Testing owner: ${ownerId} ---`);
        try {
            const result = await query.getQuery('getProductsByOwner', { ownerId }, ownerId);
            const products = JSON.parse(result);
            console.log(`✅ Found ${products.length} products for ${ownerId}`);
            if (products.length > 0) {
                products.forEach(p => {
                    console.log(`   - ${p.productId}: ${p.productName} (${p.status})`);
                });
            }
        } catch (error) {
            console.error(`❌ Error for ${ownerId}:`, error.message);
        }
    }
}

testGetProductsByOwner()
    .then(() => {
        console.log('\n=== Test completed ===');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
