import { expect } from "@effect/vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { ANSWER_RECORDED, waitingOwner } from "#attention.ts";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { settled } from "#host/waitOutcome.ts";
import type { Decision } from "#policy.ts";
import { statusRecord } from "#test/status.ts";

const decision: Decision = { id: "waiting", links: [], reason: "Previous question", recommendation: "Retry" };

it("pending answer application belongs to automation and is not a settled human question", () => {
	const record = { ...statusRecord("one", "needs-human"), blocker: ANSWER_RECORDED, decision };
	expect(waitingOwner(record)).toBe("automation");
	expect(settled("one", record)).toBeUndefined();
	expect(renderStatus(views([record]))).toContain(ANSWER_RECORDED);
});

it("status and watch show an application failure ahead of the previous question", () => {
	const record = {
		...statusRecord("one", "needs-human"),
		blocker: "Provider unavailable while applying the answer",
		decision,
	};
	expect(settled("one", record)?.summary).toContain(record.blocker);
	expect(renderStatus(views([record]))).toContain(record.blocker);
});
