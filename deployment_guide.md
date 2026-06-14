# 🚀 Free Deployment Guide — RIT Academic Portal

Your app has:
- **Frontend** → Vite + React (deploy to **Vercel** — free)
- **Backend** → Node.js + Express (deploy to **Render** — free)
- **Database** → MongoDB Atlas (already connected ✅)

---

## Architecture Overview

```
Browser → Vercel (Frontend) → Render (Backend) → MongoDB Atlas
```

---

## STEP 1 — Push Code to GitHub

> [!IMPORTANT]
> You must push your code to GitHub first. Both Vercel and Render deploy directly from GitHub.

### 1a. Create a GitHub account
Go to [github.com](https://github.com) → Sign up (free).

### 1b. Create a new repository
1. Click **"New repository"** → Name it `rit-cgpa-portal`
2. Set it to **Private** (your `.env` has passwords — keep it private)
3. Click **"Create repository"**

### 1c. Push from your computer
Open **PowerShell** in `C:\Users\kishore ST\Desktop\CGPA` and run these commands one by one:

```powershell
git init
git add .
git commit -m "Initial commit — RIT Academic Portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rit-cgpa-portal.git
git push -u origin main
```

> [!WARNING]
> The `.gitignore` already excludes `.env` and `node_modules` — your passwords will NOT be uploaded. ✅

---

## STEP 2 — Deploy Backend on Render (Free)

### 2a. Sign up on Render
Go to [render.com](https://render.com) → Sign up with your **GitHub account**.

### 2b. Create a Web Service
1. Click **"New +"** → **"Web Service"**
2. Select **"Connect a repository"** → Choose `rit-cgpa-portal`
3. Fill in the settings:

| Field | Value |
|---|---|
| **Name** | `rit-cgpa-backend` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### 2c. Add Environment Variables
In the **"Environment Variables"** section, add these **3 variables**:

| Key | Value |
|---|---|
| `PORT` | `5000` |
| `MONGODB_URI` | `mongodb+srv://digicertify:digicertify30@digicertify.klw4qlw.mongodb.net/cgpa?appName=DigiCertify` |
| `JWT_SECRET` | `cgpa_secret_key_123_rit_portal` |

4. Click **"Create Web Service"**
5. Wait ~3 minutes for it to deploy
6. **Copy your backend URL** — it will look like:
   ```
   https://cgpa-lr2c.onrender.com
   ```

> [!NOTE]
> On Render's free tier, the server **sleeps after 15 minutes of inactivity**. The first request after sleeping takes ~30 seconds to wake up. This is normal on the free plan.

---

## STEP 3 — Update Frontend API URL

Before deploying the frontend, you need to tell it where the backend is.

### 3a. Create a `.env` file in the frontend folder

Create `C:\Users\kishore ST\Desktop\CGPA\frontend\.env`:

```env
VITE_API_URL=https://cgpa-lr2c.onrender.com/api
```

### 3b. Update `lib/api.ts` to use the env variable

Open `C:\Users\kishore ST\Desktop\CGPA\frontend\lib\api.ts` and change **line 1** from:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5000/api` : 'http://localhost:5000/api');
```

To:

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5000/api` : 'http://localhost:5000/api');
```

### 3c. Add frontend `.env` to `.gitignore`

Open `C:\Users\kishore ST\Desktop\CGPA\.gitignore` and add this line at the bottom:
```
frontend/.env
```

### 3d. Commit and push the changes

```powershell
git add frontend/lib/api.ts .gitignore
git commit -m "Use VITE_API_URL env variable for backend URL"
git push
```

---

## STEP 4 — Deploy Frontend on Vercel (Free)

### 4a. Sign up on Vercel
Go to [vercel.com](https://vercel.com) → Sign up with your **GitHub account**.

### 4b. Import Project
1. Click **"Add New..."** → **"Project"**
2. Select `rit-cgpa-portal` from your GitHub repos
3. Click **"Import"**

### 4c. Configure the project

| Field | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 4d. Add Environment Variable
In the **"Environment Variables"** section:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://cgpa-lr2c.onrender.com/api` |

*(Replace with your actual Render URL from Step 2)*

5. Click **"Deploy"**
6. Wait ~2 minutes
7. Vercel gives you a free URL like:
   ```
   https://rit-cgpa-portal.vercel.app
   ```

---

## STEP 5 — Fix CORS on Backend

The backend needs to allow requests from your Vercel domain.

Open `C:\Users\kishore ST\Desktop\CGPA\backend\index.js` and replace:
```js
app.use(cors());
```

With:
```js
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://rit-cgpa-portal.vercel.app',   // ← your Vercel URL
    /\.vercel\.app$/                          // ← any Vercel preview URLs
  ],
  credentials: true
}));
```

Then push to GitHub:
```powershell
git add backend/index.js
git commit -m "Fix CORS for Vercel deployment"
git push
```

Render will **auto-redeploy** after the push ✅

---

## STEP 6 — Final Verification

1. Open your Vercel URL: `https://rit-cgpa-portal.vercel.app`
2. Try logging in with admin credentials
3. Test all features — staff management, GPA calculation, OCR, etc.

---

## Summary Table

| Service | Platform | Free Tier Limits |
|---|---|---|
| **Frontend** | Vercel | Unlimited deployments, 100GB bandwidth/month |
| **Backend** | Render | 750 hours/month, sleeps after 15min idle |
| **Database** | MongoDB Atlas | 512MB storage (already set up ✅) |

> [!TIP]
> Your Vercel URL is permanent and shareable. Share `https://rit-cgpa-portal.vercel.app` with your college.

> [!CAUTION]
> Change your `JWT_SECRET` to something more secure before going live. The current one is in plain text in your `.env`.
