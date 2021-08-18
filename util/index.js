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

module.exports = { isIso4217 };