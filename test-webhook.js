// Test script for Razorpay webhook endpoint
import fetch from 'node-fetch';
import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:5000/api/razorpay/webhook';
const WEBHOOK_SECRET = 'luxorSecret123';

// Sample webhook payload for payment.captured event
const samplePayload = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_test123456789',
        order_id: 'order_test123456789',
        amount: 1000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        bank: 'HDFC',
        card_id: null,
        wallet: null,
        vpa: 'test@upi',
        created_at: Math.floor(Date.now() / 1000)
      }
    }
  }
};

// Generate signature
const payloadString = JSON.stringify(samplePayload);
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payloadString)
  .digest('hex');

async function testWebhook() {
  try {
    console.log('🧪 Testing Razorpay webhook endpoint...');
    console.log('📡 URL:', WEBHOOK_URL);
    console.log('🔑 Secret:', WEBHOOK_SECRET);
    console.log('📦 Payload:', JSON.stringify(samplePayload, null, 2));
    console.log('🔐 Signature:', signature);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
      },
      body: payloadString
    });
    
    const responseText = await response.text();
    console.log('📊 Response Status:', response.status);
    console.log('📄 Response Body:', responseText);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed!');
    }
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

// Test health endpoint
async function testHealthEndpoint() {
  try {
    console.log('\n🏥 Testing health endpoint...');
    const healthUrl = 'http://localhost:5000/api/razorpay/webhook/health';
    
    const response = await fetch(healthUrl);
    const data = await response.json();
    
    console.log('📊 Health Status:', response.status);
    console.log('📄 Health Response:', data);
    
    if (response.ok) {
      console.log('✅ Health endpoint working!');
    } else {
      console.log('❌ Health endpoint failed!');
    }
    
  } catch (error) {
    console.error('❌ Error testing health endpoint:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting webhook tests...\n');
  
  await testHealthEndpoint();
  await testWebhook();
  
  console.log('\n✨ Tests completed!');
}

runTests(); 