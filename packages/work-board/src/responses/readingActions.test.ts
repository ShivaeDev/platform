import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { metadataParse } from "#metadata/parse.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { readingActions } from "./readingActions.ts";
import { Responses } from "./service.ts";

it.live("omits response actions for an invalid template without turning it into a reading defect", function* () {
	const source = inboxQuestion.replace("recommended: Keep local files", "recommended: Missing");
	function unused() {
		return Effect.fail(new ServiceUnavailable({ message: "Unexpected service call" }));
	}
	const service = {
		awaitResponse: unused,
		history: unused,
		locate: () =>
			Effect.succeed({
				context: source,
				id: "question.preview",
				item: "question.storage",
				reason: "Choose.",
				request: "answer",
				reviewedRevision: "a".repeat(64),
				source: "question.md",
			}),
		read: unused,
		record: unused,
		register: unused,
	};
	const actions = yield* readingActions({ file: "question.md", parsed: metadataParse(source) }, source, true, "question.storage").pipe(
		Effect.provideService(Responses, service),
	);
	expect(actions).toEqual(new Map());
});
