# Jagdamba admin console: setup guide

The admin console is a private website only you can open. It has two sections:

- **Users:** registered users, users active today, this week and this month, new sign-ups, and a 30-day chart.
- **Payments:** active subscriptions, payments, renewals, cancellations, refunds and revenue.
  This section shows zeros until Google Play billing launches (Phase 4).

It only ever shows **counts and totals**. Nobody's name, phone number, contacts or location is sent to it.

You'll set up five things, in this order. Each one is a few clicks.

---

## Part A. Server that never sleeps (paid, US$7/month)

Your Render service is **Blueprint managed**, which means `render.yaml` in the code decides its settings.
The code now sets the paid plan (`plan: starter`, 0.5 CPU / 512 MB) and the health check (`/api/health`).

1. **Before merging the code into `main`**, add a payment card in Render: click your profile (top right) →
   **Billing** → add a card. Without a card, Render can't switch to the paid plan.
2. When the code is merged into `main`, Render applies the paid plan and starts billing.
   You don't need to change the plan or the health check in the dashboard.
3. The old "Keep backend awake" job has been removed. It pinged an old address, and a paid server doesn't sleep.

## Part B. Upgrade the database (paid, US$8/month base, maximum US$30)

1. Go to https://cloud.mongodb.com and open your cluster.
2. Click **Edit Configuration** (or **Upgrade**) and choose **Flex**.
3. Confirm. This can take a few minutes, so do it at a quiet time.
   Afterwards, check that the app still opens. If MongoDB shows a new connection string, update `MONGO_URL` in Render.

## Part C. Put the admin website online (free)

1. Go to https://app.netlify.com → **Add new site** → **Import an existing project** → **GitHub**.
2. Choose the **Jagdamba-** repository.
3. Settings:
   - **Branch to deploy:** `main`
   - **Base directory:** `admin`
   - **Build command:** leave empty
   - **Publish directory:** `admin`
4. Click **Deploy**. When it finishes, Netlify shows the site's address, for example
   `https://random-name-123.netlify.app`. Rename it under **Site configuration → Change site name**,
   for example to `jagdamba-admin`. **Write the final address down.**

## Part D. Create the Google sign-in (free)

1. Go to https://console.cloud.google.com and sign in with **the Google account you'll use as admin**.
2. At the top, click the project picker → **New project** → name it `Jagdamba Admin` → **Create**, and select it.
3. In the search bar, open **Google Auth Platform** and click **Get started**:
   - App name: `Jagdamba Admin`, support email: your email → **Next**
   - Audience: **External** → **Next**
   - Contact email: your email → **Next** → agree → **Create**
4. Go to **Audience** → under **Test users** click **Add users**, add **your own email**, and save.
   (The app stays in "Testing" mode, which is what we want, because only listed test users can sign in at all.)
5. Go to **Clients** → **Create client**:
   - Application type: **Web application**, name: `Admin console`
   - **Authorized JavaScript origins:** add your Netlify address from Part C, e.g. `https://jagdamba-admin.netlify.app`
     (no slash at the end)
   - Click **Create**.
6. Copy the **Client ID**. It looks like `123456789-abc...apps.googleusercontent.com`. This ID is not a secret.

## Part E. Tell the server who the admin is

1. In Render → **jagdamba-backend** → **Environment**, add two variables:

   | Key | Value |
   |---|---|
   | `ADMIN_GOOGLE_CLIENT_ID` | the Client ID from Part D |
   | `ADMIN_EMAILS` | your Google email, e.g. `you@gmail.com` (several emails can be separated by commas) |

2. If a variable called `CORS_ORIGINS` already exists, add your admin address to it after a comma.
   If it doesn't exist, don't create it.
3. Click **Save changes**. Render restarts the server.

## Open it

Go to your admin address and click **Sign in with Google**.

| Message | What it means |
|---|---|
| "The admin console isn't switched on yet" | Part E is missing or the server hasn't restarted yet |
| "This Google account is not allowed" | The email you signed in with isn't in `ADMIN_EMAILS` |
| Google says "Access blocked" or "origin not allowed" | The Netlify address in Part D step 5 doesn't exactly match |
| "Waking up the server…" | The server is still on the free plan (Part A) |
