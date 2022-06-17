import { randomBytes, createHmac } from "crypto";

const PREFIX_HEX = Buffer.from("42", "hex");
const DEVICE_KEY = Buffer.from("02B258C63559D8804321C5D5065AF320358D366F", "hex");
const SIG_KEY = Buffer.from("F8E7A61AC3F725941E3AC7CAE2D688BE97F30B93", "hex")

/**
 * Generate Amino device ID
 */
function generateDeviceId(data = null) {
    let id = data || randomBytes(20).toString("hex");
    let mac = createHmac("sha1", DEVICE_KEY)
        .update(Buffer.from(PREFIX_HEX + id, "binary"))
        .digest("hex");

    return (PREFIX_HEX.toString("hex") + Buffer.from(id, "binary").toString("hex") + mac).toUpperCase();
}

/**
 * Generate signature for data
 */
function generateSig(data) {
    let dataToConvert = typeof data == "object" ? JSON.stringify(data) : data;
    let bufferData = typeof dataToConvert == "Buffer" ? dataToConvert : Buffer.from(dataToConvert, "utf8");

    let mac = createHmac("sha1", SIG_KEY)
        .update(bufferData)
        .digest("hex");
    
    return Buffer.from("42" + mac, "hex").toString("base64");
}

/**
 * Decode sid
 */
function decodeSid(sid) {
    let decodedB64 = Buffer.from(sid + "=" * (4 - sid.length % 4), "base64url");
    let str = decodedB64.toString("utf8");
    str = str.slice(1, str.indexOf("0}") + 2);

    return JSON.parse(str);
}

export {
    generateDeviceId,
    generateSig,
    decodeSid
}
