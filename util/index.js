// ISO 4217, all ISO currency codes are 3 letters
const isIso4217 = (code) => {
    if (code.length !== 3) {
        return false;
    }
    alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    code = code.toLowerCase().split('');
    code.forEach(letter => {
        if (alphabet.indexOf(letter) === -1) {
            return false;
        }
    });

    return true;
};

const plural = (n) => {
    if (n == 1) {
        return '';
    }
    return 's';
};

module.exports = { isIso4217, plural };
