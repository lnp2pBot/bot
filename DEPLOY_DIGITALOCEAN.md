# DigitalOcean App Platform Deployment Guide

This guide helps you deploy LNp2pBot to DigitalOcean's App Platform.

## Prerequisites

1. **DigitalOcean Account** with App Platform access
2. **Lightning Node (LND)** accessible from the internet
3. **MongoDB Database** (can use DigitalOcean's managed MongoDB)
4. **Telegram Bot Token** from [@BotFather](https://t.me/botfather)
5. **Telegram Channels** for orders and admin notifications

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository contains:
- `.do/app.yaml` (App Platform configuration)
- `Dockerfile` (container configuration)
- All source code committed and pushed to GitHub

### 2. Create App on DigitalOcean

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Choose **GitHub** as source
4. Select your repository and branch (usually `main`)
5. DigitalOcean will automatically detect the `.do/app.yaml` configuration

### 3. Configure Environment Variables

You need to set these **SECRET** environment variables in the App Platform dashboard:

#### Required Secrets
```bash
BOT_TOKEN=your_telegram_bot_token_here
LND_CERT_BASE64=your_lnd_tls_cert_base64_encoded
LND_MACAROON_BASE64=your_lnd_admin_macaroon_base64_encoded
MONGO_URI=mongodb://username:password@host:port/database_name
```

#### Get LND Credentials
On your LND node, run:
```bash
# Get TLS certificate (base64 encoded)
base64 -w0 ~/.lnd/tls.cert

# Get admin macaroon (base64 encoded)  
base64 -w0 ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon
```

#### MongoDB Options
- **DigitalOcean Managed MongoDB**: Recommended for production
- **External MongoDB**: Atlas, your own server, etc.
- **Connection String Format**: `mongodb://username:password@host:port/database_name`

**Important MongoDB Connection Notes:**
- If using DigitalOcean Managed MongoDB, use the **Private Network** connection string
- Ensure your database allows connections from your App Platform instance
- For MongoDB Atlas, add `0.0.0.0/0` to IP whitelist (or use VPC peering)
- Test connection string format: `mongodb+srv://username:password@cluster.mongodb.net/database_name`

### 4. Update Configuration Values

In the App Platform dashboard, update these environment variables:

```yaml
LND_GRPC_HOST: "your-lnd-node-host:10009"
CHANNEL: "@your_orders_channel"
ADMIN_CHANNEL: "@your_admin_channel"  
LNURL_PUBLIC_URL: "https://your-app-name.ondigitalocean.app"
```

### 5. Optional Configurations

#### Proxy/Tor Support
```yaml
SOCKS_PROXY_HOST: "your-proxy-host:port"
```

#### Nostr Integration
```yaml
NOSTR_PRIVATE_KEY: "your_nostr_private_key"
NOSTR_RELAYS: "wss://relay1.com,wss://relay2.com"
```

## Lightning Node Requirements

Your LND node must:
- Be accessible from the internet on port 10009 (gRPC)
- Have sufficient channel capacity for hold invoices
- Be properly funded and connected to the Lightning Network

### Firewall Configuration
Ensure your LND node allows connections from DigitalOcean:
```bash
# Example iptables rule
iptables -A INPUT -p tcp --dport 10009 -j ACCEPT
```

## Telegram Setup

1. **Create Bot**: Message [@BotFather](https://t.me/botfather), use `/newbot`
2. **Create Channels**:
   - Public channel for order announcements
   - Private channel for admin notifications
3. **Add Bot**: Add your bot as admin to both channels
4. **Get Channel Names**: Use format `@channelname` or `-100XXXXXX` for private groups

## Database Setup

### Using DigitalOcean Managed MongoDB
1. Create a MongoDB cluster in your DigitalOcean dashboard
2. Add your app to the database's trusted sources
3. Use the provided connection string

### Using External MongoDB
Ensure your MongoDB:
- Accepts connections from DigitalOcean IPs
- Has proper authentication configured
- Uses SSL/TLS for security

## Monitoring and Logs

### View Application Logs
1. Go to your app in DigitalOcean dashboard
2. Click **"Runtime Logs"** tab
3. Monitor for startup messages and errors

### Health Checks
The bot includes several health monitoring jobs:
- Node connectivity checks every minute
- Pending payment retries every 5 minutes
- Order cleanup hourly

## Security Best Practices

1. **Use Secrets**: Never put sensitive data in regular environment variables
2. **TLS Certificates**: Keep your LND certificates secure and rotate regularly
3. **Database Access**: Use strong passwords and IP restrictions
4. **Monitoring**: Set up alerts for failed deployments and errors

## Troubleshooting

### Common Issues

#### Bot Won't Start
- Check BOT_TOKEN is valid
- Verify MongoDB connection string
- Ensure LND node is accessible

#### LND Connection Failed
- Verify LND_GRPC_HOST format (host:port)
- Check base64 encoding of certificates
- Confirm LND node is running and accessible

#### Database Connection Issues  
- **Test MongoDB connection string locally first**
- **Check MongoDB URI format**: Ensure it matches your provider's requirements
- **Network Access**: 
  - DigitalOcean Managed DB: Use private network connection
  - MongoDB Atlas: Add `0.0.0.0/0` to IP whitelist or set up VPC peering
  - Self-hosted: Ensure firewall allows DigitalOcean App Platform IPs
- **Verify credentials**: Username, password, and database name
- **Check database exists**: Ensure the database name in the URI exists
- **URI encoding**: Special characters in passwords must be URL-encoded

### Debug Commands
View application logs:
```bash
# In DigitalOcean dashboard
Apps → Your App → Runtime Logs
```

## Scaling Considerations

### Performance
- **Instance Size**: Start with `basic-xxs`, scale up based on usage
- **Instance Count**: Keep at 1 for most use cases (stateful Lightning operations)

### Database
- Monitor connection count and query performance
- Consider indexing for frequently queried fields
- Scale MongoDB cluster as needed

## Cost Estimation

Approximate monthly costs:
- **App (basic-xxs)**: $5/month
- **MongoDB (basic-xs)**: $25/month  
- **Total**: ~$30/month

## Updates and Maintenance

### Automated Deployments
- Commits to main branch trigger automatic deployments
- Review deployment logs after each update

### Manual Deployments
1. Push changes to GitHub
2. Go to App Platform dashboard
3. Click **"Actions"** → **"Force Rebuild and Deploy"**

## Support

- **LNp2pBot Issues**: [GitHub Issues](https://github.com/lnp2pbot/bot/issues)
- **DigitalOcean Support**: [Support Portal](https://cloud.digitalocean.com/support)
- **Lightning Network**: [LND Documentation](https://docs.lightning.engineering/)