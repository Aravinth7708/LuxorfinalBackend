# Razorpay Webhook Setup Guide

## 🚀 Quick Setup

### 1. Access Razorpay Dashboard
Go to: **https://dashboard.razorpay.com** → **Settings** → **Webhooks**

### 2. Add New Webhook
Click **"+ Add New Webhook"**

---

## 📋 Webhook Configuration

### **Webhook URL**
```
https://www.luxorholidayhomestays.com/api/razorpay/webhook
```

### **Events to Subscribe**
Select these events:

| Event | Description | Status |
|-------|-------------|--------|
| `payment.captured` | ✅ Payment success - Updates booking to confirmed | **Required** |
| `payment.failed` | ❌ Payment failed - Updates booking to failed | **Required** |
| `order.paid` | 🧾 Order fully paid - Tracks complete order status | **Required** |
| `payment.authorized` | 🔐 Payment authorized (optional) | Optional |

### **Secret Key (Webhook Secret)**
```
luxorSecret123
```
*Note: This should be stored in your environment variables as `RAZORPAY_WEBHOOK_SECRET`*

### **Content Type**
```
Content-Type: application/json
```
*Keep the default - no changes needed*

---

## 🔧 Backend Implementation

### Environment Variables
Add to your `.env` file:
```env
RAZORPAY_WEBHOOK_SECRET=luxorSecret123
```

### Webhook Endpoints Available

1. **Main Webhook Endpoint**
   ```
   POST /api/razorpay/webhook
   ```

2. **Health Check Endpoint**
   ```
   GET /api/razorpay/webhook/health
   ```

---

## 📊 Webhook Event Handling

### 1. `payment.captured` Event
**Triggered when:** Payment is successfully captured
**Actions:**
- Updates booking status to `confirmed`
- Sets payment status to `paid`
- Stores payment details (method, bank, card info, etc.)
- Records payment capture timestamp

### 2. `payment.failed` Event
**Triggered when:** Payment fails
**Actions:**
- Updates booking status to `payment_failed`
- Sets payment status to `failed`
- Stores error details (error code, description)
- Records failure timestamp

### 3. `order.paid` Event
**Triggered when:** Complete order is paid
**Actions:**
- Updates order details in booking
- Records order payment timestamp
- Stores order amount and currency

### 4. `payment.authorized` Event (Optional)
**Triggered when:** Payment is authorized but not captured
**Actions:**
- Records authorization timestamp
- Stores payment authorization details

---

## 🔒 Security Features

### Signature Verification
- All webhooks are verified using HMAC SHA256
- Prevents unauthorized webhook calls
- Uses the webhook secret for verification

### Error Handling
- Comprehensive error logging
- Graceful handling of missing bookings
- Proper HTTP status codes

---

## 📝 Database Schema Updates

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

## 🧪 Testing Webhooks

### 1. Health Check
```bash
curl https://www.luxorholidayhomestays.com/api/razorpay/webhook/health
```

### 2. Test Webhook (from Razorpay Dashboard)
- Use Razorpay's webhook testing feature
- Send test events to verify handling
- Check logs for proper processing

---

## 📋 Complete Webhook List

### Required Webhooks to Add in Razorpay Dashboard:

| # | Event Name | Description | Priority |
|---|------------|-------------|----------|
| 1 | `payment.captured` | Payment success handling | **High** |
| 2 | `payment.failed` | Payment failure handling | **High** |
| 3 | `order.paid` | Order completion tracking | **High** |
| 4 | `payment.authorized` | Payment authorization (optional) | **Low** |

### Webhook Configuration Summary:
```
URL: https://www.luxorholidayhomestays.com/api/razorpay/webhook
Secret: luxorSecret123
Content-Type: application/json
Events: payment.captured, payment.failed, order.paid, payment.authorized
```

---

## 🚨 Important Notes

1. **HTTPS Required**: Webhook URL must use HTTPS
2. **Secret Security**: Keep the webhook secret secure and unique
3. **Retry Logic**: Razorpay will retry failed webhooks automatically
4. **Logging**: All webhook events are logged for debugging
5. **Database Updates**: Bookings are automatically updated based on webhook events

---

## 🔍 Monitoring

### Log Messages to Watch For:
- `✅ Webhook signature verified`
- `✅ Payment captured: [payment details]`
- `❌ Payment failed: [error details]`
- `✅ Booking updated successfully: [booking ID]`

### Error Messages to Monitor:
- `❌ Webhook signature missing`
- `❌ Invalid webhook signature`
- `❌ Booking not found for order ID: [order ID]`
- `❌ Webhook processing error: [error details]`

---

## 📞 Support

If you encounter issues:
1. Check the webhook logs in your server
2. Verify the webhook URL is accessible
3. Ensure the secret key matches
4. Test with Razorpay's webhook testing tool 