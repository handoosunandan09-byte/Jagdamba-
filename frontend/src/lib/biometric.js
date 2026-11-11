// Fingerprint / face lock using the phone's own biometric sensor (WebAuthn
// platform authenticator). Nothing biometric ever leaves the device: the OS
// checks the finger and only tells us yes or no.
//
// This is a device lock for opening the app, not server-side sign-in.

const CRED_KEY = "jagdamba_bio_cred";
const UNLOCKED_KEY = "jagdamba_unlocked"; // sessionStorage: unlocked for this app session

const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const bioSupported = async () => {
  try {
    return !!(
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch (e) {
    return false;
  }
};

export const bioEnrolled = () => {
  try { return !!localStorage.getItem(CRED_KEY); } catch (e) { return false; }
};

export const sessionUnlocked = () => {
  try { return sessionStorage.getItem(UNLOCKED_KEY) === "1"; } catch (e) { return false; }
};
export const markSessionUnlocked = () => {
  try { sessionStorage.setItem(UNLOCKED_KEY, "1"); } catch (e) { /* noop */ }
};

// Registers this phone's fingerprint/face unlock for Jagdamba.
export async function enrollBiometric(displayName) {
  const name = displayName || "Jagdamba user";
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: "Jagdamba" },
      user: { id: rand(16), name, displayName: name },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      attestation: "none",
      timeout: 60000,
    },
  });
  if (!cred) throw new Error("Fingerprint setup was cancelled");
  localStorage.setItem(CRED_KEY, toB64(cred.rawId));
  markSessionUnlocked();
  return true;
}

// Asks the OS to check the user's fingerprint. Resolves true only when the
// sensor confirmed the user (the "user verified" flag is set).
export async function verifyBiometric() {
  const id = localStorage.getItem(CRED_KEY);
  if (!id) return false;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: "public-key", id: fromB64(id), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) return false;
  const flags = new Uint8Array(assertion.response.authenticatorData)[32];
  const verified = (flags & 0x04) !== 0;
  if (verified) markSessionUnlocked();
  return verified;
}

export const disableBiometric = () => {
  try { localStorage.removeItem(CRED_KEY); } catch (e) { /* noop */ }
};

// The SOS cancel PIN (set during onboarding) doubles as the fallback unlock.
export const savedPin = () => {
  try { return localStorage.getItem("saathi_sos_pin") || ""; } catch (e) { return ""; }
};
