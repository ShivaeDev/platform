import { expect } from "@effect/vitest";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("the CLI releases waiting work whose decision close-finished-decisions already closed", [approvedWork(["one"])], function* (daemon) {
	daemon.initializeRepository();
	daemon.finishTurn(yield* daemon.dispatch("one"));
	const published = (yield* daemon.reconcile("one")).decision?.published;
	if (published === undefined) {
		throw new Error("Missing guided decision");
	}
	daemon.writeBoard("one.md", "---\nid: one\nkind: task\nstatus: done\n---\n# Finished scope\n");
	expect(yield* daemon.cli(["close-finished-decisions"])).toMatchObject({ code: 0 });
	expect(board.metadataParse(daemon.readBoard(published.sourcePath)).fields.attention).toMatchObject([{ state: "closed" }]);
	expect(yield* daemon.cli(["release", "one"])).toMatchObject({ code: 0, stderr: "" });
	const released = yield* daemon.waitForRecord("one", (record) => record.step === "released");
	expect([released.decision, released.blocker]).toEqual([undefined, undefined]);
	expect(yield* daemon.cli(["release", "one"])).toEqual({ code: 0, stderr: "", stdout: "one released" });
});
