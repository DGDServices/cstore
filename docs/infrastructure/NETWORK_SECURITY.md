# Network Security Guide

Guide for securing network infrastructure and implementing security policies.

## Overview

Network security features:
- Network segmentation
- Firewall rules
- DDoS protection
- Web Application Firewall (WAF)
- VPN access

## Network Architecture

```
Internet
    │
    ├── WAF/DDoS Protection
    │
    ├── Load Balancer (Public Subnet)
    │
    ├── Application Servers (Private Subnet)
    │
    ├── Database Servers (Database Subnet)
    │
    └── Management/Bastion (Management Subnet)
```

## Firewall Configuration

### Application Firewall Rules

```bash
# Allow HTTPS from anywhere
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow HTTP from anywhere (redirect to HTTPS)
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Allow SSH from bastion only
iptables -A INPUT -p tcp --dport 22 -s 10.0.4.0/24 -j ACCEPT

# Block all other incoming
iptables -A INPUT -j DROP
```

### Database Firewall Rules

```bash
# Allow MongoDB from application subnet only
iptables -A INPUT -p tcp --dport 27017 -s 10.0.2.0/24 -j ACCEPT

# Allow Redis from application subnet only
iptables -A INPUT -p tcp --dport 6379 -s 10.0.2.0/24 -j ACCEPT

# Block all other incoming
iptables -A INPUT -j DROP
```

## Security Groups (AWS)

### Load Balancer Security Group

```yaml
Ingress:
  - Port: 80, 443
    Source: 0.0.0.0/0
    Description: HTTP/HTTPS from internet

Egress:
  - Port: 3000
    Destination: sg-application
    Description: To application servers
```

### Application Security Group

```yaml
Ingress:
  - Port: 3000
    Source: sg-load-balancer
    Description: From load balancer
  - Port: 22
    Source: sg-bastion
    Description: SSH from bastion

Egress:
  - Port: 27017
    Destination: sg-database
  - Port: 6379
    Destination: sg-redis
  - Port: 443
    Destination: 0.0.0.0/0
```

### Database Security Group

```yaml
Ingress:
  - Port: 27017
    Source: sg-application
    Description: MongoDB from application

Egress:
  - Port: 27017
    Destination: sg-database
    Description: Replica set communication
```

## DDoS Protection

### Rate Limiting

```javascript
// Application-level rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### Connection Limits

```nginx
# nginx.conf
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_req_zone $binary_remote_addr zone=req:10m rate=10r/s;

server {
    limit_conn addr 10;
    limit_req zone=req burst=20;
}
```

## Web Application Firewall (WAF)

### OWASP Protection

```javascript
// Enable helmet security headers
const helmet = require('helmet');
app.use(helmet());

// XSS protection
const xss = require('xss-clean');
app.use(xss());

// SQL injection protection
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```

### Custom WAF Rules

```yaml
# AWS WAF Rules
Rules:
  - Name: BlockSQLInjection
    Priority: 1
    Statement:
      SqliMatchStatement:
        FieldToMatch:
          QueryString: {}
    Action: Block

  - Name: RateLimitAPI
    Priority: 2
    Statement:
      RateBasedStatement:
        Limit: 2000
        AggregateKeyType: IP
    Action: Block
```

## VPN Configuration

### WireGuard Setup

```ini
# wg0.conf
[Interface]
Address = 10.0.100.1/24
PrivateKey = SERVER_PRIVATE_KEY
ListenPort = 51820

[Peer]
PublicKey = CLIENT_PUBLIC_KEY
AllowedIPs = 10.0.100.2/32
```

### Access Control

```bash
# Only allow VPN users to access management interfaces
iptables -A INPUT -p tcp --dport 9090 -s 10.0.100.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 9090 -j DROP
```

## SSL/TLS Configuration

### Nginx SSL

```nginx
server {
    listen 443 ssl http2;
    
    ssl_certificate /etc/letsencrypt/live/cryptons.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cryptons.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

## Monitoring

### Network Monitoring

```bash
# Monitor connections
netstat -tan | awk '/ESTABLISHED/ {print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn

# Monitor traffic
iftop -i eth0

# Check firewall rules
iptables -L -n -v
```

### Intrusion Detection

```bash
# Install and configure fail2ban
apt-get install fail2ban

# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 3
bantime = 3600
```

## Security Best Practices

1. **Network Segmentation** - Isolate services
2. **Least Privilege** - Minimal access rules
3. **Defense in Depth** - Multiple security layers
4. **Regular Updates** - Keep systems patched
5. **Monitoring** - Monitor all network traffic
6. **Encryption** - Encrypt all traffic

## Troubleshooting

### Connection Issues

```bash
# Test connectivity
telnet app.cryptons.com 443

# Check firewall rules
iptables -L -n -v

# Check security groups (AWS)
aws ec2 describe-security-groups --group-ids sg-xxx
```

### Rate Limiting Issues

```bash
# Check rate limit status
curl -I http://localhost:3000/api/health

# Review logs
tail -f /var/log/nginx/access.log | grep "limit_req"
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)
- [nginx Security](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
