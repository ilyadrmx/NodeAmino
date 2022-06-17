import WebSocket from "ws";
import Events from "events";
import { generateSig } from "./util/utils.js";
import chalk from "chalk";

const MSG_TYPES = {
    common: 0,
    enter: 101,
    exit: 102
}
const eventType = ("message");

const wsLog = chalk.underline.bgWhite.black;
const ok = chalk.bgGreen.black;
const bad = chalk.bgRed.black;
const neutral = chalk.bgBlue.black;
const reset = chalk.reset;

/**
 * Amino WebSocket class
 */
class Socket extends Events.EventEmitter {
    /** @type {Client}    */ client;
    /** @type {string}    */ #wsUrl;
    /** @type {WebSocket} */ ws;
    /** @type {boolean}   */ #debug;

    constructor(client, debug = false) {
        super();
        this.#debug = debug;

        this.#wsUrl = "wss://ws3.narvii.com";
        this.client = client;

        let data = this.getConnectData();

        this.ws = new WebSocket(data[2], {
            headers: data[1]
        });
        this.commands = {  }
        this.setCallbacks();
    }

    getConnectData() {
        let data = this.client.deviceId + "|" + new Date().getTime().toString();
        let headers = {
            NDCDEVICEID: this.client.deviceId,
            NDCAUTH: "sid=" + this.client.sid,
            "NDC-MSG-SIG": generateSig(data)
        }
        let url = `${this.#wsUrl}/?signbody=${data.replace("|", "%7C")}`;
        
        return [data, headers, url];
    }

    setCallbacks() {
        this.ws.on("open", () => {
            if (this.#debug) {
                console.log(
                    wsLog("[WEBSOCKET]"),
                    reset(":"),
                    ok("Open/reconnect\n")
                );
            }

            setTimeout(() => {
                if (this.#debug) {
                    console.log(
                        wsLog("[WEBSOCKET]"),
                        reset(":"),
                        neutral("Regular (120 s) reconnect\n")
                    );
                }

                that.reconnect();
            }, 120000);
        });

        var that = this;
        this.ws.on("close", error => {
            if (this.#debug) {
                console.log(
                    wsLog("[WEBSOCKET]"),
                    reset(":"),
                    bad("Connection closed. Trying to reconnect\n")
                );
            }

            setTimeout(() => {
                that.reconnect();   
            }, 1000);
        });

        this.ws.on("error", error => {
            console.log(
                wsLog("[WEBSOCKET]"),
                reset(":"),
                bad(`Error: ${error.message}\n`)
            );
            process.exit(-1);
        });

        this.ws.on("message", msg => {
            let struct = JSON.parse(msg);

            switch (struct.t) {
                case (1000):
                    if (Object.values(MSG_TYPES).includes(struct.o.chatMessage.type)) {
                        if (struct.o.chatMessage.content == undefined) struct.o.chatMessage.content = "Null";
                        
                        if (struct.o.chatMessage.author == undefined) struct.o.chatMessage.author = { uid: struct.o.chatMessage.uid, nickname: "Null" }; 

                        struct.o.chatMessage.ndcId = struct.o.ndcId;
                        struct.o.chatMessage.reply = async (
                            text = null,
                            mentions = null,
                            type = 0
                        ) => {
                            let ndcId = this.client.ndcId;
                            let ndc = this.client.setCom(struct.o.ndcId, false);

                            let msg = await ndc.sendMessage(
                                text,
                                struct.o.chatMessage.threadId,
                                struct.o.chatMessage.messageId,
                                mentions, 
                                type
                            );

                            this.client.setCom(ndcId, false);
                            return msg;
                        }
                        
                        let command = struct.o.chatMessage.content.split(" ")[0];
                        if (Object.keys(this.commands).includes(command)) {
                            this.emit(command, struct.o.chatMessage);
                        }

                        this.emit("message", struct.o.chatMessage);
                    }
                    break;
            }
        }); 
    }

    reconnect() {
        this.ws.removeAllListeners();
        let data = this.getConnectData();
        this.ws = new WebSocket(data[2], {
            headers: data[1]
        });
        this.setCallbacks();
    }
}

export { Socket, eventType }

