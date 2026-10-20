/** Languages for transcribing and translating captions. */

export const TRANSCRIPTION_LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Detect automatically" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
];

/** Select items for the audio language. */
export const LANGUAGE_ITEMS = TRANSCRIPTION_LANGUAGES.map((l) => ({
  value: l.code,
  label: l.label,
}));

const FLAGS: Record<string, string> = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹", nl: "🇳🇱",
  hi: "🇮🇳", ur: "🇵🇰", ar: "🇸🇦", ru: "🇷🇺", uk: "🇺🇦", tr: "🇹🇷", pl: "🇵🇱",
  id: "🇮🇩", vi: "🇻🇳", th: "🇹🇭", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳",
};

/** Select items for translation. The value is the language's name, which the API takes. */
export const TRANSLATE_ITEMS = TRANSCRIPTION_LANGUAGES.filter((l) => l.code !== "auto").map(
  (l) => ({ value: l.label, label: `${FLAGS[l.code] ?? ""} ${l.label}`.trim() }),
);
