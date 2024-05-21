const {  fuseElectron } = require("./fuse-electron")

exports.afterPack = async function afterPack(context) {
    await fuseElectron(context);
}