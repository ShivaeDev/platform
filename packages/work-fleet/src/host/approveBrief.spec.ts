import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"explicit dispatch approves an edited brief while its existing worker runs",
	[approvedWork(["one"], "Original criteria.")],
	function* (daemon) {
		const worker = yield* daemon.approve("one");
		const current = task("one", "approved", "Edited criteria.");
		daemon.writeBoard("one.md", current);
		const approved = yield* daemon.approve("one");
		expect(approved.value.boardContext).toBe(current);
		expect(approved.value.boardRevision).not.toBe(worker.value.boardRevision);
		expect(approved.value.prompt).toBe(current);
		expect(approved.value.attempts.map(({ briefSteers: _steers, ...attempt }) => attempt)).toEqual(worker.value.attempts);
		expect(approved.value.attempts[0]?.briefSteers).toMatchObject([{ revision: approved.value.boardRevision }]);
		expect(approved.value.history ?? []).toEqual([]);
		expect(approved.value.step).toBe("working");
		expect((yield* daemon.reconcile("one")).step).toBe("working");
		expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual([worker.value.attempts[0]?.operationId]);
		expect(daemon.providerSteers()).toEqual([
			expect.objectContaining({ prompt: expect.stringContaining(current), receipt: worker.value.attempts[0]?.receipt }),
		]);
	},
);
