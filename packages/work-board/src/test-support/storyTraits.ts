import { Effect } from "effect";
import { expect } from "vitest";
import type { RecordedResponse } from "#browser/responses/schema.ts";
import { responseMarkdown } from "#server/responses/records.ts";
import { boardStory, projectFiles, responsesEnabled } from "./boardStory.ts";
import { enterField } from "./enterField.ts";
import { inboxFixture, inboxQuestion } from "./inboxFixture.ts";
import { waitFor } from "./live.ts";
import { REVIEW_TASK, reviewResult } from "./resultReview.ts";
import { connected } from "./storyEngine.ts";

export function recordedReplies(...replies: readonly RecordedResponse[]) {
	return projectFiles(
		Object.fromEntries(replies.map((reply, index) => [`responses/reply-${index}.md`, responseMarkdown(reply)])),
		"the project remembers replies from its authors",
	);
}

export function anOpenQuestion() {
	return projectFiles({ "question.md": inboxQuestion, "readme.md": "# Project notes" }, "an open question offers local files or a database");
}
export function anInbox() {
	return projectFiles(inboxFixture(), "the reader has questions, human work and managed requests");
}
export function aResultAwaitingReview() {
	return projectFiles({ "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK }, "a finished result awaits review against in-review work");
}

export function aHandoffTask(source: string, file = "items/keyboard.md", enabled = true) {
	return boardStory.traits(projectFiles({ [file]: source }, "a task awaits reviewed handoff direction"), responsesEnabled(enabled));
}

export function anUnreadableSource(file: string) {
	return boardStory.trait("project", `the project source ${file} cannot be read`, (engine) => {
		engine.notes.write(file, "# Unreadable source");
		chmodSync(join(engine.notes.root, file), 0o000);
	});
}

export function anAnswerForm(prefix = "response") {
	return boardStory.trait("reader", `the ${prefix} form is ready`, function* (engine) {
		yield* Effect.promise(() =>
			waitFor(() => expect(connected(engine).page.document.getElementById(`${prefix}-preview`)?.hasAttribute("disabled")).toBe(false)),
		);
	});
}

export function aRememberedAuthor(author: string) {
	return boardStory.trait("reader", `the reader remembers the author ${author}`, function* (engine) {
		const page = connected(engine).page;
		enterField(page, "author", author);
		yield* Effect.promise(() => new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve())));
	});
}

export function clipboardUnavailable() {
	return boardStory.trait("project", "clipboard access is denied", (engine) => {
		engine.beforeScripts = (window) => {
			Object.defineProperty(window.navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("Denied")) } });
		};
	});
}

import { chmodSync } from "node:fs";
import { join } from "node:path";
