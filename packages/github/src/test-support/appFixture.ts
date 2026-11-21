import { createHmac, createPrivateKey } from "node:crypto";
import { githubAppCredentials } from "@shivaedev/test-kits/github/adapters/credentials.ts";

export const credentials = githubAppCredentials();
export const { appId: APP_ID, privateKey: PRIVATE_KEY, tokenPrefix: APP_TOKEN, webhookSecret: WEBHOOK_SECRET, appJwtOf } = credentials;
export function webhookSignature(body: Uint8Array = WORKFLOW_BODY) {
	return credentials.webhookSignature(body);
}

export const PKCS1_PRIVATE_KEY = createPrivateKey(PRIVATE_KEY).export({ format: "pem", type: "pkcs1" }).toString();
export const INVALID_PRIVATE_KEY = "invalid-private-key-secret";
export const WRONG_SECRET = "wrong-webhook-secret";
export const WORKFLOW_BODY = Buffer.from('{"action":"completed","workflow_run":{"id":42,"conclusion":"success"}}');
export const EMPTY_SECRET_SIGNATURE = `sha256=${createHmac("sha256", "").update(WORKFLOW_BODY).digest("hex")}`;

export const unencodableScope = {
	repositories: Object.assign(["widgets"], {
		"toJSON": () => {
			throw new Error("repository scope cannot be encoded");
		},
	}),
};
