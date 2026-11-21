#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04/24.04 EC2 instance for FairShare.
# Safe to run again. Usage (on the server):
#   bash setup-server.sh yourdomain.com      # with a domain (recommended)
#   bash setup-server.sh                     # IP only (no HTTPS — PWA install & Google login won't work)
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR=/var/www/fairshare
DEPLOY_USER="$(whoami)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 1/6  Swap file (stops builds/npm from running out of memory on small instances)"
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> 2/6  System packages (nginx, certbot)"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx curl ca-certificates rsync certbot python3-certbot-nginx

echo "==> 3/6  Node.js 22 LTS + PM2"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2@latest
# Start PM2 on boot for this user
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "$HOME" >/dev/null

echo "==> 4/6  App folders in $APP_DIR"
sudo mkdir -p "$APP_DIR"/{releases,shared,logs}
sudo chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"
if [ ! -f "$APP_DIR/shared/backend.env" ]; then
  touch "$APP_DIR/shared/backend.env"
  chmod 600 "$APP_DIR/shared/backend.env"
fi

echo "==> 5/6  Nginx site"
SERVER_NAME="_"
if [ -n "$DOMAIN" ]; then SERVER_NAME="$DOMAIN www.$DOMAIN"; fi
sed "s/__SERVER_NAME__/$SERVER_NAME/" "$SCRIPT_DIR/nginx-fairshare.conf" | sudo tee /etc/nginx/sites-available/fairshare >/dev/null
sudo ln -sfn /etc/nginx/sites-available/fairshare /etc/nginx/sites-enabled/fairshare
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "==> 6/6  Done"
cat <<EOF

Next steps (see DEPLOY.md):
  1. Put your production secrets in:   $APP_DIR/shared/backend.env
       nano $APP_DIR/shared/backend.env
  2. Add the GitHub secrets (EC2_HOST, EC2_USER=$DEPLOY_USER, EC2_SSH_KEY) and run the deploy workflow.
EOF
if [ -n "$DOMAIN" ]; then
  echo "  3. After your domain points to this server, turn on HTTPS:"
  echo "       sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi
