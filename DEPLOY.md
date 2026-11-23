# FairShare — AWS par deploy kaise karein (step by step)

Ye guide aapko zero se live website tak le jaayegi. Har step ke baad "✅ Check" hai — wahi dikhe tab aage badho.

## Setup kaisa hoga (samajh lo bas)

```
User ka phone/browser
        │  https://aapkadomain.com
        ▼
┌──────────────── EC2 server (Ubuntu) ────────────────┐
│  Nginx  ── /          → app ki files (React build)   │
│         └─ /api/...   → Node backend (PM2, port 4000)│
└──────────────────────────────────┬───────────────────┘
                                   ▼
                         MongoDB Atlas (database)
```

- **GitHub Actions** (pipeline): aap `main` par code push karoge → wo tests chalayega → app build karega → EC2 par bhej dega → backend restart. Sab automatic.
- Har deploy ek alag "release" folder me jaata hai. Naya version start na ho to pipeline **apne aap purana version wapas** chala deti hai.

---

## Step 0 — Ye cheezein chahiye

| Cheez | Kyun | Kahan se |
|---|---|---|
| AWS account + 1 EC2 instance (Ubuntu 22.04/24.04, `t3.small` ya `t2.micro`) | App chalane ke liye | AWS Console |
| EC2 ki `.pem` key (aapke paas `fairshare-backend-key.pem` hai) | Server me login | Instance banate waqt mili thi |
| MongoDB Atlas database | Data store | https://cloud.mongodb.com (free M0 chalega) |
| Domain name (jaise `fairshare.in`) — **strongly recommended** | HTTPS ke bina PWA install aur Google login kaam nahi karte | GoDaddy / Hostinger / Namecheap |

> ⚠️ `.pem` file kabhi GitHub par mat daalna. Ab `.gitignore` me hai, safe hai.

---

## Step 1 — Pata karo AWS me pehle se kya bana hai (aapka confusion yahi hai)

AWS Console kholo → upar region check karo (jaise **Mumbai ap-south-1**) → **EC2 → Instances**.

Is checklist ko bharo:

| Check | Kahan dekhein | Kya hona chahiye |
|---|---|---|
| Instance hai? | EC2 → Instances | Ek instance, **State = Running**. Agar "Stopped" hai → select → *Instance state → Start* |
| OS kaunsa hai? | Instance select → *Details* → **AMI name** | `ubuntu` likha ho. (Amazon Linux hai to batana — commands thodi alag hongi) |
| Key pair | Details → **Key pair name** | Wahi naam jo aapki `.pem` file ka hai (`fairshare-backend-key`) |
| Public IP | Details → **Public IPv4 address** | Ek IP jaise `13.233.x.x` |
| Elastic IP (fixed IP) | EC2 → *Network & Security → Elastic IPs* | Ek Elastic IP jo is instance se **associated** ho. Nahi hai to: *Allocate Elastic IP* → *Actions → Associate* → apna instance. (Bina iske restart par IP badal jaata hai) |
| Ports khule? | Instance → *Security* tab → Security group → **Inbound rules** | `22` (SSH) — *My IP*, `80` (HTTP) — `0.0.0.0/0`, `443` (HTTPS) — `0.0.0.0/0`. Port `4000` khulna **nahi** chahiye |

Jo missing hai wahi banao. Pehle se kuch install kiya tha to koi baat nahi — Step 3 ki script dobara chalane par sab theek kar degi.

✅ Check: Instance Running hai, Elastic IP laga hai, ports 22/80/443 khule hain.

---

## Step 2 — Server me login (Windows se)

PowerShell kholo, jahan `.pem` file hai wahan jao, aur key ki permission theek karo (sirf ek baar):

```powershell
icacls .\fairshare-backend-key.pem /inheritance:r
icacls .\fairshare-backend-key.pem /grant:r "$($env:USERNAME):(R)"
```

Login karo (`<ELASTIC-IP>` ki jagah apna IP):

```powershell
ssh -i .\fairshare-backend-key.pem ubuntu@<ELASTIC-IP>
```

Pehli baar `yes` likhna padega.

✅ Check: prompt `ubuntu@ip-...:~$` dikh raha hai.

---

## Step 3 — Server ka one-time setup (script sab kar degi)

**Apne computer par** (naya PowerShell, project folder me) deploy folder server par bhejo:

```powershell
scp -i .\fairshare-backend-key.pem -r .\deploy ubuntu@<ELASTIC-IP>:~/
```

**Server par** (SSH wali window me):

```bash
bash ~/deploy/setup-server.sh aapkadomain.com      # domain hai to
# ya
bash ~/deploy/setup-server.sh                       # abhi sirf IP se test karna hai to
```

Ye install karegi: swap memory, Nginx, Node.js 22, PM2, Certbot, aur folders `/var/www/fairshare`.

✅ Check: browser me `http://<ELASTIC-IP>` kholo → Nginx ka "404 / 500" page aana theek hai (app abhi deploy nahi hua). "Site can't be reached" aaye to Security group me port 80 check karo.

---

## Step 4 — Database (MongoDB Atlas)

1. https://cloud.mongodb.com → apna cluster (nahi hai to *Create → M0 Free*, region **Mumbai**).
2. *Database Access* → user banao (username + strong password).
3. *Network Access* → *Add IP Address* → apna **Elastic IP** daalo.
4. *Connect → Drivers* → connection string copy karo, jaise:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hisabhub?retryWrites=true&w=majority`
   (`/hisabhub` database ka naam hai — zaroor likhna.)

> Render par jo database chal raha tha wahi chahiye (purana data) to Render ke dashboard me jo `MONGO_URI` hai wahi use karo.

---

## Step 5 — Production secrets server par daalo

Server par:

```bash
nano /var/www/fairshare/shared/backend.env
```

Ye paste karo aur apni values bharo (local `backend/.env` se copy kar sakte ho, lekin niche wale 4 zaroor badalna):

```env
NODE_ENV=production
PORT=4000
CLIENT_URL=https://aapkadomain.com
TRUSTED_ORIGINS=https://aapkadomain.com,https://www.aapkadomain.com
COOKIE_DOMAIN=
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hisabhub?retryWrites=true&w=majority

JWT_ACCESS_SECRET=<naya lamba random>
JWT_REFRESH_SECRET=<doosra lamba random>
JWT_ACCESS_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=<same as local>
TWILIO_ACCOUNT_SID=<same as local>
TWILIO_AUTH_TOKEN=<same as local>
TWILIO_VERIFY_SERVICE_SID=<same as local>
OTP_EXPIRY_MINUTES=5
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=<same as local>
RAZORPAY_KEY_SECRET=<same as local>
ADMIN_REGISTRATION_SECRET=<koi lamba random>
```

- Sirf IP se test kar rahe ho to `CLIENT_URL=http://<ELASTIC-IP>` aur `TRUSTED_ORIGINS=http://<ELASTIC-IP>`.
- Random secret banane ke liye server par: `openssl rand -hex 32` (do baar chalao, do alag values).
- Save: `Ctrl+O` → Enter → `Ctrl+X`.

> JWT secrets badaloge to purane logged-in users ko ek baar dobara login karna padega — normal hai.

---

## Step 6 — GitHub me pipeline ke secrets daalo

GitHub → repo **Fairshare** → *Settings → Secrets and variables → Actions → New repository secret*. Teen secrets:

| Name | Value |
|---|---|
| `EC2_HOST` | Aapka Elastic IP (jaise `13.233.10.20`) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | `.pem` file ka **poora text** (Notepad me kholo → sab copy, `-----BEGIN` se `-----END ...-----` tak) |

---

## Step 7 — Deploy!

GitHub → *Actions* tab → **CI & Deploy** → *Run workflow* → `main` → Run.
(Aage se har `git push` par apne aap chalega.)

Do jobs dikhengi:
1. **Test & build** — tests + app build
2. **Deploy to EC2** — server par bhejna + restart + health check

✅ Check: dono ✅ green. Browser me `http://<ELASTIC-IP>` (ya domain) → FairShare ka login page.

---

## Step 8 — Domain + HTTPS (zaroori, PWA aur Google login ke liye)

1. Domain provider ke DNS me **A record**: `@` → `<ELASTIC-IP>` aur `www` → `<ELASTIC-IP>`. 5–30 min lagte hain.
   Check: `nslookup aapkadomain.com` me aapka IP aaye.
2. Server par:
   ```bash
   sudo certbot --nginx -d aapkadomain.com -d www.aapkadomain.com
   ```
   Email daalo, terms `Y`. Certbot khud HTTPS laga dega aur har 90 din renew karega.
3. `backend.env` me `CLIENT_URL`/`TRUSTED_ORIGINS` `https://...` hon, phir: `pm2 restart fairshare-api`

✅ Check: `https://aapkadomain.com` par 🔒 lock dikhe.

---

## Step 9 — Bahar ki services me naya address daalo

| Service | Kya karna hai |
|---|---|
| **Google login** | Google Cloud Console → *APIs & Services → Credentials* → OAuth client → *Authorized JavaScript origins* me `https://aapkadomain.com` add karo |
| **Razorpay** (jab on karo) | Dashboard me website URL update |
| **Render / Vercel** (purana) | AWS par sab chal jaaye to Render service aur Vercel project **band** kar do — warna do jagah alag-alag app chalega |

---

## Live setup (current)

- Main address: **https://splitcircle.duckdns.org** (free DuckDNS name → `15.134.37.177`).
  The bare IP, `http://` and `15-134-37-177.sslip.io` all redirect there.
- The live Nginx file is [`deploy/nginx-fairshare-https.conf`](deploy/nginx-fairshare-https.conf).
  ⚠️ Running `setup-server.sh` again would replace it with the plain-http template — copy this file back afterwards:
  `sudo cp deploy/nginx-fairshare-https.conf /etc/nginx/sites-available/fairshare && sudo nginx -t && sudo systemctl reload nginx`
- Certificates renew by themselves (certbot timer). Check with `sudo certbot renew --dry-run`.
- If the server IP ever changes: update the IP on duckdns.org (keep an Elastic IP attached to avoid this).

## Roz ka kaam

- Code badla → `git push origin main` → 3–5 min me live. Bas.
- GitHub *Actions* tab me dekh sakte ho deploy chala ya nahi.

## Kuch gadbad ho to (server par)

| Problem | Command |
|---|---|
| Backend ke logs | `pm2 logs fairshare-api --lines 100` |
| Backend chal raha hai? | `pm2 status` · `curl http://127.0.0.1:4000/api/health` |
| Backend restart | `pm2 restart fairshare-api` |
| Nginx config sahi hai? | `sudo nginx -t` · `sudo systemctl reload nginx` |
| Nginx errors | `sudo tail -n 50 /var/log/nginx/error.log` |
| Purane version par wapas | `ls -t /var/www/fairshare/releases` → `bash /var/www/fairshare/releases/<ID>/deploy/deploy.sh <ID>` |
| "502 Bad Gateway" | Backend band hai → `pm2 logs` me error dekho (aksar `backend.env` me galat `MONGO_URI` ya Atlas Network Access me IP nahi) |
| Deploy job: "EC2_HOST … not set" | Step 6 ke secrets nahi daale |
| Deploy job: "Permission denied (publickey)" | `EC2_SSH_KEY` me poori `.pem` nahi chipki, ya `EC2_USER` galat |
| Deploy job: "backend.env is empty" | Step 5 nahi hua |
