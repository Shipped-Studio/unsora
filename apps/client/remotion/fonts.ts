/**
 * Caption fonts. The menu lists Submagic's 44 fonts in its order. Each
 * font is fetched the first time it's drawn. A font uploaded by the user is
 * named "custom:<url>".
 *
 * Commercial fonts in the menu are drawn with the closest free font until
 * a licensed file is set in LICENSED_FONT_URLS:
//   Arial-Pro → Arimo
//   TheBold → Archivo Black
//   Circular → Figtree
//   Eurostile → Saira Semi Condensed
//   TTfors → Plus Jakarta Sans
//   TTNorms → Outfit
//   Komika → Luckiest Guy
//   AlmondMilky → Fredoka
//   Opinion → Oswald
//   Insolent → Bebas Neue
//   Metropolis → Montserrat
//   Chapaza → Cormorant Garamond
//   Garamond → EB Garamond
//   ItcGaramond → Cormorant Garamond
 *
 * Identical copies live in apps/client/remotion and apps/remotion/src.
 * Change both together.
 */
import { continueRender, delayRender } from "remotion";
import * as Alef from "@remotion/google-fonts/Alef";
import * as Anton from "@remotion/google-fonts/Anton";
import * as ArchivoBlack from "@remotion/google-fonts/ArchivoBlack";
import * as Arimo from "@remotion/google-fonts/Arimo";
import * as Bangers from "@remotion/google-fonts/Bangers";
import * as Barlow from "@remotion/google-fonts/Barlow";
import * as BebasNeue from "@remotion/google-fonts/BebasNeue";
import * as Bungee from "@remotion/google-fonts/Bungee";
import * as Cairo from "@remotion/google-fonts/Cairo";
import * as Caveat from "@remotion/google-fonts/Caveat";
import * as ComicNeue from "@remotion/google-fonts/ComicNeue";
import * as CormorantGaramond from "@remotion/google-fonts/CormorantGaramond";
import * as CourierPrime from "@remotion/google-fonts/CourierPrime";
import * as DMSerifDisplay from "@remotion/google-fonts/DMSerifDisplay";
import * as DancingScript from "@remotion/google-fonts/DancingScript";
import * as EBGaramond from "@remotion/google-fonts/EBGaramond";
import * as Figtree from "@remotion/google-fonts/Figtree";
import * as FiraSansCondensed from "@remotion/google-fonts/FiraSansCondensed";
import * as Fraunces from "@remotion/google-fonts/Fraunces";
import * as Fredoka from "@remotion/google-fonts/Fredoka";
import * as Gabarito from "@remotion/google-fonts/Gabarito";
import * as Geist from "@remotion/google-fonts/Geist";
import * as Heebo from "@remotion/google-fonts/Heebo";
import * as IMFellEnglish from "@remotion/google-fonts/IMFellEnglish";
import * as InstrumentSerif from "@remotion/google-fonts/InstrumentSerif";
import * as Inter from "@remotion/google-fonts/Inter";
import * as InterTight from "@remotion/google-fonts/InterTight";
import * as Lato from "@remotion/google-fonts/Lato";
import * as LilitaOne from "@remotion/google-fonts/LilitaOne";
import * as LuckiestGuy from "@remotion/google-fonts/LuckiestGuy";
import * as Michroma from "@remotion/google-fonts/Michroma";
import * as Montserrat from "@remotion/google-fonts/Montserrat";
import * as NotoSans from "@remotion/google-fonts/NotoSans";
import * as NotoSansArabic from "@remotion/google-fonts/NotoSansArabic";
import * as NotoSansHebrew from "@remotion/google-fonts/NotoSansHebrew";
import * as Nunito from "@remotion/google-fonts/Nunito";
import * as Orbitron from "@remotion/google-fonts/Orbitron";
import * as Oswald from "@remotion/google-fonts/Oswald";
import * as Outfit from "@remotion/google-fonts/Outfit";
import * as Pacifico from "@remotion/google-fonts/Pacifico";
import * as PermanentMarker from "@remotion/google-fonts/PermanentMarker";
import * as PlayfairDisplay from "@remotion/google-fonts/PlayfairDisplay";
import * as PlusJakartaSans from "@remotion/google-fonts/PlusJakartaSans";
import * as Poppins from "@remotion/google-fonts/Poppins";
import * as PressStart2P from "@remotion/google-fonts/PressStart2P";
import * as Raleway from "@remotion/google-fonts/Raleway";
import * as Righteous from "@remotion/google-fonts/Righteous";
import * as Roboto from "@remotion/google-fonts/Roboto";
import * as RougeScript from "@remotion/google-fonts/RougeScript";
import * as Rubik from "@remotion/google-fonts/Rubik";
import * as RussoOne from "@remotion/google-fonts/RussoOne";
import * as Saira from "@remotion/google-fonts/Saira";
import * as SairaSemiCondensed from "@remotion/google-fonts/SairaSemiCondensed";
import * as ShantellSans from "@remotion/google-fonts/ShantellSans";
import * as TitanOne from "@remotion/google-fonts/TitanOne";
import * as Unbounded from "@remotion/google-fonts/Unbounded";

export type FontFamily =
  | "arial-pro"
  | "nunito"
  | "poppins"
  | "montserrat"
  | "inter"
  | "roboto"
  | "raleway"
  | "the-bold"
  | "circular"
  | "eurostile"
  | "bangers"
  | "cairo"
  | "rubik"
  | "tt-fors"
  | "tt-norms"
  | "komika"
  | "almond-milky"
  | "opinion"
  | "shantell-sans"
  | "noto-sans"
  | "fira-sans-condensed"
  | "gabarito"
  | "inter-tight"
  | "dm-serif-display"
  | "anton"
  | "insolent"
  | "metropolis"
  | "im-fell"
  | "fraunces"
  | "rouge-script"
  | "dancing-script"
  | "barlow"
  | "noto-sans-hebrew"
  | "heebo"
  | "alef"
  | "noto-sans-arabic"
  | "chapaza"
  | "eb-garamond"
  | "saira"
  | "garamond"
  | "itc-garamond"
  | "playfair"
  | "geist"
  | "instrument-serif"
  | "bebas"
  | "oswald"
  | "lato"
  | "pacifico"
  | "righteous"
  | "fredoka"
  | "russo"
  | "permanent-marker"
  | "caveat"
  | "orbitron"
  | "press-start-2p"
  | "courier-prime"
  | "archivo-black"
  | "luckiest-guy"
  | "lilita-one"
  | "titan-one"
  | "bungee"
  | "cormorant-garamond"
  | "arimo"
  | "figtree"
  | "unbounded"
  | "plus-jakarta-sans"
  | "michroma"
  | "comic-neue"
  | "outfit";

interface FontModule {
  loadFont: (style?: "normal") => { fontFamily: string };
  getInfo: () => { fonts: Record<string, Record<string, unknown>> };
}

const MODULES: Record<FontFamily, FontModule> = {
  "arial-pro": Arimo,
  nunito: Nunito,
  poppins: Poppins,
  montserrat: Montserrat,
  inter: Inter,
  roboto: Roboto,
  raleway: Raleway,
  "the-bold": ArchivoBlack,
  circular: Figtree,
  eurostile: SairaSemiCondensed,
  bangers: Bangers,
  cairo: Cairo,
  rubik: Rubik,
  "tt-fors": PlusJakartaSans,
  "tt-norms": Outfit,
  komika: LuckiestGuy,
  "almond-milky": Fredoka,
  opinion: Oswald,
  "shantell-sans": ShantellSans,
  "noto-sans": NotoSans,
  "fira-sans-condensed": FiraSansCondensed,
  gabarito: Gabarito,
  "inter-tight": InterTight,
  "dm-serif-display": DMSerifDisplay,
  anton: Anton,
  insolent: BebasNeue,
  metropolis: Montserrat,
  "im-fell": IMFellEnglish,
  fraunces: Fraunces,
  "rouge-script": RougeScript,
  "dancing-script": DancingScript,
  barlow: Barlow,
  "noto-sans-hebrew": NotoSansHebrew,
  heebo: Heebo,
  alef: Alef,
  "noto-sans-arabic": NotoSansArabic,
  chapaza: CormorantGaramond,
  "eb-garamond": EBGaramond,
  saira: Saira,
  garamond: EBGaramond,
  "itc-garamond": CormorantGaramond,
  playfair: PlayfairDisplay,
  geist: Geist,
  "instrument-serif": InstrumentSerif,
  bebas: BebasNeue,
  oswald: Oswald,
  lato: Lato,
  pacifico: Pacifico,
  righteous: Righteous,
  fredoka: Fredoka,
  russo: RussoOne,
  "permanent-marker": PermanentMarker,
  caveat: Caveat,
  orbitron: Orbitron,
  "press-start-2p": PressStart2P,
  "courier-prime": CourierPrime,
  "archivo-black": ArchivoBlack,
  "luckiest-guy": LuckiestGuy,
  "lilita-one": LilitaOne,
  "titan-one": TitanOne,
  bungee: Bungee,
  "cormorant-garamond": CormorantGaramond,
  arimo: Arimo,
  figtree: Figtree,
  unbounded: Unbounded,
  "plus-jakarta-sans": PlusJakartaSans,
  michroma: Michroma,
  "comic-neue": ComicNeue,
  outfit: Outfit,
};

/** Licensed font files for the commercial fonts, by key. */
export const LICENSED_FONT_URLS: Partial<Record<FontFamily, string>> = {};

export const FONT_OPTIONS: { key: FontFamily; label: string }[] = [
  { key: "arial-pro", label: "Arial-Pro" },
  { key: "nunito", label: "Nunito" },
  { key: "poppins", label: "Poppins" },
  { key: "montserrat", label: "Montserrat" },
  { key: "inter", label: "Inter" },
  { key: "roboto", label: "Roboto" },
  { key: "raleway", label: "Raleway" },
  { key: "the-bold", label: "TheBold" },
  { key: "circular", label: "Circular" },
  { key: "eurostile", label: "Eurostile" },
  { key: "bangers", label: "Bangers" },
  { key: "cairo", label: "Cairo" },
  { key: "rubik", label: "Rubik" },
  { key: "tt-fors", label: "TTfors" },
  { key: "tt-norms", label: "TTNorms" },
  { key: "komika", label: "Komika" },
  { key: "almond-milky", label: "AlmondMilky" },
  { key: "opinion", label: "Opinion" },
  { key: "shantell-sans", label: "Shantell Sans" },
  { key: "noto-sans", label: "Noto Sans" },
  { key: "fira-sans-condensed", label: "Fira Sans Condensed" },
  { key: "gabarito", label: "Gabarito" },
  { key: "inter-tight", label: "Inter Tight" },
  { key: "dm-serif-display", label: "DM Serif Display" },
  { key: "anton", label: "Anton" },
  { key: "insolent", label: "Insolent" },
  { key: "metropolis", label: "Metropolis" },
  { key: "im-fell", label: "IMFell" },
  { key: "fraunces", label: "Fraunces" },
  { key: "rouge-script", label: "Rouge Script" },
  { key: "dancing-script", label: "Dancing Script" },
  { key: "barlow", label: "Barlow" },
  { key: "noto-sans-hebrew", label: "Noto Sans Hebrew" },
  { key: "heebo", label: "Heebo" },
  { key: "alef", label: "Alef" },
  { key: "noto-sans-arabic", label: "Noto Sans Arabic" },
  { key: "chapaza", label: "Chapaza" },
  { key: "eb-garamond", label: "EBGaramond" },
  { key: "saira", label: "Saira" },
  { key: "garamond", label: "Garamond" },
  { key: "itc-garamond", label: "ItcGaramond" },
  { key: "playfair", label: "Playfair Display" },
  { key: "geist", label: "Geist" },
  { key: "instrument-serif", label: "Instrument Serif" },
];

export const CUSTOM_FONT_PREFIX = "custom:";

const loaded = new Map<string, string>();

/** The CSS family name for a font key, starting its download if needed. */
export const getFontFamily = (font: string): string => {
  const cached = loaded.get(font);
  if (cached) return cached;
  let family = font;
  const licensed = LICENSED_FONT_URLS[font as FontFamily];
  if (font.startsWith(CUSTOM_FONT_PREFIX)) {
    family = loadFontFile(font.slice(CUSTOM_FONT_PREFIX.length));
  } else if (licensed) {
    family = loadFontFile(licensed);
  } else if (font in MODULES) {
    family = MODULES[font as FontFamily].loadFont("normal").fontFamily;
  }
  loaded.set(font, family);
  return family;
};

/** The weights a font comes in; uploaded fonts are assumed to have all. */
export function fontWeights(font: string): number[] {
  const module = MODULES[font as FontFamily];
  if (!module || LICENSED_FONT_URLS[font as FontFamily]) {
    return [100, 200, 300, 400, 500, 600, 700, 800, 900];
  }
  return Object.keys(module.getInfo().fonts.normal ?? {})
    .map(Number)
    .sort((a, b) => a - b);
}

/** A readable name for an uploaded font, from its file name. */
export function customFontLabel(font: string): string {
  const file = decodeURIComponent(font.split("/").pop() ?? "Custom font");
  return file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
}

function loadFontFile(url: string): string {
  let hash = 0;
  for (const char of url) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const family = `custom-${(hash >>> 0).toString(36)}`;
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return family;
  }
  const handle = delayRender(`Loading font ${url}`);
  new FontFace(family, `url(${JSON.stringify(url)})`)
    .load()
    .then((face) => {
      document.fonts.add(face);
    })
    .catch((error) => console.error("Couldn't load font", url, error))
    .finally(() => continueRender(handle));
  return family;
}
