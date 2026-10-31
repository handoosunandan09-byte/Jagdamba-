// Matching for the spoken SOS phrase "Jagdamba, I need help" (or just "Bachao").
// Speech recognisers spell the name many ways ("Jagadamba", "jag damba",
// "Jagdambe", "Jagdambha"…), and people may say it in Hindi, so we look for
// the name plus a help word anywhere in what was heard.

const NAME = /jag\s*a?\s*d?\s*h?\s*amb|जगदम्ब|जगदंब/i;
const HELP = /\b(help|helpme|bachao|bachaao|bachav|madad|sos|emergency)\b|बचाओ|मदद/i;

export const normalise = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// "Bachao" is distinctive enough to start SOS on its own, without the name
const BACHAO = /\bba+cha+[ou]+\b|\bbachaav\b|\bbacha lo\b|बचाओ|बचा लो/i;
export const hasBachao = (text) => BACHAO.test(normalise(text));

export const isWakePhrase = (text) => {
  const t = normalise(text);
  return (NAME.test(t) && HELP.test(t)) || BACHAO.test(t);
};

// Just the name ("Jagdamba") — wakes the assistant orb.
export const hasName = (text) => NAME.test(normalise(text));
// A help word on its own — counts as SOS only while the orb is awake.
export const hasHelp = (text) => HELP.test(normalise(text));
// Ways to tell the orb nothing is wrong.
const DISMISS = /\b(cancel|stop|nothing|never ?mind|i\s?a?m (ok|okay|fine|safe)|all good)\b|कुछ नहीं|ठीक/i;
export const isDismiss = (text) => DISMISS.test(normalise(text));
