import { appGithub } from "./appGithub.ts";

export const exchangeDropped = appGithub.trait("github", "GitHub drops token-exchange connections", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "drop" }, { repeat: true });
});

export const exchangeReset = appGithub.trait("github", "GitHub resets the token response after its headers", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "reset" });
});

export const exchangeMalformed = appGithub.trait("github", "GitHub answers the token exchange with invalid token data", function* ({ server }) {
	yield* server.replyOnce("token", { body: { token: "unexpected token without expiry" } });
});

export const exchangeOversized = appGithub.trait("github", "GitHub answers the token exchange with more than 64 KiB", function* ({ server }) {
	yield* server.replyOnce("token", { body: "x".repeat(65 * 1024) });
});

export const lookupDropped = appGithub.trait("github", "GitHub drops installation-lookup connections", function* ({ server }) {
	yield* server.scriptFault("installation", { kind: "drop" }, { repeat: true });
});

export const lookupRefused = appGithub.trait("github", "GitHub refuses the installation lookup with 401", function* ({ server }) {
	yield* server.replyOnce("installation", { status: 401 });
});
