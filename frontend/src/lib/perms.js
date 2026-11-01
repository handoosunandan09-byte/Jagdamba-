// Remembers that the first-run permissions screen has been shown on this phone.
export const PERMS_DONE_KEY = "jagdamba_perms_done";
export const permsDone = () => { try { return localStorage.getItem(PERMS_DONE_KEY) === "1"; } catch (e) { return true; } };
export const markPermsDone = () => { try { localStorage.setItem(PERMS_DONE_KEY, "1"); } catch (e) { /* noop */ } };
