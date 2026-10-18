import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { reportIdentity } from "#board/reportIdentity.ts";
import { boardFileStory, withReportWork } from "#test/boardFileStory.ts";

const OBSERVATION = { execution: "completed", output: "Evidence", provisioning: "ready", receipt: { sessionId: "worker", turnId: "turn" } } as const;
for (const [problem, content] of [
	["malformed JSON", "broken"],
	["invalid base64", JSON.stringify({ files: [{ base64: "*", path: "evidence.txt" }], output: "Evidence" })],
	["unsafe names", JSON.stringify({ files: [{ base64: "", path: "../outside" }], output: "Evidence" })],
	["duplicate names", JSON.stringify({ files: Array.from({ length: 2 }, () => ({ base64: "", path: "evidence.txt" })), output: "Evidence" })],
	["too many files", JSON.stringify({ files: Array.from({ length: 65 }, (_, index) => ({ base64: "", path: `${index}.txt` })), output: "Evidence" })],
] as const) {
	boardFileStory.it(`refuses a persisted payload with ${problem}`, [withReportWork], function* ({ files }) {
		const work = yield* files.work("one");
		const { itemId } = reportIdentity(work, OBSERVATION.receipt);
		yield* files.payload(itemId, content);
		const error = yield* files.readReport(work, OBSERVATION).pipe(Effect.flip);
		expect(error._tag).toBe("ServiceUnavailable");
		let path = `.fleet-reports/${itemId}.json`;
		if (problem === "unsafe names") {
			path = "../outside";
		} else if (problem === "invalid base64" || problem === "duplicate names") {
			path = "evidence.txt";
		}
		expect(error.message).toContain(path);
	});
}
