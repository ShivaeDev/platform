import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { passwordUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import type { Host } from "#test/native-sessions/host.ts";
import { CURRENT_PASSWORD, PASSWORD_HASH } from "#test/passwords.ts";
import { socketUpgrade } from "#test/socketUpgrade.ts";

const SHELL_EMAIL = "shell@example.test";

function signInWords(status: number, body: string) {
	if (status === HttpStatus.fromLiteral("OK")) {
		return "signed in";
	}
	return status === HttpStatus.fromLiteral("Forbidden") ? `forbidden: ${body}` : `unexpected answer ${status} ${body}`;
}

export function admissionVerbs(host: Host, tell: (line: string) => void) {
	let account: Effect.Effect<void> | undefined;
	return {
		signIn: (origin: string) =>
			Effect.gen(function* () {
				account ??= yield* Effect.cached(
					passwordUser(host.auth, { email: SHELL_EMAIL, name: "Shell", passwordHash: PASSWORD_HASH, role: "user" }).pipe(Effect.asVoid),
				);
				yield* account;
				tell(`a client at ${origin} signs in with a password through the auth route`);
				const answer = yield* Effect.promise(async () => {
					const response = await fetch(`${host.baseUrl}/api/auth/sign-in/email`, {
						body: JSON.stringify({ email: SHELL_EMAIL, password: CURRENT_PASSWORD }),
						credentials: "omit",
						headers: { "content-type": "application/json", origin },
						method: "POST",
					});
					return { body: await response.text(), credential: response.headers.get("set-auth-token"), status: response.status };
				});
				return { answer: signInWords(answer.status, answer.body), credential: answer.credential === null ? "none" : "issued" };
			}),
		socketUpgrade: (origin: string) => {
			tell(`a WebView at ${origin} opens the RPC socket for first-frame authentication`);
			return socketUpgrade(`${host.baseUrl.replace(/^http/u, "ws")}/rpc?auth=frame`, origin);
		},
	};
}
