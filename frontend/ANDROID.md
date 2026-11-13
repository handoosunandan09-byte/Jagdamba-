# Jagdamba Android app: build and test on Windows

This guide takes you from a fresh Windows laptop to Jagdamba running on your Android phone.
Do the steps in order. Commands go into **PowerShell**: press the Windows key, type
`PowerShell`, and press Enter. Paste a command, then press Enter.

---

## Step 1. Install the tools (one time only, about 45 minutes)

| Tool | Where to get it | Why |
|---|---|---|
| Git for Windows | https://git-scm.com/download/win (accept all defaults) | Saves versions of your code and sends them to GitHub |
| Node.js **22 LTS** | https://nodejs.org (choose the 22.x LTS installer) | Builds the React app |
| Android Studio (latest stable) | https://developer.android.com/studio | Builds the Android app. It includes Java (JDK 21), so you don't need to install Java separately. |

After installing, **close and reopen PowerShell**, then check:

```powershell
git --version
node -v      # should print v22.something
npm -v
```

Open Android Studio once. Choose **Standard** setup and let it download the Android SDK.
This download is several GB, so use Wi-Fi.

---

## Step 2. Put the project on your laptop

1. Extract `Jagdamba-android-phase2.zip` to a simple path such as `C:\dev\Jagdamba-`.
   Avoid OneDrive folders, because they slow builds down and lock files.
2. Open PowerShell in that folder:

```powershell
cd C:\dev\Jagdamba-
git status          # should say: On branch android/phase-2, nothing to commit
git log --oneline -3
```

3. Send the work to GitHub. This creates **new branches** only. Your `main` branch and your
   live Netlify site do not change.

```powershell
git push -u origin backup/pre-android-2026-11-13
git push -u origin android/phase-2
```

If a GitHub sign-in window appears, sign in with your GitHub account.

---

## Step 3. Build the web app and copy it into Android

```powershell
cd C:\dev\Jagdamba-\frontend
npm install --legacy-peer-deps     # first time only, takes a few minutes
npm run android:sync               # builds React and copies it into the android folder
npm run android:open               # opens the project in Android Studio
```

Run `npm run android:sync` again **every time you change the React code**.

---

## Step 4. First open in Android Studio

1. Wait for **Gradle sync** to finish. Watch the progress bar at the bottom. The first sync
   downloads a lot and can take 5–15 minutes.
2. If Android Studio offers to install a missing SDK ("Android 16 / API 36"), click **Install**.
3. If it offers to "upgrade the Android Gradle Plugin", click **Don't ask again**. Upgrading
   can break the Capacitor setup.

---

## Step 5. Run it on your phone

**On the phone (one time only):**
1. Settings → About phone → tap **Build number** 7 times. This turns on Developer options.
2. Settings → System → Developer options → turn on **USB debugging**.
3. Connect the phone with a USB data cable and tap **Allow** on the phone.

**In Android Studio:** choose your phone in the device menu at the top, then click the green **Run ▶** button.

### Or make an APK file to share

In Android Studio, go to **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. When it
finishes, click **locate**. The file is:

```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Command-line alternative:

```powershell
cd C:\dev\Jagdamba-\frontend\android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug
```

This is a **debug** APK for testing only. The signed Play Store bundle (`.aab`) comes in Phase 5.

---

## Step 6. Test checklist (please send me the results)

> **Warning:** a real SOS sends real WhatsApp/SMS messages to your saved contacts. Tell them
> you are testing first, or save only your own second number as a contact.
> When you test the call buttons, the phone **dialer opens**. Do **not** press Call on 112.

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | App icon and splash screen | Jagdamba shield on dark blue | |
| 2 | First launch | Onboarding, then permission prompts | |
| 3 | Allow location | Home screen shows your area name | |
| 4 | Nearby Help | Police and hospitals near you | |
| 5 | Add a trusted contact | Contact is saved and still there after closing the app | |
| 6 | SOS (test contact only) | Countdown, then camera/mic prompt, then alert sent | |
| 7 | "Call 112" button | Dialer opens with 112 filled in (don't call) | |
| 8 | Guardian City map | 3D map loads | |
| 9 | Turn on airplane mode, then open the app | Shows "Can't reach servers" with a Call 112 button | |

**Known gaps in this phase (do not report these as bugs):** Voice SOS, notifications,
fingerprint unlock, anything with the screen locked or the app in the background, and
saving recordings to Downloads. All of these need native Android code, which comes in Phase 3.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| `npm` is not recognised | Reopen PowerShell after installing Node.js |
| Phone not listed in Android Studio | Use a data cable (not charge-only), then re-tap Allow on the phone |
| App says "Can't reach Jagdamba servers" while online | The free Render server may be asleep. Wait about 60 seconds and tap Try again. If you set `CORS_ORIGINS` on Render, add `https://localhost` to it. |
| Gradle error mentioning Java | Android Studio → Settings → Build Tools → Gradle → Gradle JDK → choose **jbr-21** |
