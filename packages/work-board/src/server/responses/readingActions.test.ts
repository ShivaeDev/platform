import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { readingActions } from "./readingActions.ts";

it.live("omits response actions for an invalid template without turning it into a reading defect", function* () {
	const source = inboxQuestion.replace("recommended: Keep local files", "recommended: Missing");
	function locate() {
		return Effect.succeed({
			context: source,
			id: "question.preview",
			item: "question.storage",
			reason: "Choose.",
			request: "answer",
			reviewedRevision: "a".repeat(64),
			source: "question.md",
		});
	}
	const actions = yield* readingActions({ file: "question.md", parsed: metadataParse(source) }, source, true, "question.storage", locate).pipe(
		Effect.provide(NodeServices.layer),
	);
	expect(actions).toEqual(new Map());
});
