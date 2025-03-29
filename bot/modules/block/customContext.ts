import { Context } from 'telegraf';

export interface CustomContext extends Context {
  user?: {
    id: string;
    tg_id: string;
  },
  i18n?: {
    t: (key: string, params?: Record<string, unknown>) => string;
  };
}
