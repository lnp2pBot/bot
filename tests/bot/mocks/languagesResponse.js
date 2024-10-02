const mockUpdatesResponseForLanguages = {
    "ok": true,
    "result":
        [{
            "time": 1727274810291,
            "botToken": "123456",
            "message": {
                "chat_id": 1,
                "text": "Select language",
                "reply_markup":
                {
                    "inline_keyboard":
                        [
                            [
                                {
                                    "text": "Русский 🇷🇺",
                                    "callback_data": "setLanguage_ru"
                                },
                                {
                                    "text": "Українська 🇺🇦",
                                    "callback_data": "setLanguage_uk"
                                }
                            ],
                            [
                                { "text": "한글 🇰🇷", "callback_data": "setLanguage_ko" }, { "text": "Português 🇵🇹", "callback_data": "setLanguage_pt" }], [{ "text": "Français 🇫🇷", "callback_data": "setLanguage_fr" }, { "text": "Italiano 🇮🇹", "callback_data": "setLanguage_it" }], [{ "text": "Español 🇪🇸", "callback_data": "setLanguage_es" }, { "text": "فارسی 🇮🇷", "callback_data": "setLanguage_fa" }], [{ "text": "Deutsch 🇩🇪", "callback_data": "setLanguage_de" }, { "text": "English 🇬🇧", "callback_data": "setLanguage_en" }]]
                }
            }, "updateId": 2, "messageId": 2, "isRead": true
        }]
};

module.exports = {
    mockUpdatesResponseForLanguages,
};