import { expect } from "@effect/vitest";
import { REPORT_SOURCE } from "#test/hostReportTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

host.it(
	"an oversized report needs a human once across scheduler retries and host restart",
	[boardWork({ "research.md": REPORT_SOURCE })],
	function* (daemon) {
		const started = yield* daemon.approve("research");
		daemon.finishTurn(started.value, "界".repeat((256 * 1024) / 3));
		const first = yield* daemon.reconcile("research");
		expect(first.step).toBe("waiting");
		expect(first.attentionOwner).toBe("orchestrator");
		expect(first.decision?.attentionOwner).toBe("orchestrator");
		expect(first.decision?.reason).toContain("256 KiB context limit");
		expect(first.decisionPublished).toBe(true);
		expect(first.report).toBeUndefined();
		const files = daemon.boardFiles("responses");
		expect(files.some((file) => file.startsWith("fleet-report."))).toBe(false);
		yield* daemon.stop();
		yield* daemon.start();
		for (let pass = 0; pass < 3; pass += 1) {
			yield* daemon.schedule();
			expect(yield* daemon.get("research")).toEqual(first);
		}
		expect(daemon.boardFiles("responses")).toEqual(files);
		expect(daemon.providerLaunches()).toHaveLength(1);
	},
);
