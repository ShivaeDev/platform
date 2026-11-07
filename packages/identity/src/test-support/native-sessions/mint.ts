import { Effect } from "effect";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import type { Host } from "#test/native-sessions/host.ts";

export const mintSession = Effect.fn("NativeOrigins.mintSession")(function* (host: Host) {
	const login = yield* signedInUser(host.auth, { email: "native@example.test", name: "Native", role: "user" });
	const cookie = login.headers.get("cookie") ?? "";
	const credential = decodeURIComponent(login.cookies.find((value) => value.name.endsWith("session_token"))?.value ?? "");
	return { cookie, credential, user: login.user };
});
