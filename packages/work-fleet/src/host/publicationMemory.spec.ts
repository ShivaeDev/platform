import { expect } from "@effect/vitest";
import { controlPublication, largePublicationBoard } from "#test/controlPublication.ts";

const TASKS = 100;
// Eight leaked publication fibers exceed the three-fiber allowance.
const CYCLES = 8;
const TRANSIENT_FIBERS = 3;

controlPublication.it(
	"repeated reconciliations retain a bounded publication backlog on a large Board",
	[largePublicationBoard(TASKS)],
	function* (daemon) {
		yield* daemon.dispatch();
		yield* daemon.prepareLaunch();
		yield* daemon.blockLaunchPublication();
		const before = yield* daemon.retainedFiberCount();
		daemon.story.tell(`reconcile the running worker ${CYCLES} times while publication is held`);
		for (let cycle = 0; cycle < CYCLES; cycle += 1) {
			yield* daemon.reconcile();
		}
		const after = yield* daemon.retainedFiberCount();
		expect(after).toBeLessThanOrEqual(before + TRANSIENT_FIBERS);
		yield* daemon.question();
		yield* daemon.releasePublication();
		yield* daemon.flush();
		expect(daemon.status()).toContain("Stage: waiting");
	},
	90_000,
);
