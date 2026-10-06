import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVitest } from "vitest/node";
import { TestSequencer } from "#ci/TestSequencer.ts";
import type { TimingSnapshot } from "#ci/timings.ts";

export async function vitestWorkspace() {
	const root = mkdtempSync(join(tmpdir(), "platform-test-sequencer-"));
	for (const file of ["heavy.test.ts", "shared.test.ts", "small.test.ts", "new.test.ts"]) {
		writeFileSync(join(root, file), "");
	}
	const vitest = await createVitest("test", {
		config: false,
		projects: [
			{ root, test: { include: ["*.test.ts"], name: "fixture:unit" } },
			{ root, test: { include: ["shared.test.ts"], name: "fixture:dom" } },
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
