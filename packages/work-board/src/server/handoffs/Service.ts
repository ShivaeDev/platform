import { join } from "node:path";
import { Clock, Effect, FileSystem, Path, Semaphore } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { Conflict, Forbidden, NotFound, PreconditionFailed, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/rpc-server/boundary.ts";
import type { Handoff, HandoffInput } from "#browser/handoffs/schema.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { handoffFrom, handoffMarkdown, handoffPrompt, matchesHandoff } from "#server/handoffs/records.ts";
import { handoffSource } from "#server/handoffs/source.ts";
import { publish } from "#server/responses/publish.ts";
import { revisionOf } from "#server/responses/records.ts";
import { ResponseConfig } from "#server/responses/service.ts";

export const HandoffsService = defineService({
	id: "WorkBoard/HandoffsService",
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
		const locate = handoffSource(options.root, options.changes.realRoot, snapshot, fs);
		const read = Effect.fn("WorkBoard.read")(function* (item: string) {
			const data = yield* snapshot;
			const unknown = [...data.unavailable];
			const records = data.documents.flatMap((document) => {
				const record = handoffFrom(document, options.changes.realRoot);
				if (
					(record && data.model.ids.get(record.id)?.length !== 1)
					|| (document.parsed.fields.kind === "handoff" && !record)
					|| (document.file.startsWith("handoffs/") && document.parsed.diagnostics.some((problem) => problem.field === undefined))
				) {
					unknown.push(document.file);
					return [];
				}
				return record?.handoff.item === item ? [record] : [];
			});
			return { records: records.sort((a, b) => b.handoff.preparedAt - a.handoff.preparedAt || a.id.localeCompare(b.id)), unknown };
		});
		const reconcile = Effect.fn("WorkBoard.reconcile")(function* (record: Handoff | undefined, input: HandoffInput) {
			if (!record || record.file !== `handoffs/${input.id}.md` || !matchesHandoff(record, input) || revisionOf(record.context) !== input.revision) {
				return yield* Effect.fail(new Conflict({ message: "This handoff identity moved, is duplicated or records different direction." }));
			}
			const path = yield* markdownPath(options.root, options.changes.realRoot, record.file);
			if (!path) {
				return yield* Effect.fail(new NotFound({ message: "The prepared handoff moved or disappeared." }));
			}
			const raw = yield* fs.readFileString(path).pipe(
				rpcBoundary(ServiceUnavailable, {
					message: "The handoff could not be reconciled.",
					unexpected: (message) => new ServiceUnavailable({ message }),
				}),
			);
			yield* publish(options.root, options.changes.realRoot, record.id, raw, "handoffs");
			return record;
		});

		function prepare(input: HandoffInput) {
			return lock.withPermit(
				Effect.gen(function* () {
					if (!options.enabled) {
						return yield* Effect.fail(new Forbidden({ message: "Restart with --responses to enable local response/handoff writes." }));
					}
					const data = yield* snapshot;
					const existing = data.model.ids.get(input.id);
					if (existing?.length) {
						const record = existing.length === 1 ? handoffFrom(existing[0], options.changes.realRoot) : undefined;
						return yield* reconcile(record, input);
					}
					const current = yield* locate(input.item);
					if (current.reviewedRevision !== input.revision || current.source !== input.source) {
						return yield* Effect.fail(new PreconditionFailed({ message: "The source changed or moved. Keep your draft and review it again." }));
					}
					const file = `handoffs/${input.id}.md`;
					const record: Handoff = {
						context: current.context,
						file,
						handoff: {
							constraints: input.constraints,
							goal: input.goal,
							item: input.item,
							nextAction: input.nextAction,
							preparedAt: yield* Clock.currentTimeMillis,
							recipient: input.recipient,
							reviewedRevision: input.revision,
							source: input.source,
							state: "requested",
						},
						id: input.id,
						prompt: handoffPrompt(join(options.changes.realRoot, file)),
					};
					yield* publish(
						options.root,
						options.changes.realRoot,
						record.id,
						handoffMarkdown(record.id, record.handoff, record.context),
						"handoffs",
					).pipe(Effect.ensuring(options.changes.refresh ?? Effect.void));
					return record;
				}),
			);
		}
		return { locate, prepare, read };
	},
	requires: [ResponseConfig, FileSystem.FileSystem, Path.Path],
});
export type HandoffsService = typeof HandoffsService.Identifier;
