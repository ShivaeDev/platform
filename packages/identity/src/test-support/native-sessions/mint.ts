import { Effect } from "effect";
import { signedInUser } from "#server/better-auth/testing.ts";
import type { Host } from "./host.ts";

export const mintSession = Effect.fn("NativeOrigins.mintSession")(function* (host: Host) {
	const login = yield* Effect.promise(() => signedInUser(host.auth, { email: "native@example.test", name: "Native", role: "user" }));
	const cookie = login.headers.get("cookie") ?? "";
	const credential = decodeURIComponent(login.cookies.find((value) => value.name.endsWith("session_token"))?.value ?? "");
	return { cookie, credential, user: login.user };
});
