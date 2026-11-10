import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as VitestNode from "vitest/node";
import { TestSequencer } from "#ci/adapters/TestSequencer.ts";
import type { TimingSnapshot } from "#ci/timings.ts";

export async function vitestFixture() {
	const root = mkdtempSync(join(tmpdir(), "platform-test-sequencer-"));
	for (const file of ["heavy.test.ts", "shared.test.ts", "small.test.ts", "new.test.ts"]) {
		writeFileSync(join(root, file), "");
	}
	const vitest = await VitestNode.createVitest({
		config: false,
		projects: [
			{ root, test: { exclude: ["heavy.test.ts"], include: ["*.test.ts"], maxWorkers: 5, name: "fixture:unit" } },
			{ root, test: { include: ["shared.test.ts"], maxWorkers: 5, name: "fixture:dom" } },
			{ root, test: { include: ["heavy.test.ts"], maxWorkers: 1, name: "fixture:heavy", sequence: { groupOrder: 1 } } },
		],
		root,
	});
	return {
		async close() {
			await vitest.close();
			rmSync(root, { force: true, recursive: true });
		},
		sequencer: new TestSequencer(vitest),
		vitest,
		withTimings(snapshot: TimingSnapshot) {
			mkdirSync(join(root, ".ci/test-balancing"), { recursive: true });
			writeFileSync(join(root, ".ci/test-balancing/test-durations.json"), JSON.stringify(snapshot));
		},
	};
}
