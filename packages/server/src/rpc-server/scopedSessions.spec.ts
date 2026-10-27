import { Effect } from "effect";
import { expect } from "vitest";
import { invalidationKeys } from "@shivaedev/contract/keys.ts";
import { sessionKeys } from "#test/rpc/sessionKeys.ts";
import { type Boundary, Preferences } from "#test/rpc/sessionKeysApi.ts";

for (const boundary of ["account", "profile", "providers", "admin", "owner", "custom"] satisfies Boundary[]) {
	sessionKeys.it(
		`${boundary} isolates concurrent accounts and shares changes across the account's sessions`,
		[],
		function* ({ subscribe, save, read, published, accountId }) {
			const alice = yield* subscribe("alice", boundary);
			const second = yield* subscribe("second", boundary);
			const bob = yield* subscribe("bob", boundary);
			for (const feed of [alice, second, bob]) {
				expect(yield* feed.next).toEqual({ _tag: "Resync" });
			}
			yield* Effect.all([save("alice", "blue", { boundary }), save("bob", "green", { boundary })], { concurrency: "unbounded" });
			const changed = { _tag: "Changed", keys: [Preferences.item("theme"), Preferences.list] };
			expect(yield* alice.next).toEqual(changed);
			expect(yield* second.next).toEqual(changed);
			expect(yield* bob.next).toEqual(changed);
			expect(yield* read("alice", boundary)).toBe("blue");
			expect(yield* read("second", boundary)).toBe("blue");
			expect(yield* read("bob", boundary)).toBe("green");
			yield* save("alice", "purple", { boundary });
			expect(yield* second.next).toEqual(changed);
			expect(yield* alice.next).toEqual(changed);
			yield* save("bob", "barrier", { boundary, id: "other" });
			expect(yield* bob.next).toEqual({ _tag: "Changed", keys: [Preferences.list] });
			expect(bob.hints).toEqual([{ _tag: "Resync" }, changed, { _tag: "Changed", keys: [Preferences.list] }]);
			expect(published()).toEqual([
				invalidationKeys([Preferences.item("theme")], { scope: accountId("alice") }),
				invalidationKeys([Preferences.item("theme")], { scope: accountId("alice") }),
			]);
		},
	);
}

sessionKeys.it("a transaction publishes once and a rollback publishes nothing", [], function* ({ subscribe, save, read, published, accountId }) {
	const second = yield* subscribe("second");
	expect(yield* second.next).toEqual({ _tag: "Resync" });
	yield* save("alice", "committed", { announce: true });
	expect(yield* second.next).toEqual({ _tag: "Changed", keys: [Preferences.item("theme"), Preferences.list] });
	expect(published()).toEqual([invalidationKeys([Preferences.item("theme")], { scope: accountId("alice") })]);
	expect(yield* save("alice", "rolled back", { announce: true, reject: true }).pipe(Effect.result)).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "Conflict" },
	});
	expect(yield* read("second")).toBe("committed");
	yield* save("alice", "barrier", { id: "other" });
	expect(yield* second.next).toEqual({ _tag: "Changed", keys: [Preferences.list] });
	expect(second.hints).toEqual([
		{ _tag: "Resync" },
		{ _tag: "Changed", keys: [Preferences.item("theme"), Preferences.list] },
		{ _tag: "Changed", keys: [Preferences.list] },
	]);
	expect(published()).toEqual([
		invalidationKeys([Preferences.item("theme")], { scope: accountId("alice") }),
		invalidationKeys([Preferences.item("other")], { scope: accountId("alice") }),
	]);
});

sessionKeys.it("an anonymous subscription is refused", [], function* ({ anonymous }) {
	expect(yield* anonymous()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
});

sessionKeys.it("a subscription refuses physical keys and undeclared queries", [], function* ({ postSubscription }) {
	for (const payload of [
		{ keys: ["preferences"] },
		{ queries: [{ payload: {}, query: "other-owner" }] },
		{ queries: [{ payload: { keys: ["preferences"] }, query: "get" }] },
	]) {
		expect(yield* postSubscription(payload)).toContain('"Die"');
	}
});

sessionKeys.it("payload scope and owner fields cannot select another account", [], function* ({ forgeScope, save }) {
	const forged = yield* forgeScope();
	expect(yield* forged.next).toEqual({ _tag: "Resync" });
	yield* save("bob", "private");
	expect(yield* forged.next.pipe(Effect.timeoutOption("100 millis"))).toMatchObject({ _tag: "None" });
	yield* save("alice", "own");
	expect(yield* forged.next).toEqual({ _tag: "Changed", keys: [Preferences.item("theme")] });
	expect(forged.hints).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [Preferences.item("theme")] }]);
});

sessionKeys.it("a scoped change handler without request identity has no unscoped fallback", [], function* ({ unprotected }) {
	expect(yield* unprotected()).toMatchObject({ _tag: "Failure" });
});
