// Matching for the spoken SOS phrase "Jagdamba, I need help".
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

export const isWakePhrase = (text) => {
  const t = normalise(text);
  return NAME.test(t) && HELP.test(t);
};
