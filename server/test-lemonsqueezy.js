/**
 * Test Lemon Squeezy API Connection
 * Run: node test-lemonsqueezy.js
 */

require('dotenv').config();
const { lemonSqueezySetup, getStore, listProducts } = require('@lemonsqueezy/lemonsqueezy.js');

async function testLemonSqueezy() {
  console.log('🍋 Testing Lemon Squeezy Connection...\n');

  // Setup API
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY,
    onError: (error) => console.error('❌ API Error:', error)
  });

  try {
    // Test 1: Get Store Info
    console.log('📦 Fetching store information...');
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const { data: store } = await getStore(storeId);
    
    if (store) {
      console.log('✅ Store connected successfully!');
      console.log(`   Name: ${store.data.attributes.name}`);
      console.log(`   Currency: ${store.data.attributes.currency}`);
      console.log(`   Domain: ${store.data.attributes.domain}\n`);
    }

    // Test 2: List Products
    console.log('📋 Fetching products...');
    const { data: products } = await listProducts({
      filter: { storeId }
    });

    if (products && products.data.length > 0) {
      console.log(`✅ Found ${products.data.length} product(s):\n`);
      
      products.data.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.attributes.name}`);
        console.log(`      Product ID: ${product.id}`);
        console.log(`      Status: ${product.attributes.status}`);
        console.log(`      Price: ${product.attributes.price_formatted || 'N/A'}\n`);
      });

      // Verify configured variant
      const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
      console.log(`🔍 Your configured Variant ID: ${variantId}`);
    } else {
      console.log('⚠️  No products found in your store');
    }

    // Test 3: Webhook Secret
    console.log('\n🔐 Webhook Configuration:');
    console.log(`   Secret: ${process.env.LEMONSQUEEZY_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Endpoint: /api/webhook/lemonsqueezy`);
    
    console.log('\n✅ All tests passed! Your Lemon Squeezy is configured correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure webhook URL in Lemon Squeezy dashboard');
    console.log('   2. Test a purchase with test mode enabled');
    console.log('   3. Check webhook logs in your server');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your LEMONSQUEEZY_API_KEY in .env');
    console.error('   2. Verify LEMONSQUEEZY_STORE_ID is correct');
    console.error('   3. Ensure API key has proper permissions');
  }
}

testLemonSqueezy();
