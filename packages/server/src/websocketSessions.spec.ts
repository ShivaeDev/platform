import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { sessionKeys } from "#test/rpc/sessionKeys.ts";
import { type Boundary, Preferences } from "#test/rpc/sessionKeysApi.ts";

sessionKeys.it("one cookie-authenticated socket carries reads, commands and subscriptions across hosts", [], function* (test) {
	yield* test.save("alice", "First");
	const listener = yield* test.subscribe("alice");
	expect(yield* listener.next).toEqual({ _tag: "Resync" });
	expect(yield* test.read("alice")).toBe("First");
	expect(test.connections().writer).toEqual([test.rpcUrl()]);
	yield* test.save("second", "From another host");
	expect(yield* listener.next).toMatchObject({ _tag: "Changed", keys: [Preferences.item("theme"), Preferences.list] });
	expect(yield* test.read("alice")).toBe("From another host");
	expect(test.connections().writer).toEqual([test.rpcUrl()]);
});

sessionKeys.it("RPC message headers cannot replace the socket's session cookie", [], function* (test) {
	yield* test.save("alice", "Alice's preference");
	yield* test.save("bob", "Bob's preference");
	expect(yield* test.readWithCookie()).toBe("Alice's preference");
});

for (const boundary of ["account", "profile", "providers", "admin", "owner", "custom"] satisfies Boundary[]) {
	sessionKeys.it(`a revoked ${boundary} session ends its subscription without hints from another host's committed write`, [], function* (test) {
		const listener = yield* test.subscribe("alice", boundary);
		expect(yield* listener.next).toEqual({ _tag: "Resync" });
		yield* test.revoke();
		yield* test.save("second", "Private after revocation");
		expect(yield* listener.ended).toMatchObject({ _tag: "Failure", failure: { _tag: "QueryReadDenied" } });
		expect(listener.hints).toEqual([{ _tag: "Resync" }]);
		expect(yield* test.read("alice", boundary).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	});
}

sessionKeys.it("the upgrade rejects foreign origins and accepts forwarded origins only from the trusted proxy", [], function* (test) {
	expect(yield* test.upgrade({ origin: "https://attacker.example" })).toBe(HttpStatus.fromLiteral("Forbidden"));
	const forwarded = { host: "internal.example", origin: "https://app.example", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" };
	expect(yield* test.upgrade(forwarded, "127.0.0.2")).toBe(HttpStatus.fromLiteral("Forbidden"));
	expect(yield* test.upgrade(forwarded, "127.0.0.1")).toBe(HttpStatus.fromLiteral("SwitchingProtocols"));
});

sessionKeys.it("the reserved changes stream is unavailable over POST", [], function* (test) {
	yield* test.save("alice", "First");
	expect(yield* test.postSubscription()).toContain("Unknown request tag: account.$changes");
});
