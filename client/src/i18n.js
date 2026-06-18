import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import te from "./locales/te.json";

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "hi", "te"],
    nonExplicitSupportedLngs: true, // "en-US" -> "en"
    load: "languageOnly",

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false, // resources are bundled & synchronous
    },

    returnEmptyString: false,
  });

// Debug: confirm init + active language
console.log("[i18n] initialized. Current language:", i18n.language);
i18n.on("languageChanged", (lng) => {
  console.log("[i18n] languageChanged ->", lng);
});

export default i18n;