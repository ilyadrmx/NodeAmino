import { generateSig } from "./utils.js";

import fetch from "node-fetch";
import os from "os";
import chalk from "chalk";
import HttpProxyAgent from "http-proxy-agent";

const capitalize = s => s && s[0].toUpperCase() + s.slice(1)

const httpLog = chalk.underline.bgWhite.black;
const ok = chalk.bgGreen.black;
const bad = chalk.bgRed.black;
const reset = chalk.reset;

/**
 * Class for making Amino requests
 */
class Request {
    /** @type {string}  */ #api;
    /** @type {string}  */ sid;
    /** @type {string}  */ deviceId;
    /** @type {number}  */ ndcId;
    /** @type {boolean} */ #debug;

    constructor(deviceId, sid = null, ndcId = null, debug = false) {
        this.#api = "https://service.narvii.com/api/v1/g/s";
        this.deviceId = deviceId;
        this.sid = sid;
        this.ndcId = ndcId;
        
        if (this.ndcId != null) {
            this.#api = "https://service.narvii.com/api/v1/x" + this.ndcId.toString() + "/s"
        }

        this.#debug = debug;
    }

    async call(url, data = null, contentType = null, method = null, proxy = null) {
        let params = { method: "GET" }
        let headers = {
            "user-agent": `${os.type()} ${capitalize(os.platform())} ${os.version()}`,
            NDCDEVICEID: this.deviceId
        }

        if (proxy != null) {
            params.agent = new HttpProxyAgent(proxy); 
        }

        if (this.sid != null) {
            headers.NDCAUTH = "sid=" + this.sid;
        }

        if (contentType != null) {
            headers["content-type"] = contentType;
        }

        if (data != null) {
            headers["NDC-MSG-SIG"] = generateSig(data);
            params.method = "POST";
            params.body = typeof data != "object" ? data : JSON.stringify(data);
        }

        params.headers = headers;
        
        if (method) {
            params.method = method;
        }

        if (this.#debug) {
            console.log(params);
        }

        let response = await fetch(this.#api + url, params);
        let json = await response.json();

        if (!response.ok) {
            if (this.#debug) {
                console.log(
                    httpLog("[HTTP]"),
                    reset(":"),
                    chalk.bold(params.method),
                    bad(response.status),
                    "\n",
                    reset(url.startsWith("/") ? this.#api + url : "/" + url),
                    "\n"
                );
            }
        }

        if (this.#debug) {
            console.log(
                httpLog("[HTTP]"),
                reset(":"),
                chalk.bold(params.method),
                ok(response.status),
                "\n",
                reset(url.startsWith("/") ? url : "/" + url),
                "\n"
            );
        }

        return await json;
    }
}

export { Request }
