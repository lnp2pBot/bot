export interface ILanguage {
  name: string;
  emoji: string;
  code: string;
}

export interface ILanguages {
  [key: string]: ILanguage;
}
