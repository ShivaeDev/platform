import { Clock, Effect } from "effect";
import { type Question, ResponseFailed } from "#browser/responses/schema.ts";
import type { Snapshot } from "#search/snapshot.ts";
import type { locate as locateQuestion } from "./locate.ts";
import { publish } from "./publish.ts";
import type { readResponses } from "./read.ts";
import { questionMarkdown } from "./records.ts";
import type { ResponseOptions } from "./service.ts";

const HOURS_48 = 48 * 60 * 60 * 1000;
function reject(code: ResponseFailed["code"], message: string) {
	return Effect.fail(new ResponseFailed({ code, message }));
}
export function registerQuestion(
	options: ResponseOptions,
	snapshot: Effect.Effect<Snapshot, ResponseFailed>,
	locate: ReturnType<typeof locateQuestion>,
	read: ReturnType<typeof readResponses>,
) {
	return Effect.fn("WorkBoard.registerQuestion")(function* (input: { readonly item: string; readonly request: string; readonly revision: string }) {
		if (!options.enabled) {
			return yield* reject("Disabled", "Start with --responses to explicitly enable local question/response writes.");
		}
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
	});
}
