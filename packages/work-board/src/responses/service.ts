import { Clock, Effect, FileSystem, Semaphore } from "effect";
import { type DraftInput, type Question, type RecordedResponse, ResponseFailed } from "#browser/responses/schema.ts";
import type { Changes } from "#files/changes.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { awaitResponse } from "./await.ts";
import { locate as locateQuestion } from "./locate.ts";
import { publish } from "./publish.ts";
import { readResponses } from "./read.ts";
import { questionMarkdown, responseMarkdown } from "./records.ts";
import { retryResponse } from "./retry.ts";

export interface ResponseOptions {
	readonly changes: Changes;
	readonly enabled: boolean;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly root: string;
}
function reject(code: ResponseFailed["code"], message: string) {
	return Effect.fail(new ResponseFailed({ code, message }));
}
const HOURS_48 = 48 * 60 * 60 * 1000;
export const responseService = Effect.fn("WorkBoard.responseService")(function* (options: ResponseOptions) {
	const fs = yield* FileSystem.FileSystem;
	const lock = yield* Semaphore.make(1);
	const snapshot = options.index.pipe(Effect.catch(() => reject("Unavailable", "The workspace could not be indexed.")));
	const enabled = options.enabled ? Effect.void : reject("Disabled", "Start with --responses to explicitly enable local question/response writes.");
	const locate = locateQuestion(options.root, options.changes.realRoot, snapshot, fs);
	const read = readResponses(snapshot);
	function register(input: { readonly item: string; readonly request: string; readonly revision: string }) {
		return lock.withPermit(
			Effect.gen(function* () {
				yield* enabled;
				const preview = yield* locate(input.item, input.request);
				if (preview.reviewedRevision !== input.revision) {
					return yield* reject("Stale", "Source changed since review. Read it again before registering this question.");
				}
				const data = yield* snapshot;
				const matches = data.model.ids.get(preview.id);
				if (matches?.length) {
					if (matches.length !== 1 || matches[0]?.file !== `responses/${preview.id}.md`) {
						return yield* reject("Conflict", "The registered identity moved or is duplicated. Read the existing record instead of retrying a write.");
					}
					const saved = (yield* read(preview.id)).question;
					yield* publish(options.root, options.changes.realRoot, saved.id, questionMarkdown(saved));
					return saved;
				}
				const now = yield* Clock.currentTimeMillis;
				const question: Question = {
					context: preview.context,
					id: preview.id,
					question: {
						deadline: now + HOURS_48,
						item: preview.item,
						reason: preview.reason,
						registeredAt: now,
						request: preview.request,
						reviewedRevision: preview.reviewedRevision,
						source: preview.source,
					},
				};
				yield* publish(options.root, options.changes.realRoot, question.id, questionMarkdown(question)).pipe(
					Effect.ensuring(options.changes.refresh ?? Effect.void),
				);
				return question;
			}),
		);
	}
	function record(input: DraftInput) {
		return lock.withPermit(
			Effect.gen(function* () {
				yield* enabled;
				const result = yield* read(input.question);
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
				if (data.model.ids.has(input.id)) {
					return yield* reject("Conflict", "This response identity is already used.");
				}
				const response: RecordedResponse = {
					body: input.body,
					id: input.id,
					response: {
						author: input.author,
						question: input.question,
						recordedAt: result.responses.reduce((time, saved) => Math.max(time, saved.response.recordedAt + 1), yield* Clock.currentTimeMillis),
						reviewedRevision: question.question.reviewedRevision,
						type: input.type,
					},
				};
				yield* publish(options.root, options.changes.realRoot, response.id, responseMarkdown(response)).pipe(
					Effect.ensuring(options.changes.refresh ?? Effect.void),
				);
				return response;
			}),
		);
	}
	return { awaitResponse: awaitResponse(read), locate, read, record, register };
});
