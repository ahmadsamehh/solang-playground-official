"use client";

import { Api } from "@stellar/stellar-sdk/rpc";
import { Nullable } from "./types/server";


export class RpcService {
    url: string;
    method: string;
    params?: object;

    constructor(url: string) {
        this.url = url
        this.method = ""
        this.params = undefined
    }

    async getTransactionByHash(hash: string): Promise<Api.GetTransactionResponse> {
        this.method = "getTransaction"
        this.params = { hash }
        const r: Api.GetTransactionResponse = await this.client()
        return r
    }

    async fundAccount(accountId: string, url: Nullable<string> = null) {
        try {
            const friendbotUrl = this.buildFriendbotUrl(url);
            if (!friendbotUrl) {
                console.error("Unable to resolve friendbot URL from RPC URL:", this.url);
                return false;
            }

            const endpoint = new URL(friendbotUrl);
            endpoint.searchParams.set("addr", accountId);

            const response = await fetch(endpoint.toString());
            if (!response.ok) {
                const body = await response.text();
                console.error("Friendbot request failed:", response.status, body);
                return false;
            }

            const result = await response.json();
            if (typeof result?.successful === "boolean") {
                return result.successful;
            }

            return true;
        } catch(e) {
            console.error('error funding account', e);
        }

        return false
    }

    async getAccount(accountId: string) {
        this.method = "getAccount"
        this.params = { accountId }
        return await this.client()
    }

    private async client() {
        let o0 = {
                jsonrpc: "2.0",
                method: this.method,
                id: 1,
            };
        let o1;
        if (this.params) {
            o1 = {...o0, params: this.params}
        }
        const body = JSON.stringify(this.params ? o1 : o0);

        const f = await fetch(this.url, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body,
        })

        if(f.ok) {
            const o = await f.json()
            console.log('result:', o) 
            return o.result
        }
        return null
    }

    private buildFriendbotUrl(explicitUrl: Nullable<string>) {
        if (explicitUrl) {
            return explicitUrl;
        }

        try {
            const rpc = new URL(this.url);
            rpc.pathname = "/friendbot";
            rpc.search = "";
            rpc.hash = "";
            return rpc.toString();
        } catch {
            if (this.url.includes("/rpc")) {
                return this.url.replace("/rpc", "/friendbot");
            }
        }

        return null;
    }
}
