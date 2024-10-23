const mockUpdatesResponseForCurrencies = {
    ok: true,
    result: [
        {
            time: 1726511559928,
            botToken: '123456',
            message: {
                chat_id: 1,
                text: 'Code |   Name   |\n' +
                    'AED | United Arab Emirates Dirham | 🇦🇪\n' +
                    'ANG | Netherlands Antillean Guilder | 🇧🇶\n' +
                    'AOA | Angolan Kwanza | 🇦🇴\n' +
                    'ARS | Peso argentino | 🇦🇷\n' +
                    'AUD | Australian Dollar | 🇦🇺\n' +
                    'AZN | Azerbaijani Manat | 🇦🇿\n' +
                    'BDT | Bangladeshi Taka | 🇧🇩\n' +
                    'BHD | Bahraini Dinar | 🇧🇭\n' +
                    'BIF | Burundian Franc | 🇧🇮\n' +
                    'BMD | Bermudan Dollar | 🇧🇲\n' +
                    'BOB | Boliviano | 🇧🇴\n' +
                    'BRL | Brazilian Real | 🇧🇷\n' +
                    'BWP | Botswanan Pula | 🇧🇼\n' +
                    'BYN | Belarusian Ruble | 🇧🇾\n' +
                    'CAD | Canadian Dollar | 🇨🇦\n' +
                    'CDF | Congolese Franc | 🇨🇩\n' +
                    'CHF | Swiss Franc | 🇨🇭\n' +
                    'CLP | Peso chileno | 🇨🇱\n' +
                    'CNY | Chinese Yuan | 🇨🇳\n' +
                    'COP | Peso colombiano | 🇨🇴\n' +
                    'CRC | Colón | 🇨🇷\n' +
                    'CUP | Peso cubano | 🇨🇺\n' +
                    'CZK | Czech Republic Koruna | 🇨🇿\n' +
                    'DJF | Djiboutian Franc | 🇩🇯\n' +
                    'DKK | Danish Krone | 🇩🇰\n' +
                    'DOP | Peso dominicano | 🇩🇴\n' +
                    'DZD | Algerian Dinar | 🇩🇿\n' +
                    'EGP | Egyptian Pound | 🇪🇬\n' +
                    'ETB | Ethiopian Birr | 🇪🇹\n' +
                    'EUR | Euro | 🇪🇺\n' +
                    'GBP | British Pound Sterling | 🇬🇧\n' +
                    'GEL | Georgian Lari | 🇬🇪\n' +
                    'GHS | Ghanaian Cedi | 🇬🇭\n' +
                    'GNF | Guinean Franc | 🇬🇳\n' +
                    'GTQ | Quetzal | 🇬🇹\n' +
                    'HKD | Hong Kong Dollar | 🇭🇰\n' +
                    'HNL | Lempira | 🇭🇳\n' +
                    'HUF | Hungarian Forint | 🇭🇺\n' +
                    'IDR | Indonesian Rupiah | 🇮🇩\n' +
                    'ILS | Israeli New Sheqel | 🇮🇱\n' +
                    'INR | Indian Rupee | 🇮🇳\n' +
                    'IRR | Iranian Rial | 🇮🇷\n' +
                    'IRT | Iranian Tomen | 🇮🇷\n' +
                    'JMD | Jamaican Dollar | 🇯🇲\n' +
                    'JOD | Jordanian Dinar | 🇯🇴\n' +
                    'JPY | Japanese Yen | 🇯🇵\n' +
                    'KES | Kenyan Shilling | 🇰🇪\n' +
                    'KGS | Kyrgystani Som | 🇰🇬\n' +
                    'KRW | South Korean Won | 🇰🇷\n' +
                    'KZT | Kazakhstani Tenge | 🇰🇿\n' +
                    'LBP | Lebanese Pound | 🇱🇧\n' +
                    'LKR | Sri Lankan Rupee | 🇱🇰\n' +
                    'MAD | Moroccan Dirham | 🇲🇦\n' +
                    'MGA | Malagasy Ariary | 🇲🇬\n' +
                    'MLC | Moneda Libremente Convertible | 🇨🇺\n' +
                    'MXN | Peso mexicano | 🇲🇽\n' +
                    'MWK | Malawian Kwacha | 🇲🇼\n' +
                    'MYR | Malaysian Ringgit | 🇲🇾\n' +
                    'NAD | Namibian Dollar | 🇳🇦\n' +
                    'NGN | Nigerian Naira | 🇳🇬\n' +
                    'NIO | Nicaraguan Córdoba | 🇳🇮\n' +
                    'NOK | Norwegian Krone | 🇳🇴\n' +
                    'NPR | Nepalese Rupee | 🇳🇵\n' +
                    'NZD | New Zealand Dollar | 🇳🇿\n' +
                    'PAB | Panamanian Balboa | 🇵🇦\n' +
                    'PEN | Peruvian Nuevo Sol | 🇵🇪\n' +
                    'PHP | Philippine Peso | 🇵🇭\n' +
                    'PKR | Pakistani Rupee | 🇵🇰\n' +
                    'PLN | Polish Zloty | 🇵🇱\n' +
                    'PYG | Paraguayan Guarani | 🇵🇾\n' +
                    'QAR | Qatari Rial | 🇶🇦\n' +
                    'RON | Romanian Leu | 🇷🇴\n' +
                    'RSD | Serbian Dinar | 🇷🇸\n' +
                    'RUB | руб | 🇷🇺\n' +
                    'RWF | Rwandan Franc | 🇷🇼\n' +
                    'SAR | Saudi Riyal | 🇸🇦\n' +
                    'SEK | Swedish Krona | 🇸🇪\n' +
                    'SGD | Singapore Dollar | 🇸🇬\n' +
                    'THB | Thai Baht | 🇹🇭\n' +
                    'TND | Tunisian Dinar | 🇹🇳\n' +
                    'TRY | Turkish Lira | 🇹🇷\n' +
                    'TTD | Trinidad and Tobago Dollar | 🇹🇹\n' +
                    'TWD | New Taiwan Dollar | 🇹🇼\n' +
                    'TZS | Tanzanian Shilling | 🇹🇿\n' +
                    'UAH | Ukrainian Hryvnia | 🇺🇦\n' +
                    'UGX | Ugandan Shilling | 🇺🇬\n' +
                    'USD | US Dollar | 🇺🇸\n' +
                    'USDSV | USD en El Salvador | 🇺🇸🇸🇻\n' +
                    'USDVE | USD en Bs | 🇺🇸🇻🇪\n' +
                    'USDUY | USD en Uruguay | 🇺🇸🇺🇾\n' +
                    'UYU | Peso uruguayo | 🇺🇾\n' +
                    'UZS | Uzbekistan Som | 🇺🇿\n' +
                    'VES | Bolívar | 🇻🇪\n' +
                    'VND | Vietnamese Dong | 🇻🇳\n' +
                    'XAF | CFA Franc BEAC | 🇨🇲 🇨🇫 🇹🇩 🇬🇶 🇬🇦 🇨🇬\n' +
                    'XOF | CFA Franc BCEAO | 🇧🇯 🇧🇫 🇨🇮 🇬🇼 🇲🇱 🇳🇪 🇸🇳 🇹🇬\n' +
                    'ZAR | South African Rand | 🇿🇦\n'
            },
            updateId: 2,
            messageId: 2,
            isRead: true
        }
    ]
};

export {
    mockUpdatesResponseForCurrencies,
};
