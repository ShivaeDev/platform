import { expect } from "@effect/vitest";
import { reportIdentity } from "#board/reportIdentity.ts";
import { boardFileStory, withReportWork } from "#test/boardFileStory.ts";

const OBSERVATION = {
	execution: "completed",
	output: "Evidence",
	provisioning: "ready",
	receipt: { sessionId: "worker", turnId: "worker-turn" },
} as const;

for (const [problem, content, named] of [
	["malformed JSON", "broken", "payload"],
	["invalid base64", JSON.stringify({ files: [{ base64: "*", path: "evidence.txt" }], output: "Evidence" }), "evidence.txt"],
	["an unsafe name", JSON.stringify({ files: [{ base64: "", path: "../outside" }], output: "Evidence" }), "../outside"],
	[
		"duplicate names",
		JSON.stringify({ files: Array.from({ length: 2 }, () => ({ base64: "", path: "evidence.txt" })), output: "Evidence" }),
		"evidence.txt",
	],
	[
		"too many files",
		JSON.stringify({ files: Array.from({ length: 65 }, (_, index) => ({ base64: "", path: `${index}.txt` })), output: "Evidence" }),
		"payload",
	],
] as const) {
	boardFileStory.it(
		`a persisted report payload with ${problem} is unavailable and names ${named === "payload" ? "the payload file" : named}`,
		[withReportWork],
		function* ({ files }) {
			const work = yield* files.work("one");
			const { itemId } = reportIdentity(work, OBSERVATION.receipt);
			yield* files.payload(itemId, content);

			const read = yield* files.readReport(work, OBSERVATION);

			expect(read).toMatch(/^unavailable: /u);
			expect(read).toContain(named === "payload" ? `.fleet-reports/${itemId}.json` : named);
		},
	);
}
