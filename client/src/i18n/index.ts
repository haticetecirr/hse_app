import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { tr } from './tr';
import { en } from './en';

const saved = localStorage.getItem('lang') || 'tr';

i18n.use(initReactI18next).init({
  resources: { tr, en },
  lng: saved,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export default i18n;
