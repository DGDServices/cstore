# Print-on-Demand Setup Guide

## Overview

This guide will help you set up and configure the Printify print-on-demand integration for your Cryptons marketplace.

## Prerequisites

1. A Printify account (https://printify.com)
2. API access enabled in your Printify account
3. At least one shop created in Printify
4. Products designed and ready in your Printify shop

## Step 1: Get Your Printify API Credentials

1. Log in to your Printify account
2. Navigate to **My Profile** → **API**
3. Generate a new API token
4. Copy your Shop ID from the shop settings

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Enable Printify Integration
PRINTIFY_ENABLED=true

# Printify API Token (from My Profile → API)
PRINTIFY_API_TOKEN=your_printify_api_token_here

# Printify Shop ID (from shop settings)
PRINTIFY_SHOP_ID=your_shop_id_here

# Webhook Secret (generate with: openssl rand -hex 32)
PRINTIFY_WEBHOOK_SECRET=your_generated_webhook_secret_here
```

## Step 3: Generate Webhook Secret

Generate a secure webhook secret:

```bash
openssl rand -hex 32
```

Add the generated value to your `.env` file as `PRINTIFY_WEBHOOK_SECRET`.

## Step 4: Start the Application

```bash
npm start
```

The POD integration will initialize automatically if `PRINTIFY_ENABLED=true`.

## Step 5: Sync Products from Printify

### Via Admin Dashboard:

1. Log in to the admin dashboard at `/admin`
2. Navigate to **POD Products** in the sidebar
3. Click **"Sync All Products"**
4. Wait for the sync to complete
5. Review synced products

### Via API:

```bash
curl -X POST http://localhost:3000/api/printify/products/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Step 6: Configure Webhooks in Printify

1. In your Printify dashboard, go to **Settings** → **Webhooks**
2. Add a new webhook with:
   - **URL**: `https://your-domain.com/api/printify/webhooks`
   - **Secret**: Your `PRINTIFY_WEBHOOK_SECRET` value
3. Select the following events:
   - Order Created
   - Order Updated
   - Order Sent to Production
   - Shipment Created
   - Shipment Delivered
   - Product Publish Started
   - Product Publish Succeeded
   - Product Publish Failed

## Step 7: Test the Integration

### Test Product Sync:

1. Create a test product in Printify
2. Sync products via admin dashboard
3. Verify the product appears in the POD Products list

### Test Order Flow:

1. Create a test order via API:
   ```bash
   curl -X POST http://localhost:3000/api/printify/orders \
     -H "Authorization: Bearer YOUR_USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "orderId": "test_order_id",
       "items": [{
         "podProductId": "...",
         "printifyProductId": "...",
         "variantId": "...",
         "quantity": 1,
         "price": 19.99,
         "cost": 9.99
       }],
       "shippingAddress": {
         "firstName": "Test",
         "lastName": "User",
         "email": "test@example.com",
         "country": "US",
         "address1": "123 Test St",
         "city": "Test City",
         "zip": "12345"
       }
     }'
   ```

2. Submit the order to Printify via admin dashboard
3. Monitor order status updates via webhooks

## Managing POD Products

### Admin Dashboard Features:

- **View Products**: See all synced POD products
- **Filter**: By sync status and published status
- **Search**: Find products by title
- **Sync**: Sync all or individual products
- **Publish**: Publish products to Printify
- **Edit**: Change active status
- **Delete**: Soft delete products

### Product Sync Status:

- **synced**: Product is up-to-date with Printify
- **pending**: Sync is pending
- **failed**: Sync failed (check logs)
- **out_of_sync**: Product data changed in Printify

## Managing POD Orders

### Order Statuses:

- **draft**: Created but not submitted to Printify
- **pending**: Submitted, awaiting processing
- **in_production**: Being manufactured
- **shipped**: Order shipped to customer
- **delivered**: Order delivered
- **cancelled**: Order cancelled
- **failed**: Processing failed

### Admin Actions:

1. **View Orders**: Navigate to POD Orders in admin dashboard
2. **View Details**: Click eye icon to see order details
3. **Submit Order**: Click send icon to submit draft orders
4. **Cancel Order**: Click cancel icon for pending orders
5. **Track Shipment**: View tracking info in order details

## Troubleshooting

### Products Not Syncing:

1. Check API token is valid
2. Verify shop ID is correct
3. Check logs: `tail -f logs/app.log`
4. Ensure products exist in Printify shop

### Webhooks Not Working:

1. Verify webhook URL is accessible from internet
2. Check webhook secret matches
3. Ensure HTTPS is configured (Printify requires HTTPS)
4. Check webhook logs in Printify dashboard

### Order Submission Fails:

1. Verify all required shipping fields are provided
2. Check product variants are available
3. Ensure shipping address is valid
4. Review error messages in admin dashboard

## Security Best Practices

1. **Never commit** `.env` file to version control
2. **Use strong secrets** for webhook verification
3. **Enable HTTPS** for production deployments
4. **Rotate API tokens** regularly
5. **Monitor webhook logs** for suspicious activity
6. **Use environment-specific** credentials

## Production Deployment

### Required Environment Variables:

```bash
NODE_ENV=production
PRINTIFY_ENABLED=true
PRINTIFY_API_TOKEN=your_production_token
PRINTIFY_SHOP_ID=your_shop_id
PRINTIFY_WEBHOOK_SECRET=your_production_secret
```

### SSL/HTTPS Setup:

Printify webhooks require HTTPS. Configure SSL using:
- Let's Encrypt (recommended)
- Cloud provider SSL certificates
- Reverse proxy (nginx/Apache) with SSL

### Webhook Configuration:

Update webhook URL in Printify to production domain:
```
https://your-production-domain.com/api/printify/webhooks
```

## Monitoring

### Check POD Statistics:

```bash
curl http://localhost:3000/api/admin/pod/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Monitor Logs:

```bash
# Application logs
tail -f logs/app.log | grep -i printify

# Error logs
tail -f logs/error.log | grep -i printify
```

### Key Metrics:

- Total POD products synced
- Active POD orders
- Orders in production
- Revenue and profit margins
- Failed syncs and orders

## Support

### Resources:

- **API Documentation**: `/docs/PRINTIFY_API.md`
- **Printify API Docs**: https://developers.printify.com
- **Printify Support**: https://help.printify.com

### Getting Help:

1. Check application logs
2. Review Printify API documentation
3. Test API endpoints manually
4. Contact support with error details

## FAQ

**Q: Can I use multiple Printify shops?**  
A: Currently, one shop per instance. Contact support for multi-shop needs.

**Q: How often should I sync products?**  
A: Daily or when you update products in Printify.

**Q: What happens if webhook delivery fails?**  
A: Printify retries webhooks. You can also manually refresh order status.

**Q: Can customers track their POD orders?**  
A: Yes, tracking info is stored and can be displayed to customers.

**Q: How are POD products different from regular products?**  
A: POD products are fulfilled by Printify. Stock is always available (999).

**Q: What if I want to remove the POD feature?**  
A: Set `PRINTIFY_ENABLED=false` in `.env` and restart the application.

## Next Steps

- Configure email templates for POD notifications
- Customize POD product display for customers
- Set up automated product sync schedule
- Configure shipping rules and pricing
- Add POD analytics to dashboard

## Success Checklist

- [ ] Printify API token configured
- [ ] Products synced successfully
- [ ] Webhooks configured in Printify
- [ ] Test order created and submitted
- [ ] Webhook events received and processed
- [ ] Email notifications working
- [ ] Admin dashboard accessible
- [ ] SSL/HTTPS configured (production)
- [ ] Monitoring and logging set up
- [ ] Backup procedures in place

Congratulations! Your POD integration is ready to go! 🎉
