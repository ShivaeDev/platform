import { Effect, SubscriptionRef } from "effect";
import { expect } from "vitest";
import { documents } from "#test/read-policy/fixture.ts";
import { readPolicyHost } from "#test/read-policy/host.ts";

readPolicyHost.it("a declared denial without identity middleware refuses the native RPC before its handler runs", [], function* (test) {
	expect(yield* test.plainRead().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "QueryReadDenied" } });
	expect(test.handledReads()).toEqual([]);
	expect(test.checks()).toEqual([{ key: documents.item("private"), viewer: undefined }]);
	expect(test.lookups()).toEqual([]);
});

readPolicyHost.it("the host checks reads inside each existing session middleware with the resolved viewer", [], function* (test) {
	for (const boundary of ["account.get", "profile.get"] as const) {
		expect(yield* test.read(boundary, "alice", "alice")).toBe("Alice's document");
		expect(yield* test.read(boundary, "bob", "alice").pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "QueryReadDenied" } });
	}
	expect(test.checks()).toEqual(["alice", "alice", "bob", "alice", "alice", "bob"].map((id) => ({ key: documents.item("alice"), viewer: { id } })));
	expect(test.lookups()).toEqual(["alice", "bob", "alice", "bob"]);
});

readPolicyHost.it("optional sessions pass their viewer or none to the same policy", [], function* (test) {
	expect(yield* test.publicRead()).toBe("Public documents");
	expect(yield* test.publicRead("alice")).toBe("Public documents");
	expect(test.checks()).toEqual([
		{ key: documents.list, viewer: undefined },
		{ key: documents.list, viewer: undefined },
		{ key: documents.list, viewer: { id: "alice" } },
		{ key: documents.list, viewer: { id: "alice" } },
	]);
});

readPolicyHost.it("the host's live streams filter hints with that request's viewer", [], function* (test) {
	const listener = yield* test.listen("alice");
	yield* test.publish();
	expect(yield* test.heard(listener, [documents.item("alice")])).toBe(true);
	expect(yield* SubscriptionRef.get(listener.hints)).toMatchObject([{ _tag: "Resync" }, { _tag: "Changed", keys: [documents.item("alice")] }]);
});

for (const revoke of ["revokeRead", "revokeSession"] as const) {
	readPolicyHost.it(
		`a per-hint ${revoke === "revokeRead" ? "read policy" : "session"} denial ends the open subscription as read denied without further hints`,
		[],
		function* (test) {
			const listener = yield* test.listen("alice");
			expect(yield* SubscriptionRef.get(listener.hints)).toEqual([{ _tag: "Resync" }]);

			yield* test[revoke]("alice");
			yield* test.publish();

			expect(yield* test.subscriptionEnd(listener)).toBe("read denied");

			yield* test.publish();

			expect(yield* SubscriptionRef.get(listener.hints)).toEqual([{ _tag: "Resync" }]);
		},
	);
}
