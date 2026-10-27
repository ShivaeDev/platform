import { expect } from "vitest";
import { ORIGIN } from "#test/rpc/harness.ts";
import { originPolicy, sessions, signedUp } from "#test/rpc/sessionStory.ts";
import { transport } from "#test/rpc/transportStory.ts";

sessions.it(
	"client-supplied message headers cannot satisfy the origin policy or carry credentials",
	[originPolicy(), signedUp("alice")],
	function* ({ account, post, lookups }) {
		const alice = account("alice");
		const forbidden = /"_tag":"Forbidden".*"Origin not allowed"/u;
		expect(yield* post({ cookie: alice.cookie, origin: ORIGIN }, [])).toContain(alice.userId);
		expect(yield* post({ cookie: alice.cookie, origin: "https://attacker.example" }, [["origin", ORIGIN]])).toMatch(forbidden);
		expect(yield* post({ cookie: alice.cookie }, [["origin", ORIGIN]])).toMatch(forbidden);
		expect(yield* post({ cookie: alice.cookie, origin: "https://attacker.example" }, [["Origin", ORIGIN]])).toMatch(forbidden);
		const before = lookups();
		const forged = yield* post({ origin: ORIGIN }, [["cookie", alice.cookie]]);
		expect(forged).toContain('"_tag":"Unauthorized"');
		expect(forged).not.toContain(alice.userId);
		expect(lookups()).toBe(before + 1);
		expect(yield* post({ origin: ORIGIN }, [["authorization", `Bearer ${alice.cookie}`]])).toContain('"_tag":"Unauthorized"');
	},
);
transport.it("returns RPC headers when there is no HTTP request service", [], function* ({ resolveHeaders }) {
	const headers = yield* resolveHeaders({ authorization: "Bearer rpc", origin: "https://rpc.example" });
	expect(headers).toEqual({ authorization: "Bearer rpc", origin: "https://rpc.example" });
});

transport.it("uses only the HTTP request headers when a request service is available", [], function* ({ resolveHeaders }) {
	const headers = yield* resolveHeaders(
		{ authorization: "Bearer rpc", origin: "https://rpc.example", "x-rpc-only": "ignored" },
		{ origin: "https://http.example" },
	);
	expect(headers.origin).toBe("https://http.example");
	expect(headers.authorization).toBeUndefined();
	expect(headers["x-rpc-only"]).toBeUndefined();
});
