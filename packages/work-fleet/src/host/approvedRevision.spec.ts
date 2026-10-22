import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"an authored brief edit during preparation launches the current approved brief on the next pass",
	[approvedWork(["one"], "Reviewed source.")],
	function* (daemon) {
		yield* daemon.admit();
		const first = yield* daemon.get("one");
		const edited = task("one", "approved", "Edited source.");
		daemon.writeBoard("one.md", edited);
		yield* daemon.admit();
		const result = yield* daemon.fleetDispatch("one");
		expect(result.value.boardRevision).not.toBe(first.boardRevision);
		expect(result.value.step).toBe("working");
		expect(result.value.decision).toBeUndefined();
		expect(result.value.boardContext).toBe(edited);
		expect(result.value.prompt).toBe(edited);
		expect(result.value.history ?? []).toEqual([]);
		expect(daemon.providerStarts()).toEqual([expect.objectContaining({ prompt: edited })]);
	},
);
