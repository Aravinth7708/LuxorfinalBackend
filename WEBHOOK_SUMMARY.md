# 🚀 Razorpay Webhook Setup - Complete Summary

## 📋 Webhooks to Add in Razorpay Dashboard

### **Webhook URL**
```
https://www.luxorholidayhomestays.com/api/razorpay/webhook
```

### **Events to Subscribe**

| # | Event Name | Description | Priority | Status |
|---|------------|-------------|----------|--------|
| 1 | `payment.captured` | ✅ Payment success - Updates booking to confirmed | **High** | Required |
| 2 | `payment.failed` | ❌ Payment failed - Updates booking to failed | **High** | Required |
| 3 | `order.paid` | 🧾 Order fully paid - Tracks complete order status | **High** | Required |
| 4 | `payment.authorized` | 🔐 Payment authorized (optional) | **Low** | Optional |

### **Secret Key (Webhook Secret)**
```
luxorSecret123
```

### **Content Type**
```
Content-Type: application/json
```
*Keep the default - no changes needed*

---

## 🔧 Backend Implementation Status

### ✅ **Completed**
- [x] Webhook route created (`/routes/webhookRoutes.js`)
- [x] Signature verification implemented
- [x] Event handlers for all webhook types
- [x] Database schema updated (Booking model)
- [x] Payment controller updated to store order IDs
- [x] Server routes registered
- [x] Health check endpoint
- [x] Comprehensive error handling
- [x] Test script created

### 📁 **Files Created/Modified**
1. `routes/webhookRoutes.js` - Main webhook handler
2. `models/Booking.js` - Updated with paymentDetails field
3. `controllers/paymentController.js` - Updated to store payment details
4. `server.js` - Registered webhook routes
5. `test-webhook.js` - Test script
6. `RAZORPAY_WEBHOOK_SETUP.md` - Detailed setup guide

---

## 🎯 **Step-by-Step Setup Instructions**

### **Step 1: Access Razorpay Dashboard**
1. Go to: **https://dashboard.razorpay.com**
2. Navigate to: **Settings** → **Webhooks**
3. Click **"+ Add New Webhook"**

### **Step 2: Configure Webhook**
1. **Webhook URL**: `https://www.luxorholidayhomestays.com/api/razorpay/webhook`
2. **Events**: Select all 4 events listed above
3. **Secret**: `luxorSecret123`
4. **Content Type**: `application/json` (default)

### **Step 3: Environment Variables**
Add to your `.env` file:
```env
RAZORPAY_WEBHOOK_SECRET=luxorSecret123
```

### **Step 4: Test the Webhook**
1. Use the test script: `node test-webhook.js`
2. Check health endpoint: `GET /api/razorpay/webhook/health`
3. Use Razorpay's webhook testing feature

---

## 🔍 **Webhook Event Details**

### **1. payment.captured**
**When triggered:** Payment is successfully captured
**Actions:**
- Updates booking status to `confirmed`
- Sets payment status to `paid`
- Stores payment details (method, bank, card info, etc.)
- Records payment capture timestamp

### **2. payment.failed**
**When triggered:** Payment fails
**Actions:**
- Updates booking status to `payment_failed`
- Sets payment status to `failed`
- Stores error details (error code, description)
- Records failure timestamp

### **3. order.paid**
**When triggered:** Complete order is paid
**Actions:**
- Updates order details in booking
- Records order payment timestamp
- Stores order amount and currency

### **4. payment.authorized** (Optional)
**When triggered:** Payment is authorized but not captured
**Actions:**
- Records authorization timestamp
- Stores payment authorization details

---

## 🛡️ **Security Features**

### **Signature Verification**
- All webhooks verified using HMAC SHA256
- Prevents unauthorized webhook calls
- Uses webhook secret for verification

### **Error Handling**
- Comprehensive error logging
- Graceful handling of missing bookings
- Proper HTTP status codes

---

## 📊 **Database Schema**

The Booking model now includes:
```javascript
paymentStatus: {
  type: String,
  enum: ["pending", "paid", "failed", "refunded"],
  default: "pending",
},
paymentDetails: {
  razorpayPaymentId: String,
  razorpayOrderId: String,
  paymentCapturedAt: Date,
  paymentFailedAt: Date,
  paymentAuthorizedAt: Date,
  orderPaidAt: Date,
  paymentMethod: String,
  bank: String,
  cardId: String,
  wallet: String,
  vpa: String,
  errorCode: String,
  errorDescription: String,
  orderAmount: Number,
  orderCurrency: String,
}
```

---

## 🧪 **Testing**

### **Health Check**
```bash
curl https://www.luxorholidayhomestays.com/api/razorpay/webhook/health
```

### **Test Script**
```bash
cd LuxorfinalBackend
node test-webhook.js
```

### **Razorpay Dashboard Testing**
1. Go to webhook settings
2. Use "Test Webhook" feature
3. Send test events
4. Check server logs

---

## 📝 **Monitoring & Logs**

### **Success Logs**
- `✅ Webhook signature verified`
- `✅ Payment captured: [payment details]`
- `✅ Booking updated successfully: [booking ID]`

### **Error Logs**
- `❌ Webhook signature missing`
- `❌ Invalid webhook signature`
- `❌ Booking not found for order ID: [order ID]`
- `❌ Webhook processing error: [error details]`

---

## 🚨 **Important Notes**

1. **HTTPS Required**: Webhook URL must use HTTPS
2. **Secret Security**: Keep the webhook secret secure and unique
3. **Retry Logic**: Razorpay will retry failed webhooks automatically
4. **Logging**: All webhook events are logged for debugging
5. **Database Updates**: Bookings are automatically updated based on webhook events

---

## 📞 **Support & Troubleshooting**

### **Common Issues**
1. **Webhook not receiving events**: Check URL accessibility and HTTPS
2. **Signature verification fails**: Verify secret key matches
3. **Booking not found**: Ensure order ID is stored correctly
4. **Database errors**: Check MongoDB connection and schema

### **Debug Steps**
1. Check webhook logs in server
2. Verify webhook URL is accessible
3. Ensure secret key matches
4. Test with Razorpay's webhook testing tool
5. Check database for booking records

---

## ✅ **Final Checklist**

- [ ] Add webhook in Razorpay dashboard
- [ ] Configure all 4 events
- [ ] Set webhook secret
- [ ] Add environment variable
- [ ] Test webhook endpoint
- [ ] Verify signature verification
- [ ] Check database updates
- [ ] Monitor webhook logs

---

## 🎉 **Ready to Go!**

Your Razorpay webhook integration is now complete and ready for production use. The system will automatically handle payment events and update booking statuses accordingly. 