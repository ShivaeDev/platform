import { Effect } from "effect";
import { passwordUser, signedInUser, signInAgain } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { PASSWORD_HASH } from "#test/passwords.ts";
import type { Host } from "./host.ts";
import type { Account } from "./requests.ts";

export const mintAccounts = Effect.fnUntraced(function* (
	host: Host,
	enabled: boolean,
	accounts: Map<string, Account>,
	names: readonly string[],
	password: boolean,
) {
	for (const name of names) {
		const auth = host.auth;
		const fields = { email: `${name}@example.test`, name, role: "user" };
		const session = password
			? yield* passwordUser(auth, { ...fields, passwordHash: PASSWORD_HASH }).pipe(Effect.flatMap((user) => signInAgain(auth, user.id)))
			: yield* signedInUser(auth, { ...fields, providerAccounts: [{ accountId: `${name}-github`, providerId: "github" }] });
		const credential = decodeURIComponent(session.cookies.find((cookie) => cookie.name.endsWith("session_token"))?.value ?? "");
		accounts.set(name, {
			cookie: session.headers.get("cookie") ?? "",
			credential: enabled ? credential : null,
			token: credential.split(".")[0] ?? "",
			user: { email: session.user.email, id: session.user.id, name: session.user.name },
		});
	}
});
