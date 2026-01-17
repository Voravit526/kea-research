#!/bin/bash
set -e

DOMAIN="${DOMAIN:-localhost}"
ACME_EMAIL="${ACME_EMAIL:-}"
USE_OWN_CERT="${USE_OWN_CERT:-false}"
OWN_CERT="/etc/nginx/ssl/fullchain.crt"
OWN_KEY="/etc/nginx/ssl/private.key"
LE_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

# Create webroot for ACME challenge
mkdir -p /var/www/html

echo "========================================"
echo "  Nginx Auto-SSL Entrypoint"
echo "========================================"
echo "DOMAIN: $DOMAIN"

# Case 1: Localhost - HTTP only
if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
    echo "→ Mode: HTTP only (localhost)"
    envsubst '${DOMAIN}' < /etc/nginx/templates/http.conf.template > /etc/nginx/conf.d/default.conf

# Case 2: Own certificate (USE_OWN_CERT=true)
elif [[ "$USE_OWN_CERT" == "true" ]]; then
    if [[ -f "$OWN_CERT" && -f "$OWN_KEY" ]]; then
        echo "→ Mode: Own certificate"
        echo "  Cert: $OWN_CERT"
        echo "  Key:  $OWN_KEY"
        export SSL_CERT="$OWN_CERT"
        export SSL_KEY="$OWN_KEY"
        envsubst '${DOMAIN} ${SSL_CERT} ${SSL_KEY}' < /etc/nginx/templates/https.conf.template > /etc/nginx/conf.d/default.conf
    else
        echo "→ WARNING: USE_OWN_CERT=true but certificate files not found!"
        echo "  Expected: $OWN_CERT"
        echo "  Expected: $OWN_KEY"
        echo "  Falling back to HTTP only"
        envsubst '${DOMAIN}' < /etc/nginx/templates/http.conf.template > /etc/nginx/conf.d/default.conf
    fi

# Case 3: Let's Encrypt cert exists - use it
elif [[ -f "$LE_CERT" ]]; then
    echo "→ Mode: Let's Encrypt (existing)"
    export SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    export SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
    envsubst '${DOMAIN} ${SSL_CERT} ${SSL_KEY}' < /etc/nginx/templates/https.conf.template > /etc/nginx/conf.d/default.conf

# Case 4: Real domain, no cert - get Let's Encrypt
else
    echo "→ Mode: Let's Encrypt (new)"
    echo "  Obtaining certificate for $DOMAIN..."

    # Start nginx temporarily for ACME challenge
    envsubst '${DOMAIN}' < /etc/nginx/templates/http.conf.template > /etc/nginx/conf.d/default.conf
    nginx &
    NGINX_PID=$!
    sleep 3

    # Get certificate
    if [[ -n "$ACME_EMAIL" ]]; then
        EMAIL_FLAG="--email $ACME_EMAIL"
    else
        EMAIL_FLAG="--register-unsafely-without-email"
    fi
    CERT_OK=false
    if certbot certonly --webroot -w /var/www/html -d "$DOMAIN" $EMAIL_FLAG --agree-tos --non-interactive; then
        echo "  Certificate obtained successfully!"
        CERT_OK=true
    else
        echo "  ERROR: Failed to obtain certificate"
        echo "  Falling back to HTTP only"
    fi

    # Stop temporary nginx
    nginx -s quit 2>/dev/null || kill $NGINX_PID 2>/dev/null || true
    sleep 2

    # Configure with cert if obtained
    if [[ "$CERT_OK" == "true" ]]; then
        export SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
        export SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
        envsubst '${DOMAIN} ${SSL_CERT} ${SSL_KEY}' < /etc/nginx/templates/https.conf.template > /etc/nginx/conf.d/default.conf
    fi
fi

# Test nginx configuration
echo "========================================"
echo "  Testing Nginx configuration..."
echo "========================================"
if nginx -t; then
    echo "  ✓ Configuration OK"
else
    echo "  ✗ Configuration FAILED"
    exit 1
fi

# Start cron for auto-renewal (background)
crond

echo "========================================"
echo "  Starting Nginx..."
echo "========================================"
exec "$@"
