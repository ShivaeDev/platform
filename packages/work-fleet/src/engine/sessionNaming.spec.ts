import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { sessionNaming } from "#test/sessionNaming.ts";

for (const count of [1, 1000]) {
	engine.it(
		`loads only the acknowledged work when naming a launch among ${count} records`,
		[sessionNaming(count)],
		function* ({ acknowledgeNamedSession, namingLists, namingLoads, readSessionName }) {
			yield* acknowledgeNamedSession("synthetic-worker", "synthetic-session");
			const before = namingLists();
			const previouslyLoaded = namingLoads().length;
			expect(yield* readSessionName("synthetic-worker")).toBe("synthetic-0: Readable title");
			expect(namingLists()).toBe(before);
			expect(namingLoads().slice(previouslyLoaded)).toEqual(["synthetic-0"]);
		},
	);
}

for (const state of ["missing", "ambiguous", "changed"] as const) {
	engine.it(
		`rejects a ${state} launch intent without scanning other records`,
		[sessionNaming(10)],
		function* ({ acknowledgeNamedSession, namingLists, readSessionName, changeNamingIntent }) {
			yield* acknowledgeNamedSession("synthetic-worker", "synthetic-session");
			yield* changeNamingIntent(state);
			const before = namingLists();
			expect(yield* readSessionName("synthetic-worker").pipe(Effect.flip)).toMatchObject({ reason: "persistence" });
			expect(namingLists()).toBe(before);
		},
	);
}
