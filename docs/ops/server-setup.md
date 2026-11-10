# Сервер FirstVPS: первичная настройка

Пошаговая инструкция для владельца (или исполнителя с SSH-доступом).
Выполняется один раз. Дальше — выкладка через GitHub Actions (см. `docs/ops/ci-cd.md`) или вручную `./scripts/deploy.sh`.

## 1. VPS

Заказать у FirstVPS (РФ, 152-ФЗ): **Ubuntu 24.04 LTS, 4 vCPU, 8 ГБ RAM, 160 ГБ NVMe**
(ARCHITECTURE.md §16 — запас по диску нужен из-за ffmpeg и видео).

## 2. Пользователь `deploy`

```bash
adduser deploy
usermod -aG sudo deploy

# на своей машине: скопировать ключ
ssh-copy-id deploy@<IP-сервера>
```

На сервере запретить вход по паролю:

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

Проверить, что вход по ключу работает, и только потом закрывать текущую сессию.

## 3. Файрвол

```bash
sudo ufw allow 22,80,443/tcp
sudo ufw enable
sudo ufw status
```

## 4. Docker Engine + compose plugin

По официальной инструкции Docker для Ubuntu:
<https://docs.docker.com/engine/install/ubuntu/>

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

Перелогиниться, проверить: `docker run --rm hello-world`.

## 5. DNS

У регистратора `maxosipov.ru` создать A-записи на IP сервера:

| Имя | Тип | Значение |
|---|---|---|
| `@` | A | IP сервера |
| `www` | A | IP сервера |
| `app` | A | IP сервера |

Проверить, что DNS разошёлся (может занять до часа):

```bash
dig +short app.maxosipov.ru
```

## 6. Код и окружение

```bash
sudo mkdir -p /opt/maxosipov /data/postgres /data/media /data/backups
sudo chown -R deploy:deploy /opt/maxosipov /data

git clone <репозиторий> /opt/maxosipov
cd /opt/maxosipov

cp .env.example .env
nano .env          # продакшн-значения: DATABASE_URL, AUTH_SECRET, ключи, SEED_*_PHONE
cp docker/backup.env.example docker/backup.env
nano docker/backup.env   # RESTIC_REPOSITORY, RESTIC_PASSWORD, AWS_*
```

`DATABASE_URL` в `.env` нужен только для локальных команд; контейнеры получают
`postgres://app:<пароль>@db:5432/maxosipov` из `docker/compose.yml`.
Пароль базы задаётся переменной `POSTGRES_PASSWORD` в `.env`.

Секрет сессии: `openssl rand -base64 48`.

## 7. Первый деплой

```bash
chmod +x scripts/*.sh
./scripts/deploy.sh
```

Скрипт подтягивает код, собирает образы, поднимает контейнеры и ждёт
`https://app.maxosipov.ru/api/health` до 60 секунд.

## 8. Бэкапы

```bash
sudo apt-get install -y restic
chmod +x scripts/backup.sh scripts/restore-check.sh
./scripts/backup.sh            # первый снапшот
restic snapshots               # проверить
```

Cron (ежедневно в 03:30 по Красноярску):

```bash
sudo tee /etc/cron.d/maxosipov-backup > /dev/null <<'CRON'
CRON_TZ=Asia/Krasnoyarsk
30 3 * * * deploy cd /opt/maxosipov && ./scripts/backup.sh >> /var/log/maxosipov-backup.log 2>&1
CRON
sudo touch /var/log/maxosipov-backup.log
sudo chown deploy:deploy /var/log/maxosipov-backup.log
```

Раз в месяц — тестовое восстановление:

```bash
./scripts/restore-check.sh
```

## 9. Проверки после деплоя

```bash
curl -sI https://maxosipov.ru            # 200, валидный сертификат
curl -sI https://www.maxosipov.ru        # 308 на https://maxosipov.ru/
curl -s  https://app.maxosipov.ru/api/health   # {"ok":true,"db":"up"}
```
