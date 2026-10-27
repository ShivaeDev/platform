import { Effect, SubscriptionRef } from "effect";
import { expect } from "vitest";
import { documents } from "#test/read-policy/fixture.ts";
import { readPolicyHost } from "#test/read-policy/host.ts";

readPolicyHost.it("the host checks reads inside each existing session middleware with the resolved viewer", [], function* (test) {
	for (const boundary of ["account.get", "profile.get"] as const) {
		expect(yield* test.read(boundary, "alice", "alice")).toBe("Alice's document");
		expect(yield* test.read(boundary, "bob", "alice").pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "QueryReadDenied" } });
	}
	expect(test.checks()).toEqual(["alice", "bob", "alice", "bob"].map((id) => ({ key: documents.item("alice"), viewer: { id } })));
	expect(test.lookups()).toEqual(["alice", "bob", "alice", "bob"]);
});

readPolicyHost.it("optional sessions pass their viewer or none to the same policy", [], function* (test) {
	expect(yield* test.publicRead()).toBe("Public documents");
	expect(yield* test.publicRead("alice")).toBe("Public documents");
	expect(test.checks()).toEqual([
		{ key: documents.list, viewer: undefined },
		{ key: documents.list, viewer: { id: "alice" } },
	]);
});

readPolicyHost.it("the host's live streams filter hints with that request's viewer", [], function* (test) {
	const listener = yield* test.listen("alice");
	yield* test.publish();
	expect(yield* test.heard(listener, [documents.item("alice")])).toBe(true);
	expect(yield* SubscriptionRef.get(listener.hints)).toMatchObject([{ _tag: "Resync" }, { _tag: "Changed", keys: [documents.item("alice")] }]);
});
