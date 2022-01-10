const axios = require('axios').default;

//{
//	pr: String, // bech32-serialized lightning invoice
//	routes: [], // an empty array
//}
const resolvLightningAddress = async (address,amount_msat) =>{
    const [user,domain] = address.split("@");
    const lnAddressQuery = `https://${domain}/.well-known/lnurlp/${user}`;

    const lnAddressRes = (await axios.get(lnAddressQuery)).data;

    if(lnAddressRes.tag != "payRequest"){
        console.log("lnAddress invalid response");
        return false;
    }
    if(lnAddressRes.minSendable > amount_msat | lnAddressRes.maxSendable < amount_msat){
        console.log("lnAddress invalid amount");
        return false;
    }
    let res = (await axios.get(`${lnAddressRes.callback}${"?"}amount=${amount_msat}`)).data;


    return res;
};
const existLigthningAddress = async (address) => {
    const [user,domain] = address.split("@");
    const lnAddressQuery = `https://${domain}/.well-known/lnurlp/${user}`;

    try{
        const lnAddressRes = (await axios.get(lnAddressQuery)).data;
        if(lnAddressRes.tag != "payRequest"){
            console.log("invalid response");
            return false;
        }

        return true;
    }catch(error){
        console.log(`The ligthning address ${address} does not exist`);
        return false;
    }
};


module.exports = {
    resolvLightningAddress,
    existLigthningAddress
}