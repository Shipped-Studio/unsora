// fonts.ts
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadLato } from "@remotion/google-fonts/Lato";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadRighteous } from "@remotion/google-fonts/Righteous";
import { loadFont as loadFredoka } from "@remotion/google-fonts/Fredoka";
import { loadFont as loadRusso } from "@remotion/google-fonts/RussoOne";
import { loadFont as loadPermanentMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadDancingScript } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadOrbitron } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadPressStart2p } from "@remotion/google-fonts/PressStart2P";
import { loadFont as loadCourierPrime } from "@remotion/google-fonts/CourierPrime";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadLuckiestGuy } from "@remotion/google-fonts/LuckiestGuy";
import { loadFont as loadLilitaOne } from "@remotion/google-fonts/LilitaOne";
import { loadFont as loadTitanOne } from "@remotion/google-fonts/TitanOne";
import { loadFont as loadBungee } from "@remotion/google-fonts/Bungee";

// Type from your union
export type FontFamily =
  | "inter"
  | "poppins"
  | "montserrat"
  | "roboto"
  | "playfair"
  | "bebas"
  | "oswald"
  | "lato"
  | "pacifico"
  | "bangers"
  | "righteous"
  | "fredoka"
  | "russo"
  | "permanent-marker"
  | "caveat"
  | "dancing-script"
  | "orbitron"
  | "anton"
  | "press-start-2p"
  | "courier-prime"
  | "archivo-black"
  | "luckiest-guy"
  | "lilita-one"
  | "titan-one"
  | "bungee";

// Load each font ONCE
export const FONTS: Record<FontFamily, { fontFamily: string }> = {
  inter: loadInter("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  poppins: loadPoppins("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  montserrat: loadMontserrat("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  roboto: loadRoboto("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  playfair: loadPlayfair("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  bebas: loadBebas("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  oswald: loadOswald("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  lato: loadLato("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  pacifico: loadPacifico("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  bangers: loadBangers("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  righteous: loadRighteous("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  fredoka: loadFredoka("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  russo: loadRusso("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "permanent-marker": loadPermanentMarker("normal", {
    subsets: ["latin"],
    weights: ["400"],
    ignoreTooManyRequestsWarning: true,
  }),
  caveat: loadCaveat("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "dancing-script": loadDancingScript("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  orbitron: loadOrbitron("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  anton: loadAnton("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "press-start-2p": loadPressStart2p("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "courier-prime": loadCourierPrime("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "archivo-black": loadArchivoBlack("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "luckiest-guy": loadLuckiestGuy("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "lilita-one": loadLilitaOne("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  "titan-one": loadTitanOne("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
  bungee: loadBungee("normal", {
    ignoreTooManyRequestsWarning: true,
  }),
};

export const getFontFamily = (font: string): string => {
  const fontData = FONTS[font as FontFamily];
  if (!fontData) {
    return font;
  }
  return fontData.fontFamily;
};
