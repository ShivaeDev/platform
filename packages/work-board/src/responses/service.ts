import { Clock, Context, Effect, FileSystem, Path, Semaphore } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { Conflict, Forbidden, PreconditionFailed, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/rpc-server/boundary.ts";
import type { DraftInput } from "#browser/responses/schema.ts";
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

export const Responses = defineService({
	id: "WorkBoard/Responses",
	initialize: Effect.gen(function* () {
		return { fs: yield* FileSystem.FileSystem, lock: yield* Semaphore.make(1), options: yield* ResponseConfig };
	}),
	methods: ({ options, fs, lock }) => {
		const snapshot = options.index.pipe(
			rpcBoundary(ServiceUnavailable, {
				message: "The workspace could not be indexed.",
				unexpected: (message) => new ServiceUnavailable({ message }),
			}),
		);
		const enabled = options.enabled
			? Effect.void
			: Effect.fail(new Forbidden({ message: "Start with --responses to explicitly enable local question/response writes." }));
		const locate = locateQuestion(options.root, options.changes.realRoot, snapshot, fs);
		const read = readResponses(snapshot);
		const register = registerQuestion(options, snapshot, locate, read);
		function record(draft: DraftInput) {
			return lock.withPermit(
				Effect.gen(function* () {
					yield* enabled;
					const result = yield* read(draft.question);
					const input = yield* Effect.try({
						catch: (cause) => new Conflict({ message: String(cause) }),
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
						return yield* Effect.fail(
							new PreconditionFailed({ message: "Source changed or moved. Keep the draft and review the new revision before responding." }),
						);
					}
					const data = yield* snapshot;
					yield* validateSupersedes(input, question, data);
					if (data.model.ids.has(input.id)) {
						return yield* Effect.fail(new Conflict({ message: "This response identity is already used." }));
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
					catch: (cause) => new ServiceUnavailable({ message: String(cause) }),
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
