import { useState, useEffect, createContext, useContext } from 'react';

import frTranslations from './fr';
import arTranslations from './ar';
import enTranslations from './en';

type Language = 'fr' | 'ar' | 'en';
type Translations = typeof frTranslations;

const translations: Record<Language, Translations> = {
  fr: frTranslations,
  ar: arTranslations,
  en: enTranslations,
};

type I18nContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof Translations) => string;
  isRTL: boolean;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('fr');

  useEffect(() => {
    const isRTL = lang === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: keyof Translations): string => {
    return translations[lang][key] || translations['fr'][key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRTL: lang === 'ar' }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within an I18nProvider');
  }
  return context;
}
