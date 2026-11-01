import { expect } from "vitest";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

host.it(
	"an unreadable directory keeps Fleet's running execution and qualifies its document join until recovery",
	[boardWork({ "documents/note.md": "# Notes", "one.md": task("one", "approved") })],
	function* (daemon) {
		yield* daemon.admit();
		yield* daemon.schedule();
		const before = (yield* daemon.storedRecord("one")).value;
		expect(before.step).toBe("working");
		expect(yield* daemon.boardFleetItems()).toMatchObject({ items: [{ document: { file: "one.md" }, workId: "one" }], state: "ready" });

		yield* daemon.denyBoardDirectory("documents");
		yield* daemon.refreshBoardIndex();
		yield* daemon.schedule();

		const retained = (yield* daemon.storedRecord("one")).value;
		expect(retained.step).toBe("working");
		expect(retained.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
		expect(yield* daemon.boardFleetItems()).toMatchObject({ items: [{ document: null, workId: "one" }], state: "ready", unavailable: ["documents"] });

		yield* daemon.restoreBoardDirectory("documents");
		yield* daemon.refreshBoardIndex();

		expect(yield* daemon.boardFleetItems()).toMatchObject({ items: [{ document: { file: "one.md" }, workId: "one" }], state: "ready" });
	},
);
