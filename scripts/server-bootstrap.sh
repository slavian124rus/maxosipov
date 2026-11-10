#!/usr/bin/env bash
# Первичная настройка чистого Ubuntu 24.04 (запускать от root, идемпотентно).
#   DEPLOY_PUBKEY="ssh-ed25519 AAAA... ci" bash server-bootstrap.sh
# Делает: пользователь deploy (ключ для GitHub Actions), Docker, firewall, fail2ban, swap, каталоги.
# Вход по паролю не отключает — это отдельное решение владельца (см. docs/ops/ci-cd.md).
set -euo pipefail

: "${DEPLOY_PUBKEY:?задай DEPLOY_PUBKEY — публичный ключ для пользователя deploy}"
export DEBIAN_FRONTEND=noninteractive

echo "→ пользователь deploy"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qxF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "→ пакеты"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker deploy

echo "→ firewall"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "→ swap (если нет)"
if [ -z "$(swapon --show --noheadings)" ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "→ каталоги"
install -d -o deploy -g deploy /opt/maxosipov /opt/maxosipov/docker
install -d /data/postgres /data/media /data/backups
chown deploy:deploy /data/backups

systemctl enable --now fail2ban >/dev/null 2>&1 || true
echo "✓ сервер готов: $(docker --version)"
