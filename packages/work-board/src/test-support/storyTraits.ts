import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Clock } from "effect";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { boardStory, projectFiles, responsesEnabled } from "./boardStory.ts";
import { diagnosticsDaemon, rawDiagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { inboxQuestion } from "./inboxFixture.ts";
import { REVIEW_TASK, reviewResult } from "./resultReview.ts";
import { connected, openReader } from "./storyEngine.ts";

export function anOpenQuestion() {
	return projectFiles({ "question.md": inboxQuestion, "readme.md": "# Project notes" }, "an open question offers local files or a database");
}
export function aResultAwaitingReview() {
	return projectFiles({ "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK }, "a finished result awaits review against in-review work");
}

export function aHandoffTask(source: string, file = "items/keyboard.md", enabled = true) {
	return boardStory.traits(projectFiles({ [file]: source }, "a task awaits reviewed handoff direction"), ...(enabled ? [responsesEnabled()] : []));
}

export function anUnreadableSource(file: string) {
	return boardStory.trait("project", `the project source ${file} cannot be read`, (engine) => {
		engine.notes.write(file, "# Unreadable source");
		chmodSync(join(engine.notes.root, file), 0o000);
	});
}

export function aRememberedAuthor(author: string) {
	return boardStory.trait("reader", `the reader remembers the author ${author}`, function* (engine) {
		yield* openReader(engine);
		const page = connected(engine).page;
		page.window.localStorage.setItem(`work-board:author:${page.document.documentElement.dataset.workspace ?? ""}`, author);
	});
}

export function fleetReports(items: FleetItems) {
	return boardStory.trait("project", `Fleet reports ${items.items.map((item) => `${item.workId} ${item.stage}`).join(", ")}`, function* (engine) {
		const missing = { cause: "Not configured for the story", observedAt: 0, state: "not-configured" as const };
		const daemon = yield* diagnosticsDaemon(
			() => ({ codex: missing, fleet: missing, github: missing }),
			0,
			() => items,
		);
		engine.fleetPort = daemon.port;
	});
}

export function fleetDiagnostics(read: (observedAt: number) => unknown) {
	return boardStory.trait("project", "a daemon serves the supplied diagnostics response", function* (engine) {
		const observedAt = yield* Clock.currentTimeMillis;
		const daemon = yield* rawDiagnosticsDaemon(() => read(observedAt));
		engine.fleetPort = daemon.port;
	});
}
