# Jagdamba admin console: setup guide

The admin console lives inside your main website at **https://jgdmba.netlify.app/admin**. Only Google accounts
listed in `ADMIN_EMAILS` can open it, and it is never included in the phone app. It has two sections:

- **Users:** registered users, users active today, this week and this month, new sign-ups, a 30-day chart,
  and **users by state and city** (only state and city are stored, never exact locations).
- **Payments:** active subscriptions, payments, renewals, cancellations, refunds and revenue.
  This section shows zeros until Google Play billing launches (Phase 4).

It only ever shows **counts and totals**. Nobody's name, phone number, contacts or location is sent to it.

You'll set up five things, in this order. Each one is a few clicks.

---

## Part A. Server that never sleeps (paid, US$7/month) — later

Your Render service is **Blueprint managed**, which means `render.yaml` in the code decides its settings.
It is on the **free** plan for now, so the console may take about a minute to open after a quiet period.
The health check (`/api/health`) is already set in `render.yaml`.

When you're ready to upgrade:
1. Add a payment card in Render: profile (top right) → **Billing** → add a card.
2. In `render.yaml`, change `plan: free` to `plan: starter`, then merge that change into `main`.
   Render switches plans and starts billing US$7/month.

## Part B. Upgrade the database (paid, US$8/month base, maximum US$30)

1. Go to https://cloud.mongodb.com and open your cluster.
2. Click **Edit Configuration** (or **Upgrade**) and choose **Flex**.
3. Confirm. This can take a few minutes, so do it at a quiet time.
   Afterwards, check that the app still opens. If MongoDB shows a new connection string, update `MONGO_URL` in Render.

## Part C. Admin website

Nothing to set up: the website build adds the dashboard at `/admin` automatically.
If you created a separate Netlify project called `jagdamba-admin` earlier, it isn't needed; you can delete it
(Netlify → that project → Project configuration → Danger zone → Delete project).

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
   - **Authorized JavaScript origins:** add `https://jgdmba.netlify.app` (no slash at the end)
   - Click **Create**.
6. Copy the **Client ID**. It looks like `123456789-abc...apps.googleusercontent.com`. This ID is not a secret.

## Part E. Tell the server who the admin is

1. In Render → **jagdamba-backend** → **Environment**, add two variables:

   | Key | Value |
   |---|---|
   | `ADMIN_GOOGLE_CLIENT_ID` | the Client ID from Part D |
   | `ADMIN_EMAILS` | your Google email, e.g. `you@gmail.com` (several emails can be separated by commas) |

2. If a variable called `CORS_ORIGINS` already exists, make sure `https://jgdmba.netlify.app` is in it.
   If it doesn't exist, don't create it.
3. Click **Save changes**. Render restarts the server.

## Open it

Go to **https://jgdmba.netlify.app/admin** and click **Sign in with Google**.

| Message | What it means |
|---|---|
| "The admin console isn't switched on yet" | Part E is missing or the server hasn't restarted yet |
| "This Google account is not allowed" | The email you signed in with isn't in `ADMIN_EMAILS` |
| Google says "Access blocked" or "origin not allowed" | Part D step 5 must say exactly `https://jgdmba.netlify.app` |
| "Waking up the server…" | The server is still on the free plan (Part A) |
