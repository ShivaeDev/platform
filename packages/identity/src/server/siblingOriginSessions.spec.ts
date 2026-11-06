import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { NATIVE_ORIGIN } from "#test/native-sessions/host.ts";
import { forwardedNative, origins, proxyTrust, siblingOrigins, withoutNativeOrigins } from "#test/native-sessions/originStory.ts";

const SIBLING_ORIGIN = "https://frontend.example.com";
const traits = [withoutNativeOrigins, siblingOrigins([SIBLING_ORIGIN])];

origins.it(
	"a declared sibling's cookie reaches the RPC handler with its signed-in profile and credentialed CORS",
	traits,
	function* ({ lastCors, profile }) {
		const answer = yield* profile({ cookie: true, origin: SIBLING_ORIGIN });

		yield* outcomes([
			["profile", () => Effect.succeed(answer), "answered with the profile"],
			["cors", () => lastCors(), { allowOrigin: SIBLING_ORIGIN, credentials: "allowed", vary: "Origin" }],
		]);
	},
);

origins.it("a declared sibling reads its cookie session through auth with credentialed CORS", traits, function* ({ authSession, lastCors }) {
	const session = yield* authSession({ cookie: true, origin: SIBLING_ORIGIN });

	yield* outcomes([
		["session", () => Effect.succeed(session), "the native user"],
		["cors", () => lastCors(), { allowOrigin: SIBLING_ORIGIN, credentials: "allowed", vary: "Origin" }],
	]);
});

origins.it(
	"an undeclared sibling's cookie is refused before lookup without credentialed CORS",
	traits,
	function* ({ lastCors, profile, sessionLookups }) {
		const answer = yield* profile({ cookie: true, origin: "https://other.example.com" });

		yield* outcomes([
			["profile", () => Effect.succeed(answer), "forbidden: Local same-origin requests only"],
			["cors", () => lastCors(), { allowOrigin: "none", credentials: "not allowed" }],
			["lookups", () => sessionLookups(), 0],
		]);
	},
);

for (const path of ["/rpc", "/api/auth/get-session"]) {
	origins.it(`a declared sibling gets a credentialed preflight at ${path}`, traits, function* ({ preflight }) {
		const answer = yield* preflight(path, SIBLING_ORIGIN);

		expect(answer).toMatchObject({ allowHeaders: "Authorization,Content-Type", allowOrigin: SIBLING_ORIGIN, credentials: "allowed", status: 204 });
	});
}

origins.it(
	"a declared sibling's cookie reaches the profile handler through the trusted proxy",
	[...traits, proxyTrust("127.0.0.1"), forwardedNative()],
	function* ({ profile }) {
		const answer = yield* profile({ cookie: true, origin: SIBLING_ORIGIN });

		expect(answer).toBe("answered with the profile");
	},
);

origins.it(
	"a listed native origin keeps cookies disabled even when identity trusts it",
	[siblingOrigins([NATIVE_ORIGIN])],
	function* ({ lastCors, profile }) {
		const answer = yield* profile({ cookie: true, origin: NATIVE_ORIGIN });

		yield* outcomes([
			["profile", () => Effect.succeed(answer), "failed with unauthorized"],
			["cors", () => lastCors(), { allowOrigin: NATIVE_ORIGIN, credentials: "not allowed" }],
		]);
	},
);
