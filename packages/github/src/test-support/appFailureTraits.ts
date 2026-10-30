import * as HttpStatus from "effect/http/HttpStatus";
import { appGithub } from "./appGithub.ts";

export const exchangeDropped = appGithub.trait("github", "GitHub drops token-exchange connections", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "drop" }, { repeat: true });
});

export const exchangeReset = appGithub.trait("github", "GitHub resets the token response after its headers", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "reset" });
});

export const exchangeMalformed = appGithub.trait("github", "GitHub answers the token exchange with invalid token data", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "status", reply: { body: { token: "unexpected token without expiry" } } });
});

export const exchangeOversized = appGithub.trait("github", "GitHub answers the token exchange with more than 64 KiB", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "status", reply: { body: "x".repeat(65 * 1024) } });
});

export const lookupDropped = appGithub.trait("github", "GitHub drops installation-lookup connections", function* ({ server }) {
	yield* server.scriptFault("installation", { kind: "drop" }, { repeat: true });
});

export const lookupRefused = appGithub.trait("github", "GitHub refuses the installation lookup with 401", function* ({ server }) {
	yield* server.scriptFault("installation", { kind: "status", reply: { status: 401 } });
});

export function rejectsNext(target: "pull request 1" | "the archive", times: number) {
	const route = target === "pull request 1" ? "pull" : "artifactRedirect";
	return appGithub.trait(
		"github",
		`GitHub answers the next ${times === 1 ? "request" : `${times} requests`} for ${target} with 401 Bad credentials`,
		function* ({ server }) {
			for (let index = 0; index < times; index += 1) {
				yield* server.scriptFault(route, {
					kind: "status",
					reply: { body: { message: "Bad credentials" }, status: HttpStatus.fromLiteral("Unauthorized") },
				});
			}
		},
	);
}
