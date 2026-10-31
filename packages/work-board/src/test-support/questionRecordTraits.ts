import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { Deferred, Effect, Exit, Tracer } from "effect";
import { boardStory, deferredServing, projectFiles, responsesEnabled } from "./boardStory.ts";
import { outsideFolder } from "./publicationTraits.ts";
import type { Reply } from "./questionRecordReads.ts";
import { MODEL_REVIEW, OPTION_DECISION, questionRecords, registeredQuestion, type ServiceStep } from "./questionRecordState.ts";
import { startProject } from "./servingEngine.ts";
import { served } from "./storyEngine.ts";

export function aModelReview(responses = true) {
	return boardStory.traits(
		projectFiles({ "investigation.md": MODEL_REVIEW }, "investigation.model asks the maintainer to review its model"),
		...(responses ? [responsesEnabled()] : []),
	);
}

export function anOptionDecision() {
	return boardStory.traits(projectFiles({ "task.md": OPTION_DECISION }, "task.a asks the maintainer to choose an option"), responsesEnabled());
}

export function questionRegistered(item = "investigation.choices", request = "direction") {
	return boardStory.trait("reader", `the reader has registered ${item}/${request}`, function* (engine) {
		const { client } = served(engine);
		const question = yield* Effect.promise(async () => {
			const preview = await client.run(client.responses.question.run({ item, request }));
			return client.mutate(client.responses.registerQuestion.run({ item, request, revision: preview.reviewedRevision }));
		});
		questionRecords(engine).questions.push(question);
	});
}

export function replyRecorded(reply: Reply & { readonly id: string; readonly body: string }) {
	return boardStory.trait(
		"reader",
		`the maintainer has recorded ${reply.id}${reply.type ? ` as ${reply.type}` : ""}: ${reply.body}`,
		function* (engine) {
			const { client } = served(engine);
			const question = registeredQuestion(engine).id;
			yield* Effect.promise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						author: reply.author ?? "maintainer",
						body: reply.body,
						id: reply.id,
						question,
						type: reply.type ?? "answer",
						...(reply.answers ? { answers: reply.answers } : {}),
					}),
				),
			);
		},
	);
}

export function responsesFolderLinkedOutside() {
	return boardStory.trait("project", "responses/ is a link to an empty folder outside the project", function* (engine) {
		const outside = yield* outsideFolder(engine);
		symlinkSync(outside.root, join(engine.notes.root, "responses"));
	});
}

export function localServiceAnswers(steps: readonly ServiceStep[]) {
	return boardStory.trait("project", `the agent's local service answers its waits with: ${steps.join(", ")}`, (engine) => {
		questionRecords(engine).scripted = { requestedAt: [], steps };
	});
}

class WatchedSpan extends Tracer.NativeSpan {
	readonly #ended: (span: WatchedSpan) => void;
	constructor(options: ConstructorParameters<typeof Tracer.NativeSpan>[0], ended: (span: WatchedSpan) => void) {
		super(options);
		this.#ended = ended;
	}
	override end(endTime: bigint, exit: Exit.Exit<unknown, unknown>) {
		super.end(endTime, exit);
		this.#ended(this);
	}
}

// The request span ending is the board's only signal that it has let go of a request whose browser left.
export function answerRequestsTraced() {
	return boardStory.traits(
		deferredServing,
		boardStory.trait("reader", "the board starts and reports when it lets go of an answer request", function* (engine) {
			const ended = yield* Deferred.make<void>();
			questionRecords(engine).answerRequestEnded = ended;
			const tracer = Tracer.make({
				span: (options) =>
					new WatchedSpan(options, (span) => {
						if (span.name.includes("answerQuestion")) {
							Deferred.doneUnsafe(ended, Exit.void);
						}
					}),
			});
			yield* startProject(engine, { tracer });
		}),
	);
}
