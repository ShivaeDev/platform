import { join } from "node:path";
import { Clock, Effect, FileSystem, Semaphore } from "effect";
import type { Handoff, HandoffInput } from "#browser/handoffs/schema.ts";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { markdownPath } from "#files/markdownPath.ts";
import { handoffFrom, handoffMarkdown, handoffPrompt, matchesHandoff } from "#handoffs/records.ts";
import { handoffSource } from "#handoffs/source.ts";
import { publish } from "#responses/publish.ts";
import { revisionOf } from "#responses/records.ts";
import type { ResponseOptions } from "#responses/service.ts";

export const handoffService = Effect.fn("WorkBoard.handoffService")(function* (options: ResponseOptions) {
	const fs = yield* FileSystem.FileSystem;
	const lock = yield* Semaphore.make(1);
	const snapshot = options.index.pipe(
		Effect.catch(() => Effect.fail(new ResponseFailed({ code: "Unavailable", message: "The workspace could not be indexed." }))),
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
			return yield* Effect.fail(
				new ResponseFailed({ code: "Conflict", message: "This handoff identity moved, is duplicated or records different direction." }),
			);
		}
		const path = yield* markdownPath(options.root, options.changes.realRoot, record.file);
		if (!path) {
			return yield* Effect.fail(new ResponseFailed({ code: "Missing", message: "The prepared handoff moved or disappeared." }));
		}
		const raw = yield* fs
			.readFileString(path)
			.pipe(Effect.catch(() => Effect.fail(new ResponseFailed({ code: "Unavailable", message: "The handoff could not be reconciled." }))));
		yield* publish(options.root, options.changes.realRoot, record.id, raw, "handoffs");
		return record;
	});

	function prepare(input: HandoffInput) {
		return lock.withPermit(
			Effect.gen(function* () {
				if (!options.enabled) {
					return yield* Effect.fail(
						new ResponseFailed({ code: "Disabled", message: "Restart with --responses to enable local response/handoff writes." }),
					);
				}
				const data = yield* snapshot;
				const existing = data.model.ids.get(input.id);
				if (existing?.length) {
					const record = existing.length === 1 ? handoffFrom(existing[0], options.changes.realRoot) : undefined;
					return yield* reconcile(record, input);
				}
				const current = yield* locate(input.item);
				if (current.reviewedRevision !== input.revision || current.source !== input.source) {
					return yield* Effect.fail(
						new ResponseFailed({ code: "Stale", message: "The source changed or moved. Keep your draft and review it again." }),
					);
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
});
