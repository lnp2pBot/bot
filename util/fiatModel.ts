export interface IFiat {
    symbol: string;
    name: string;
    symbol_native: string;
    decimal_digits: number;
    rounding: number;
    code: string;
    emoji: string;
    name_plural: string;
    price?: boolean;
    locale?: string;
}
