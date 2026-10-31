import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { record } from "#test/storage.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it("concurrent transfers of one foreign PR hold a single backlog slot", [], function* ({ admission, concurrently, store }) {
	function transfer() {
		return store.reserveForeign("pr-one", { backlog: true, executing: false });
	}

	yield* concurrently(transfer(), transfer());

	yield* outcomes([
		["reservations", () => store.foreignReservations(), [{ areas: [], backlog: true, executing: false, owner: "pr-one" }]],
		["admission with one free slot", () => admission({ ...record("board-a"), step: "terminal" }, { maxBacklog: 2 }), "accepted"],
	]);
});
