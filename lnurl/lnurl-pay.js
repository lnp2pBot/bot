const axios = require('axios').default;

//{
//	pr: String, // bech32-serialized lightning invoice
//	routes: [], // an empty array
//}
const resolvLigthningAddress = async ({address,amount}) =>{
    const [user,domain] = address.split("@");
    const lnAddressQuery = `https://${domain}/.well-known/lnurlp/${user}`;

    const lnAddressRes = (await axios.get(lnAddressQuery)).data;

    if(lnAddressRes.tag != "payRequest"){
        console.log("invalid response");
        return false;
    }
    if(lnAddressRes.minSendable > amount | lnAddressRes.maxSendable < amount){
        console.log("invalid amount");
        return false;
    }
    return (await axios.get(`${lnAddressRes.callback}${"?"}amount=${amount}`)).data;
};
const existLigthningAddress = async ({address}) => {
    const [user,domain] = address.split("@");
    const lnAddressQuery = `https://${domain}/.well-known/lnurlp/${user}`;

    try{
        const lnAddressRes = (await axios.get(lnAddressQuery));

        return true;
    }catch(error){
        console.log(`The ligthning address ${address} does not exist`);
        return false;
    }
};


module.exports = {
    resolvLigthningAddress,
    existLigthningAddress
}