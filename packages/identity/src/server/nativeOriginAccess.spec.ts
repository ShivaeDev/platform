import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ANDROID_ORIGIN, NATIVE_ORIGIN } from "#test/native-sessions/host.ts";
import { forwardedNative, origins, proxyTrust, withoutNativeOrigins } from "#test/native-sessions/originStory.ts";

for (const origin of [NATIVE_ORIGIN, ANDROID_ORIGIN]) {
	origins.it(`${origin} reads the profile over RPC with its bearer and gets CORS without credentials`, [], function* ({ lastCors, profile }) {
		const answer = yield* profile({ bearer: true, origin });

		yield* outcomes({
			"answer": [Effect.succeed(answer), "answered with the profile"],
			"cors": [lastCors(), { allowOrigin: origin, credentials: "not allowed", exposed: "none", vary: "Origin" }],
		});
	});

	origins.it(
		`${origin} reads its session through auth with its bearer and may read the rotated token header`,
		[],
		function* ({ authSession, lastCors }) {
			const session = yield* authSession({ bearer: true, origin });

			yield* outcomes({
				"cors": [lastCors(), { allowOrigin: origin, credentials: "not allowed", exposed: "set-auth-token", vary: "Origin" }],
				"session": [Effect.succeed(session), "the native user"],
			});
		},
	);
}

for (const origin of ["https://attacker.example", "capacitor://localhost.evil", "https://localhost:444", "null"]) {
	origins.it(`${origin} is refused over RPC before any session lookup and gets no CORS`, [], function* ({ lastCors, profile, sessionLookups }) {
		const answer = yield* profile({ bearer: true, origin });

		yield* outcomes({
			"answer": [Effect.succeed(answer), "forbidden: Local same-origin requests only"],
			"cors": [lastCors(), { allowOrigin: "none", credentials: "not allowed", exposed: "none", vary: "none" }],
			"session lookups": [sessionLookups(), 0],
		});
	});

	origins.it(`${origin} is refused on the auth route and gets no CORS`, [], function* ({ authSession, lastCors }) {
		const session = yield* authSession({ bearer: true, origin });

		yield* outcomes({
			"cors": [lastCors(), { allowOrigin: "none", credentials: "not allowed", exposed: "none", vary: "none" }],
			"session": [Effect.succeed(session), "forbidden: Local same-origin requests only"],
		});
	});
}

for (const [path, methods, exposed] of [
	["/rpc", "POST", "none"],
	["/api/auth/sign-in/email", "GET, POST", "set-auth-token"],
] as const) {
	for (const origin of [NATIVE_ORIGIN, ANDROID_ORIGIN]) {
		origins.it(
			`${origin} gets a credential-free preflight for ${path} allowing ${methods} with authorization and content type and exposing ${exposed}`,
			[],
			function* ({ preflight }) {
				const answer = yield* preflight(path, origin);

				expect(answer).toEqual({
					allowHeaders: "Authorization,Content-Type",
					allowMethods: methods,
					allowOrigin: origin,
					credentials: "not allowed",
					exposed,
					status: 204,
					vary: "Origin",
				});
			},
		);
	}

	origins.it(`another origin's preflight for ${path} is refused before any session lookup`, [], function* ({ preflight, sessionLookups }) {
		const answer = yield* preflight(path, "https://attacker.example");

		yield* outcomes({
			"preflight": [Effect.succeed(answer), expect.objectContaining({ allowOrigin: "none", status: 403 })],
			"session lookups": [sessionLookups(), 0],
		});
	});
}

origins.it("a same-origin browser reads the profile with its cookie and gets no CORS", [], function* ({ lastCors, profile }) {
	const answer = yield* profile({ cookie: true, sameOrigin: true });

	yield* outcomes({
		"answer": [Effect.succeed(answer), "answered with the profile"],
		"cors": [lastCors(), expect.objectContaining({ allowOrigin: "none" })],
	});
});

origins.it("a native client's browser cookie does not authorize RPC", [], function* ({ profile }) {
	const answer = yield* profile({ cookie: true, origin: NATIVE_ORIGIN });

	expect(answer).toBe("failed with unauthorized");
});

origins.it("a native client's browser cookie does not open a session on the auth route", [], function* ({ authSession }) {
	const session = yield* authSession({ cookie: true, origin: NATIVE_ORIGIN });

	expect(session).toBe("no session");
});

origins.it("a native client's bearer authorizes RPC beside a browser cookie", [], function* ({ profile }) {
	const answer = yield* profile({ bearer: true, cookie: true, origin: NATIVE_ORIGIN });

	expect(answer).toBe("answered with the profile");
});

origins.it("a native client's bearer opens its auth session beside a browser cookie", [], function* ({ authSession }) {
	const session = yield* authSession({ bearer: true, cookie: true, origin: NATIVE_ORIGIN });

	expect(session).toBe("the native user");
});

origins.it(
	"without native origins the host refuses native RPC before any session lookup",
	[withoutNativeOrigins],
	function* ({ profile, sessionLookups }) {
		const answer = yield* profile({ bearer: true, origin: NATIVE_ORIGIN });

		yield* outcomes({
			"answer": [Effect.succeed(answer), "forbidden: Local same-origin requests only"],
			"session lookups": [sessionLookups(), 0],
		});
	},
);

origins.it("without native origins the host grants no native preflight", [withoutNativeOrigins], function* ({ preflight }) {
	const answer = yield* preflight("/rpc", NATIVE_ORIGIN);

	expect(answer).toMatchObject({ allowOrigin: "none" });
});

origins.it(
	"a native request forwarded by the trusted proxy reads the profile at the public authority",
	[proxyTrust("127.0.0.1"), forwardedNative()],
	function* ({ profile }) {
		const answer = yield* profile({ bearer: true, origin: NATIVE_ORIGIN });

		expect(answer).toBe("answered with the profile");
	},
);

origins.it(
	"a native request forwarded by an untrusted peer is refused before any session lookup",
	[proxyTrust("127.0.0.2"), forwardedNative()],
	function* ({ profile, sessionLookups }) {
		const answer = yield* profile({ bearer: true, origin: NATIVE_ORIGIN });

		yield* outcomes({
			"answer": [Effect.succeed(answer), "forbidden: Local same-origin requests only"],
			"session lookups": [sessionLookups(), 0],
		});
	},
);

for (const [authority, protocol] of [
	["app.example, evil.example", "https"],
	["app.example", "https, http"],
] as const) {
	origins.it(
		`a native request forwarded with host ${authority} and protocol ${protocol} is refused before any session lookup`,
		[proxyTrust("127.0.0.1"), forwardedNative(authority, protocol)],
		function* ({ profile, sessionLookups }) {
			const answer = yield* profile({ bearer: true, origin: NATIVE_ORIGIN });

			yield* outcomes({
				"answer": [Effect.succeed(answer), "forbidden: Local same-origin requests only"],
				"session lookups": [sessionLookups(), 0],
			});
		},
	);
}

origins.it("a bearer and cookie inside the RPC message do not authorize a native client", [], function* ({ profile }) {
	const answer = yield* profile({ messageCredentials: true, origin: NATIVE_ORIGIN });

	expect(answer).toBe("failed with unauthorized");
});

origins.it("a native origin inside the RPC message does not admit another origin", [], function* ({ profile }) {
	const answer = yield* profile({ bearer: true, messageOrigin: NATIVE_ORIGIN, origin: "https://attacker.example" });

	expect(answer).toBe("forbidden: Local same-origin requests only");
});

origins.it("a native RPC request that is not NDJSON is refused", [], function* ({ profile }) {
	const answer = yield* profile({ bearer: true, contentType: "text/plain", origin: NATIVE_ORIGIN });

	expect(answer).toBe("forbidden: Local same-origin requests only");
});

origins.it(
	"a native WebSocket subscription with a bearer receives each resync the host sends",
	[],
	function* ({ hostResyncs, nativeStreamOpens, nextUpdate }) {
		expect(yield* nativeStreamOpens(NATIVE_ORIGIN)).toBe("resync");

		const openStreams = yield* hostResyncs();

		yield* outcomes({
			"next update": [nextUpdate(), "resync"],
			"open streams": [Effect.succeed(openStreams), "one open stream"],
		});
	},
);

origins.it(
	"interrupting a native WebSocket subscription releases its server stream",
	[],
	function* ({ nativeStreamIsInterrupted, nativeStreamOpens, openServerStreams }) {
		yield* nativeStreamOpens(NATIVE_ORIGIN);
		expect(yield* openServerStreams()).toBe("one open stream");

		yield* nativeStreamIsInterrupted();

		expect(yield* openServerStreams()).toBe("no open streams");
	},
);
