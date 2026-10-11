import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { CodexCloudConfig, type CodexCloudConfiguration, codexCloudLayer } from "#providers/codexCloud.ts";

export const SYNTHETIC_ENVIRONMENT = "synthetic-environment";
export const SYNTHETIC_WORKSPACE = "/workspace/synthetic";
export const FUTURE_EXPIRY = 4_102_444_800;
export const PAST_EXPIRY = 1_000_000_000;

function encode(value: unknown) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}
export function syntheticToken(name: string, exp: number) {
	return `${encode({ alg: "none" })}.${encode({ exp, name })}.signature`;
}
function authContent(token: string) {
	return JSON.stringify({ tokens: { "access_token": token, "account_id": "synthetic-account" } });
}
export const authFolder = Effect.fn("CodexCloudStory.authFolder")(function* (token: string) {
	const root = mkdtempSync(join(tmpdir(), "fleet-codex-auth-"));
	yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
	const authFile = join(root, "auth.json");
	writeFileSync(authFile, authContent(token));
	return authFile;
});
// Stands in for the Codex CLI: it answers account/read by rotating the login file, as the real CLI does.
export function refreshingCli(authFile: string, token: string) {
	const script = `
const { writeFileSync } = await import("node:fs");
const { createInterface } = await import("node:readline");
for await (const line of createInterface({ input: process.stdin })) {
	const message = JSON.parse(line);
	if (message.method === "account/read") {
		writeFileSync(process.argv[1], process.argv[2]);
		process.stdout.write(JSON.stringify({ id: message.id, result: { account: null } }) + "\\n");
	}
}`;
	return { args: ["--input-type=module", "--eval", script, authFile, authContent(token)], command: process.execPath };
}
export function cloudConfiguration(endpoint: string, authFile: string, overrides: Partial<CodexCloudConfiguration> = {}) {
	return codexCloudLayer.pipe(
		Layer.provide(
			Layer.succeed(CodexCloudConfig)({
				authFile,
				cwd: SYNTHETIC_WORKSPACE,
				endpoint,
				environmentId: SYNTHETIC_ENVIRONMENT,
				requestTimeoutMs: 5000,
				...overrides,
			}),
		),
		Layer.provide(NodeServices.layer),
	);
}
export function cloudThread(environmentId = SYNTHETIC_ENVIRONMENT, cwd = SYNTHETIC_WORKSPACE) {
	return { thread: { environments: [{ cwd, environmentConfigId: environmentId }], id: "synthetic-session" } };
}
