import { createHmac, generateKeyPairSync, verify } from "node:crypto";
import { Schema } from "effect";
import type { FakeHttpRequest } from "@shivaedev/test-story/server/fakeHttpService.ts";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const PRIVATE_KEY = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
export const APP_ID = "123456";
export const APP_TOKEN = "installation-token-secret";
export const WEBHOOK_SECRET = "webhook-secret";
export const WORKFLOW_BODY = Buffer.from('{"action":"completed","workflow_run":{"id":42,"conclusion":"success"}}');
export const WorkflowDelivery = Schema.Struct({
	action: Schema.String,
	workflowRun: Schema.Struct({ conclusion: Schema.String, id: Schema.Number }),
}).pipe(Schema.encodeKeys({ workflowRun: "workflow_run" }));

const Claims = Schema.fromJsonString(Schema.Struct({ exp: Schema.Number, iat: Schema.Number, iss: Schema.String }));
const Header = Schema.fromJsonString(Schema.Struct({ alg: Schema.String, typ: Schema.String }));

export function inspectJwt(request: FakeHttpRequest, now: number) {
	const jwt = request.headers.authorization?.replace(/^Bearer /u, "") ?? "";
	const [header = "", payload = "", signature = ""] = jwt.split(".");
	const claims = Schema.decodeUnknownSync(Claims)(Buffer.from(payload, "base64url").toString());
	return {
		claims,
		header: Schema.decodeUnknownSync(Header)(Buffer.from(header, "base64url").toString()),
		now: now / 1000,
		valid: verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), keys.publicKey, Buffer.from(signature, "base64url")),
	};
}

export function webhookSignature(body = WORKFLOW_BODY) {
	return `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
}
