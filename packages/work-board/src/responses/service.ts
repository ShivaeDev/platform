import { Clock, Context, Effect, FileSystem, Path, Semaphore } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { type DraftInput, ResponseFailed } from "#browser/responses/schema.ts";
import type { Changes } from "#files/changes.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { awaitResponse } from "./await.ts";
import { responseHistory } from "./history.ts";
import { locate as locateQuestion } from "./locate.ts";
import { makeResponse } from "./make.ts";
import { publish } from "./publish.ts";
import { readResponses } from "./read.ts";
import { responseMarkdown } from "./records.ts";
import { registerQuestion } from "./registerQuestion.ts";
import { retryResponse } from "./retry.ts";
import { validatedInput } from "./validatedInput.ts";
import { validateSupersedes } from "./validateSupersedes.ts";

export interface ResponseOptions {
	readonly changes: Changes;
	readonly enabled: boolean;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly root: string;
}
export class ResponseConfig extends Context.Service<ResponseConfig, ResponseOptions>()("WorkBoard/ResponseConfig") {}

function reject(code: ResponseFailed["code"], message: string) {
	return Effect.fail(new ResponseFailed({ code, message }));
}
export const Responses = defineService({
	id: "WorkBoard/Responses",
	initialize: Effect.gen(function* () {
		return { fs: yield* FileSystem.FileSystem, lock: yield* Semaphore.make(1), options: yield* ResponseConfig };
	}),
	methods: ({ options, fs, lock }) => {
		const snapshot = options.index.pipe(Effect.catch(() => reject("Unavailable", "The workspace could not be indexed.")));
		const enabled = options.enabled ? Effect.void : reject("Disabled", "Start with --responses to explicitly enable local question/response writes.");
		const locate = locateQuestion(options.root, options.changes.realRoot, snapshot, fs);
		const read = readResponses(snapshot);
		const register = registerQuestion(options, snapshot, locate, read);
		function record(draft: DraftInput) {
			return lock.withPermit(
				Effect.gen(function* () {
					yield* enabled;
					const result = yield* read(draft.question);
					const input = yield* Effect.try({
						catch: (cause) => new ResponseFailed({ code: "Conflict", message: String(cause) }),
						try: () => validatedInput(draft, result.question.context, result.question.question.request, result.question.question.source),
					});
					const existing = result.responses.find((candidate) => candidate.id === input.id);
					if (existing) {
						yield* retryResponse(existing, input, snapshot, options);
						return existing;
					}
					const { question } = result;
					const current = yield* locate(question.question.item, question.question.request);
					if (current.reviewedRevision !== question.question.reviewedRevision || current.source !== question.question.source) {
						return yield* reject("Stale", "Source changed or moved. Keep the draft and review the new revision before responding.");
					}
					const data = yield* snapshot;
					yield* validateSupersedes(input, question, data);
					if (data.model.ids.has(input.id)) {
						return yield* reject("Conflict", "This response identity is already used.");
					}
					const response = makeResponse(
						input,
						question,
						result.responses.reduce((time, saved) => Math.max(time, saved.response.recordedAt + 1), yield* Clock.currentTimeMillis),
					);
					yield* publish(options.root, options.changes.realRoot, response.id, responseMarkdown(response)).pipe(
						Effect.ensuring(options.changes.refresh ?? Effect.void),
					);
					return response;
				}),
			);
		}
		function history(preview: Parameters<typeof responseHistory>[1]) {
			return Effect.flatMap(snapshot, (data) =>
				Effect.try({
					catch: (cause) => new ResponseFailed({ code: "Unavailable", message: String(cause) }),
					try: () => responseHistory(data, preview),
				}),
			);
		}
		return {
			awaitResponse: awaitResponse(read),
			history,
			locate,
			read,
			record,
			register: (input: Parameters<typeof register>[0]) => lock.withPermit(register(input)),
		};
	},
	requires: [ResponseConfig, FileSystem.FileSystem, Path.Path],
});
export type Responses = typeof Responses.Identifier;
