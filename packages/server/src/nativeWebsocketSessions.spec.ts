import { expect } from "vitest";
import { nativeSessions, nativeTransport, passwordAccount, signedIn } from "@shivaedev/identity/test-support/native-sessions/story.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";

const alice = nativeSessions.traits(nativeTransport, signedIn("alice"));

nativeSessions.it(
	"alice signs in with a bearer and receives live profile values through the shared headerless socket",
	[nativeTransport, passwordAccount("alice")],
	function* ({ announceProfiles, changeProfile, openNativeProfile, profileShown, signIn, socketUrls }) {
		yield* signIn("alice");
		yield* openNativeProfile("alice");
		expect(yield* profileShown("alice")).toMatchObject({ name: "alice" });
		yield* changeProfile("alice", "Alice on native");

		yield* announceProfiles();

		yield* outcomes({
			profile: [profileShown("alice", "Alice on native"), expect.objectContaining({ name: "Alice on native" })],
			sockets: [socketUrls("alice"), ["/rpc?auth=frame"]],
		});
	},
);

nativeSessions.it(
	"revoking alice's bearer closes her authenticated socket with policy violation",
	[alice],
	function* ({ openNativeProfile, profileShown, signsOut, socketClosed }) {
		yield* openNativeProfile("alice");
		expect(yield* profileShown("alice")).toMatchObject({ name: "alice" });

		yield* signsOut({ bearer: "alice" });

		expect(yield* socketClosed("alice")).toEqual({ code: 1008, reason: "Authentication required" });
	},
);

for (const kind of ["invalid", "expired", "malformed", "oversized", "header-control"] as const) {
	nativeSessions.it(
		`a ${kind} native authentication frame closes the socket with policy violation`,
		[alice],
		function* ({ rejectNativeCredential, sessionExpires }) {
			if (kind === "expired") {
				yield* sessionExpires();
			}

			expect(yield* rejectNativeCredential("alice", kind)).toEqual({ code: 1008, reason: "Authentication required" });
		},
	);
}

nativeSessions.it(
	"a native socket without an authentication frame closes when its handshake deadline passes",
	[],
	function* ({ silentNativeSocket }) {
		expect(yield* silentNativeSocket()).toEqual({ code: 1008, reason: "Authentication required" });
	},
	15_000,
);

nativeSessions.it(
	"alice's first-frame bearer cannot subscribe to bob's owner-only profile",
	[nativeTransport, signedIn("alice", "bob")],
	function* ({ openRestrictedProfile, profileShown }) {
		yield* openRestrictedProfile("alice", "alice");
		expect(yield* profileShown("alice")).toMatchObject({ name: "alice" });

		yield* openRestrictedProfile("alice", "bob");

		expect(yield* profileShown("alice")).toBe("failed with query read denied");
	},
);

nativeSessions.it(
	"expiry closes an established native socket",
	[alice],
	function* ({ openNativeProfile, profileShown, sessionExpires, socketClosed }) {
		yield* openNativeProfile("alice");
		expect(yield* profileShown("alice")).toMatchObject({ name: "alice" });

		yield* sessionExpires();

		expect(yield* socketClosed("alice")).toEqual({ code: 1008, reason: "Authentication required" });
	},
);

nativeSessions.it(
	"native resume reconciles alice's profile after an unannounced change",
	[alice],
	function* ({ changeProfile, openNativeProfile, profileShown, resumeNative }) {
		yield* openNativeProfile("alice");
		expect(yield* profileShown("alice")).toMatchObject({ name: "alice" });
		yield* changeProfile("alice", "Changed while suspended");

		yield* resumeNative("alice");

		expect(yield* profileShown("alice", "Changed while suspended")).toMatchObject({ name: "Changed while suspended" });
	},
);

nativeSessions.it(
	"an unavailable session provider closes an established native socket with an internal error",
	[alice],
	function* ({ openNativeProfile, profileShown, sessionProviderUnavailable, socketClosed }) {
		yield* openNativeProfile("alice");
		expect(yield* profileShown("alice")).toMatchObject({ name: "alice" });

		yield* sessionProviderUnavailable();

		expect(yield* socketClosed("alice")).toEqual({ code: 1011, reason: "Authentication unavailable" });
	},
);
