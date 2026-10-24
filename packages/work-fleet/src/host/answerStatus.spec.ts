import { expect } from "@effect/vitest";
import { ANSWER_RECORDED, waitingOwner } from "#attention.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { settled } from "#host/waitOutcome.ts";
import { host, storedWork } from "#test/hostStory.ts";

const decision = { id: "waiting", links: [], reason: "Previous question", recommendation: "Retry" };

host.it(
	"pending answer application belongs to automation and is not a settled human question",
	[storedWork("one", "waiting", { blocker: ANSWER_RECORDED, decision })],
	function* (daemon) {
		const record = yield* daemon.get("one");
		expect(waitingOwner(record)).toBe("automation");
		expect(settled("one", record)).toBeUndefined();
		expect(renderStatus(yield* daemon.status())).toContain(ANSWER_RECORDED);
	},
);

host.it(
	"status and watch show an application failure ahead of the previous question",
	[storedWork("one", "waiting", { blocker: "Provider unavailable while applying the answer", decision })],
	function* (daemon) {
		const record = yield* daemon.get("one");
		expect(settled("one", record)?.summary).toContain(record.blocker);
		expect(renderStatus(yield* daemon.status())).toContain(record.blocker);
	},
);
