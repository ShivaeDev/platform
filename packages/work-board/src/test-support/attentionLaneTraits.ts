import { utimesSync } from "node:fs";
import { join } from "node:path";
import { runArchive, standingPolicyAnswer } from "./attentionLaneActions.ts";
import { boardStory, projectFiles } from "./boardStory.ts";
import { closedInboxFixture } from "./closedInboxFixture.ts";
import { inboxAudienceFixture } from "./inboxAudienceFixture.ts";
import { managedReceiptsFixture } from "./managedReceiptsFixture.ts";
import { startProject } from "./servingEngine.ts";

// The inbox orders asks by source modification time, so each source is dated one second after the one listed before it.
export function attentionSources(files: Readonly<Record<string, string>>, line: string) {
	return boardStory.trait("project", `${line}, each file saved after the one before it: ${Object.keys(files).join(", ")}`, (engine) => {
		Object.entries(files).forEach(([path, source], index) => {
			engine.notes.write(path, source);
			utimesSync(join(engine.notes.root, path), index, index);
		});
	});
}

export function savedLast(file: string) {
	return boardStory.trait("project", `${file} was saved after every other source`, (engine) => {
		utimesSync(join(engine.notes.root, file), 100_000, 100_000);
	});
}

export function responderLabel(label: string) {
	return boardStory.traits(
		boardStory.trait("project", `the board will answer for the responder label ${label}`, (engine) => {
			engine.manualServing = true;
		}),
		boardStory.trait("reader", `the board serves the project for ${label}`, function* (engine) {
			yield* startProject(engine, { maintainer: label });
		}),
	);
}

export const standingPolicyAnswered = boardStory.trait(
	"reader",
	"the maintainer has answered the standing release policy After review through Board",
	function* (engine) {
		yield* standingPolicyAnswer(engine);
	},
);

export const archivedBeforeStartup = boardStory.trait("project", "the archive command has run before the board starts", (engine) => {
	runArchive(engine);
});

export function archivedSources(files: Readonly<Record<string, string>>) {
	return boardStory.traits(projectFiles(files, "the project has settled, open and deferred questions"), archivedBeforeStartup);
}

export function closedInboxAsks(change: (files: Record<string, string>) => void = () => undefined, omitted: readonly string[] = []) {
	const files = closedInboxFixture();
	change(files);
	return attentionSources(
		Object.fromEntries(Object.entries(files).filter(([path]) => !omitted.includes(path))),
		"Fleet asked about done, draft, dropped and deferred tasks, beside one authored question",
	);
}

export function audienceQuestions(
	files: Readonly<Record<string, string>> = {},
	line = "questions ask the maintainer, the orchestrator and nobody in particular",
) {
	return attentionSources({ ...inboxAudienceFixture(), ...files }, line);
}

export function answeredReceiptDecision(
	files: Readonly<Record<string, string>> = {},
	line = "the orchestrator answered the Fleet decision on task.context",
) {
	return attentionSources({ ...managedReceiptsFixture(), ...files }, line);
}
