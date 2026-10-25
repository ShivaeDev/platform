import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardDecision } from "#board/schema.ts";
import type { EngineStory } from "#test/engineState.ts";
import { answerReport } from "#test/report.ts";

export function engineReportVerbs(state: EngineStory, tell: (line: string) => void) {
	function report() {
		if (state.recovery.report === undefined) {
			throw new Error("No report publication fixture is configured");
		}
		return state.recovery.report;
	}
	return {
		answerReportDecision: (decision: BoardDecision, action: "retry" | "release") => {
			tell(`answer the report decision with ${action}`);
			return answerReport(state.root, decision, action);
		},
		attachmentCollections: () => report().collections,
		loseReportRetrieval: () => {
			tell("report attachment retrieval becomes unavailable");
			report().available = false;
		},
		readReport: (file: string) => readFileSync(join(state.root, "responses", file), "utf8"),
		reportFiles: () => readdirSync(join(state.root, "responses")).filter((file) => file.startsWith("fleet-report.") && file.endsWith(".md")),
		reportPublicationCount: () => report().publication.count(),
	};
}
