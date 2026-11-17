import {LanguageCode} from '../schemas/types';
import {bn} from './bn';
import {en} from './en';

const DICTIONARIES = {en, bn} as const;

export function getDictionary(lang: LanguageCode) {
  return DICTIONARIES[lang] || DICTIONARIES.en;
}
