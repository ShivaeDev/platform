import { Clock, Effect, FileSystem, Semaphore } from "effect";
import { type DraftInput, type Question, ResponseFailed } from "#browser/responses/schema.ts";
import type { Changes } from "#files/changes.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { awaitResponse } from "./await.ts";
import { responseHistory } from "./history.ts";
import { locate as locateQuestion } from "./locate.ts";
import { makeResponse } from "./make.ts";
import { publish } from "./publish.ts";
import { readResponses } from "./read.ts";
import { questionMarkdown, responseMarkdown } from "./records.ts";
import { retryResponse } from "./retry.ts";
import { validatedInput } from "./validatedInput.ts";
import { validateSupersedes } from "./validateSupersedes.ts";

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
	return { awaitResponse: awaitResponse(read), history, locate, read, record, register };
});
