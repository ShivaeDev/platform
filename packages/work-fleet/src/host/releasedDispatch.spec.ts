import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"release then dispatch restarts a waiting item with an existing worker session under the same ID",
	[approvedWork(["one"])],
	function* (daemon) {
		const first = yield* daemon.approve("one");
		yield* daemon.askWorker();
		const [released] = yield* daemon.release(["one"]);
		expect(released?.value.step).toBe("released");
		const dispatched = yield* daemon.approve("one");
		expect(dispatched.value.step).toBe("working");
		expect(dispatched.value.history?.[0]?.step).toBe("released");
		expect(dispatched.value.history?.[0]?.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
		expect(dispatched.value.attempts[0]?.receipt?.sessionId).not.toBe(first.value.attempts[0]?.receipt?.sessionId);
		expect(dispatched.value.boardRevision).toBe(first.value.boardRevision);
		expect(daemon.providerLaunches()).toEqual([first.value.attempts[0]?.operationId, dispatched.value.attempts[0]?.operationId]);
		expect((yield* daemon.get("one")).step).toBe("working");
	},
);
