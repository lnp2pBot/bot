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

const parseArguments = (argsString) => {
    let args = [];
    let amount, fiatAmount, fiatCode, paymentMethod;
    // We check if we have a param between ""
    args = argsString.split('"');
    if (args.length > 1) {
      args = args.filter(el => el != '');
      args = args.filter(el => el != ' ');
      paymentMethod = args[args.length-1];
    }
    if (!!paymentMethod) {
      // We remove the paymentMethod from the string param
      argsString = argsString.replace(`"${paymentMethod}"`, '');
      args = argsString.split(' ');
      args = args.filter(el => el != '');
      if (args.length != 4) {
        return false;
      }
      [_, amount, fiatAmount, fiatCode] = args;
    } else {
      args = argsString.split(' ');
      args = args.filter(el => el != '');
      if (args.length != 5) {
        return false;
      }
      [_, amount, fiatAmount, fiatCode, paymentMethod] = args;
    }
    return { amount, fiatAmount, fiatCode, paymentMethod };
};

module.exports = { isIso4217, plural, parseArguments };
