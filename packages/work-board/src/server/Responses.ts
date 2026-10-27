import { Clock, Effect, Fiber, FiberSet, FileSystem, Path, Schema, Semaphore } from "effect";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { Conflict, Forbidden, PreconditionFailed, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { AnswerInput, DraftInput, RecordedResponse } from "#browser/responses/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";
import { refreshWritten } from "#server/files/changes.ts";
import { awaitResponse } from "#server/responses/await.ts";
import { responseHistory } from "#server/responses/history.ts";
import { locate as locateQuestion } from "#server/responses/locate.ts";
import { makeResponse } from "#server/responses/make.ts";
import { publish } from "#server/responses/publish.ts";
import { readResponses } from "#server/responses/read.ts";
import { responseMarkdown } from "#server/responses/records.ts";
import { registerQuestion } from "#server/responses/registerQuestion.ts";
import { retryResponse } from "#server/responses/retry.ts";
import { validatedInput } from "#server/responses/validatedInput.ts";
import { validateSupersedes } from "#server/responses/validateSupersedes.ts";
import { Workspace } from "#server/workspace.ts";

function invalidResponse(cause: unknown): Conflict {
	return Schema.is(Conflict)(cause)
		? cause
		: new Conflict({ message: cause instanceof Error ? cause.message : "The response is invalid. Review the questions and try again." });
}

export const Responses = defineService({
	id: "WorkBoard/Responses",
	initialize: Effect.gen(function* () {
		const workspace = yield* Workspace;
		return {
			fs: yield* FileSystem.FileSystem,
			lock: yield* Semaphore.make(1),
			options: yield* workspace.settings(),
			saves: yield* FiberSet.make<RecordedResponse, ResponseRejection>(),
			workspace,
		};
	}),
	methods: ({ options, fs, lock, saves, workspace }) => {
		const snapshot = workspace.index().pipe(
			rpcBoundary(ServiceUnavailable, {
				message: "The workspace could not be indexed.",
				unexpected: (message) => new ServiceUnavailable({ message }),
			}),
		);
		const enabled = options.writable
			? Effect.void
			: Effect.fail(new Forbidden({ message: "Start with --responses to explicitly enable local question/response writes." }));
		const locate = locateQuestion(options.root, options.realRoot, snapshot, fs);
		const read = readResponses(snapshot);
		const register = registerQuestion(options, snapshot, locate, read);
		function record(draft: DraftInput) {
			return lock.withPermit(
				Effect.gen(function* () {
					yield* enabled;
					const result = yield* read(draft.question);
					const input = yield* Effect.try({
						catch: invalidResponse,
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
					yield* publish(options.root, options.realRoot, response.id, responseMarkdown(response)).pipe(
						Effect.ensuring(refreshWritten(options.changes, [`responses/${response.id}.md`])),
					);
					return response;
				}),
			);
		}
		function history(preview: Parameters<typeof responseHistory>[1]) {
			return Effect.flatMap(snapshot, (data) =>
				Effect.try({
					catch: (cause) =>
						Schema.is(ServiceUnavailable)(cause)
							? cause
							: new ServiceUnavailable({ message: "Response history could not be read. Check the source diagnostics and retry." }),
					try: () => responseHistory(data, preview),
				}),
			);
		}
		function answer({ item, request, revision, ...draft }: AnswerInput) {
			const save = Effect.flatMap(lock.withPermit(register({ item, request, revision })), (question) => record({ ...draft, question: question.id }));
			// A browser that closes mid-save interrupts its request; the save runs in the service scope so the question never lands without its answer.
			return Effect.flatMap(FiberSet.run(saves, save), Fiber.join);
		}
		return {
			answer,
			awaitResponse: awaitResponse(read),
			history,
			locate,
			read,
			record,
			register: (input: Parameters<typeof register>[0]) => lock.withPermit(register(input)),
		};
	},
	requires: [Workspace, FileSystem.FileSystem, Path.Path],
});
export type Responses = typeof Responses.Identifier;
