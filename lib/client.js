import { generateDeviceId, generateSig, decodeSid } from "./util/utils.js";
import { Request } from "./util/request.js";
import { Socket } from "./socket.js";

import fetch from "node-fetch";
import chalk from "chalk";
import fs from "fs";

/**
 * Class representing Amino client
 */
class Client {
    /** @type {string} */ deviceId; 
    /** @type {string} */ sid;
    /** @type {object} */ profile;
    /** @type {object} */ account;
    /** @type {number} */ ndcId;
    /** @type {object} */ community;
    /** @type {Socket} */ ws;

    constructor(deviceId = null) {
        this.deviceId = deviceId != null ? deviceId : generateDeviceId();
        this.sid = null;

        this.http = new Request(this.deviceId);
        this.log = `*** LOG ${new Date().toLocaleString()} *** \n\n`;
    }

    /**
     * Login to Amino
     */
    login(email, password, proxy = null) {
        return this.http.call(
            "/auth/login",
            {
                email: email,
                secret: "0 " + password,
                clientType: 100,
                deviceID: this.deviceId,
                action: "normal",
                timestamp: Date.now()
            },
            "application/json",
            null,
            proxy
        ).then(response => {
            this.profile = response.userProfile;
            this.account = response.account;
            this.sid = response.sid;

            this.http = new Request(this.deviceId, this.sid);

            return this;
        });
    }

    loginSid(sid) {
        let sidInfo = decodeSid(sid);
        this.sid = sid;
        this.http = new Request(this.deviceId, this.sid);
        return this.getUserInfo(sidInfo["2"])
            .then(user => {
                this.profile = user;
                this.accont = user;
                
                return this;
            });
    }

    /**
     * Get communities
     */
    getComs(size = 100, start = 0) {
        return this.http.call(
            `/community/joined?v=1&start=${start}&size=${size}`
        ).then(response => {
            let json = response;
            return json.communityList;
        });
    }

    /**
     * Get community info
     */
    getComInfo(ndcId) {
        return this.http.call(
            `-x${ndcId}/community/info`
        ).then(response => {
            return response.community;
        });
    }

    /**
     * Get user wikis
     */
    async getUserWikis(uid, start = 0, size = 100) {
        return this.http.call(
            `/item?type=user-all&uid=${uid}&start=${start}&size=${size}&cv=1.2`
        ).then(response => {
            return response;
        });
    }

    /**
     * Get wiki info
     */
    getWikiInfo(wikiId) {
        return this.http.call(`/item/${wikiId}`)
            .then(response => {
                return response
            });
    }

    /**
     * Get link info
     */
    async getLinkInfo(link) {
        let response = await this.http.call(
            `/link-resolution?q=${link}`
        ); 
        return response.linkInfoV2;
    }

    /**
     * Get chat info
     */
    async getChatInfo(chatId) {
        return this.http.call(
            "/chat/thread/" + chatId
        ).then(response => {
            return response.thread;
        });
    }

    /**
     * Set community
     */
    setCom(ndcId, withInfo = true) {
        if (withInfo) {
            return this.getComInfo(ndcId)
                .then(response => {
                    this.community = response;
                    return this;
                });
        } else {
            let that = this;
            that.http = new Request(that.deviceId, that.sid, ndcId);
            that.ndcId = ndcId;
            return that;
        }
    }

    /**
     * Get chats
     */
    getChats(start = 0, size = 100) {
        return this.http.call(
            `/chat/thread?type=joined-me&start=${start}&size=${size}`
        ).then(response => {
            return response;
        });
    }

    /**
     * Start polling
     */
    startPolling() {
        this.ws = new Socket(this, true);
    }

    /**
     * Hide wiki
     */
    async hideWiki(wikiId, reason) {
        let data = {
            adminOpName: 110,
            adminOpValue: 9,
            adminOpNote: {
                content: reason
            }
        }

        return this.http.call(
            `/item/${wikiId}/admin`,
            data,
            "application/json"
        ).then(response => {
            return response;
        });
    }

    /**
     * Send message
     */
    sendMessage(text = null, chatId = null, replyTo = null, mentionArray = null, type = 0) {
        let data = { type: type, timestamp: Date.now() }

        if (replyTo) {
            data.replyMessageId = replyTo;
        }

        if (text) {
            data.content = text;
        }

        let mentions = [];
        if (mentionArray) {
            mentionArray.forEach(value => {
                mentions.push({ uid: value });
            });
            data.extensions = { mentionedArray: mentions };
        }

        return this.http.call(
            `/chat/thread/${chatId}/message`,
            data,
            "application/json"
        ).then(response => {
            return response;
        });
    }

    /**
     * Delete message
     */
    deleteMessage(chatId, msgId, asStaff = false, reason = null) {
        let data = {
            adminOpName: 102,
            adminOpNote: {
                content: reason
            },
            timestamp: Date.now()
        }

        if (asStaff) {
            return this.http.call(
                `/chat/thread/${chatId}/message/${msgId}/admin`,
                data,
                "application/json"
            ).then(response => {
                return response;
            });
        } else {
            return this.http.call(
                `/chat/thread/${chatId}/message/${msgId}`,
                null,
                null,
                "DELETE"
            ).then(response => {
                return response;
            });
        }
    }

    /**
     * Get user info
     */
    getUserInfo(uid) {
        return this.http.call(
            `/user-profile/${uid}`
        ).then(info => {
            return info.userProfile;
        });
    }

    /**
     * Beautiful message logs
     *
     * (comList is your communities list)
     */
    async beautifulize(msg, comList, writeLog = false) {
        // %COM_NAME% / %CHAT%
        // %USERNAME% : %CONTENT%

        let ndcId = this.ndcId;
        let ndc = this.setCom(msg.ndcId, false);
        
        let date = new Date();

        ndc.getChatInfo(msg.threadId)
            .then(async thread => {
                let chatTitle;
                let com = comList.find(x => x.ndcId == msg.ndcId);
                let comName = com?.name || "Global";
                try {
                    chatTitle = thread.title; 
                } catch {
                    chatTitle = "Null"; 
                }

                let username = msg.author.nickname;
                let content = msg.content;

                console.log(
                    `${chalk.underline.bgBlue.black(comName)} / ${chalk.bold.yellow(chatTitle)}\n${chalk.green(username) || "null"} / ${chalk.reset(content)} / ${chalk.dim(date.toLocaleString())}\n` 
                );

                this.setCom(ndcId, false);
                
                if (writeLog) this.log += `${comName} / ${chatTitle}\n${username || "null"} / ${content} / ${date.toLocaleString()}\n\n`; 
            });
    }

    async getChatMembers(chatId, start = 0, size = 25) {
        let response = await this.http.call(`/chat/thread/${chatId}/member?start=${start}&size=${size}&type=default&cv=1.2`);
        return response.memberList;
    }

    async joinChat(chatId) {
        let response = await this.http.call(
            `/chat/thread/${chatId}/member/${this.profile.uid}`,
            { timestamp: Date.now() },
            "application/json",
            "POST"
        );
        return response;
    }

    on(event, callback) {
        this.ws.on(event, callback);
    }

    command(event, callback) {
        this.ws.commands[event] = callback;
        this.ws.on(event, callback);
    }
}

export { Client }
