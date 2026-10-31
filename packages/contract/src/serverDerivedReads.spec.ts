import { expect } from "vitest";
import { derivedReadsStory, emptyTimeline, projectedKeys, viewingTimeline } from "#test/derivedReadsStory.ts";

for (const adapter of [
	{ name: "through querySubscription", traits: [] },
	{ name: "through queryKeys", traits: [projectedKeys] },
]) {
	for (const [id, before, after] of [
		[1, ["First", "Second"], ["Changed", "Second"]],
		[2, ["First", "Second"], ["First", "Changed"]],
	] as const) {
		derivedReadsStory.it(
			`a scope-only timeline refreshes when record ${id} in a server-discovered list changes ${adapter.name}`,
			[...adapter.traits, viewingTimeline],
			function* ({ edit, shown, waitForBody }) {
				expect(yield* shown()).toEqual(before);

				yield* edit(id, "Changed");

				yield* waitForBody("Changed");
				expect(yield* shown()).toEqual(after);
			},
		);
	}

	for (const scopes of [["bob"], ["alice", "bob"]]) {
		derivedReadsStory.it(
			`alice is denied before list discovery for ${scopes.join(" and ")} ${adapter.name}`,
			adapter.traits,
			function* ({ failDiscovery, subscribe }) {
				yield* failDiscovery();

				expect(yield* subscribe(...scopes)).toBe("failed with read denied");
			},
		);
	}

	derivedReadsStory.it(
		`list discovery failures reach the subscriber as the query's declared rejection ${adapter.name}`,
		adapter.traits,
		function* ({ failDiscovery, subscribe }) {
			yield* failDiscovery();

			expect(yield* subscribe("alice")).toBe("failed with unavailable");
		},
	);
}

for (const empty of [false, true]) {
	derivedReadsStory.it(
		`the ${empty ? "empty" : "populated"} timeline includes a list created after subscribing through its shared scope key`,
		[...(empty ? [emptyTimeline] : []), viewingTimeline],
		function* ({ create, shown, waitForBody }) {
			expect(yield* shown()).toEqual(empty ? [] : ["First", "Second"]);

			yield* create("alice", 4, "New list");

			yield* waitForBody("New list");
			expect(yield* shown()).toEqual(empty ? ["New list"] : ["First", "Second", "New list"]);
		},
	);
}
