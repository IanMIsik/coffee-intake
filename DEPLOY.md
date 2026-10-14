# Going live: deployment runbook

This puts the API, the web app and the database on one server with automatic HTTPS.
Work through it top to bottom. Nothing here needs code changes.

## 0. What you need first

| Item | Notes |
|---|---|
| A server | Ubuntu 22.04+ VM (AWS EC2/Lightsail, 2 GB RAM is enough to start), ports 80 and 443 open |
| A domain | Two names pointing at the server's IP: `app.yourdomain` and `api.yourdomain` |
| Africa's Talking live app | Username + a freshly generated live API key, with credit loaded |
| (Recommended) An S3 bucket | **Private**, plus an IAM user limited to that bucket. Without it, photos live on the server's disk |

Do not reuse any key or password that was ever pasted into a chat or committed anywhere.

## 1. Prepare the server

```bash
# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in
# Get the code onto the server (git clone, or copy the project folder)
cd coffee-management-system/deploy
```

## 2. Configure

```bash
cp .env.production.example .env.production
nano .env.production           # fill in EVERY value
```

Generate the two secrets (run twice, one value each):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API **refuses to start** if a secret is short or still a placeholder, or if the web address
list is missing. That is deliberate.

## 3. Start it

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps     # all "healthy"/"running"
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
```

The first start applies database migrations automatically. HTTPS certificates are issued on the
first visit to each address (DNS must already point at the server).

## 4. Create your real organization and admin

Do **not** run the demo seed. It is blocked in production because it creates accounts with a
well-known password.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node dist/create-org.js \
    --name "Richard Misik Estate" --slug richard-misik-estate --sender RMEstate \
    --admin-name "Your Name" --admin-phone 0712345678
```

It prints a generated admin password **once**. Write it down, sign in, then change it under Account.
Use the same `--slug` as `ORGANIZATION_SLUG` in `.env.production`. (If you change it later, rebuild the web image.)

Then, signed in as admin: add staff (Staff page), add farmers (or import them), and test a login code
and a receipt text to your own number.

## 5. Check it

- `https://api.yourdomain/health/ready` shows `{"ok":true,"database":"up"}`
- `https://app.yourdomain` loads and staff can sign in
- Record a test delivery with a photo; the photo shows on the farmer page and the farmer gets a text
- `http://` addresses redirect to `https://`

## 6. Backups (do this before real data goes in)

```bash
./backup.sh                      # writes backups/coffee-<time>.sql.gz, keeps 14 days
crontab -e                       # then add:  15 2 * * *  /full/path/to/deploy/backup.sh
```

Optional off-server copy: set `BACKUP_S3_URI=s3://your-backup-bucket/coffee/` (needs the `aws` CLI).
**Test a restore on a spare server before you rely on it:** `./restore.sh backups/<file>.sql.gz`.
If photos are on local disk (no S3), also back up the `uploads` Docker volume.

## 7. The mobile app

1. Edit nothing in the code. Build with the production profile so plain `http://` is switched off:
   `cd apps/mobile && npx eas-cli build -p android --profile production-apk` (installable APK)
   or `--profile production` (an AAB for Google Play).
2. On first launch, tap **Change** next to "Server" on the login screen and enter
   `https://api.yourdomain` and your organization code.
3. iPhone: needs an Apple Developer account ($99/year) and an iOS build, then TestFlight or the App Store.
4. Add a custom icon and splash image to `apps/mobile` before publishing to a store.

## 8. Updating

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on start. Take a backup first (`./backup.sh`).

## 9. Things to decide / know

- **Single server:** rate limits are counted in memory, which is correct for one API container. Running
  several would need a shared store (e.g. Redis).
- **Africa's Talking sender ID:** leave `AFRICASTALKING_USE_SENDER_ID=false` until your sender ID is
  approved, then set it to `true` and set the organization's SMS sender name to the exact registered text.
- **Monitoring:** `docker compose logs api` shows structured logs. Add an uptime check on
  `/health/ready` (e.g. UptimeRobot) so you hear about outages before farmers do.
- **Privacy:** you hold farmers' names, phone numbers and IDs. Check whether you must register with
  Kenya's Data Protection Commissioner, give farmers a privacy notice, and tell them they will receive SMS.
- **Not built yet:** prices/amounts owed per kilo, and a full edit history that keeps old values.
