import { Effect, FileSystem } from "effect";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { Document } from "#browser/document/schema.ts";
import type { Changes } from "#server/files/changes.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { readingActions } from "#server/responses/readingActions.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { documentBody } from "./body.ts";
import { readingContext } from "./readingContext.ts";
import { documentRequests } from "./requests.ts";
import { documentTargets } from "./targets.ts";

export interface DocumentOptions {
	readonly changes: Changes;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly root: string;
	readonly writable: boolean;
}

const selected = Effect.fn("WorkBoard.selected")(function* (
	url: string,
	snapshot: Snapshot,
	files: readonly MarkdownFile[],
	home: string | undefined,
) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	const requested = decodeURIComponent(pathname.slice(1));
	const item = /^_board\/item\/(?<id>[^/]+)\/$/u.exec(requested)?.groups?.id;
	if (item && snapshot.unavailable.length > 0) {
		return yield* Effect.fail(new ServiceUnavailable({ message: "Document sources are unavailable." }));
	}
	const matches = item ? snapshot.model.ids.get(item) : undefined;
	if (matches && matches.length > 1) {
		return yield* Effect.fail(new Conflict({ message: "The document identity is ambiguous." }));
	}
	const path = item ? matches?.[0]?.file : requested || home || files[0]?.path;
	const file = files.find((candidate) => candidate.path === path);
	if (!file) {
		return yield* Effect.fail(new NotFound({ message: "The document is missing." }));
	}
	return { file, item };
});

export function readDocument({ changes, home, index, root, writable }: DocumentOptions) {
	return Effect.fn("WorkBoard.document")(function* (url: string) {
		const snapshot = yield* index;
		const files = yield* changes.files;
		const { file, item } = yield* selected(url, snapshot, files, home);
		const real = yield* markdownPath(root, changes.realRoot, file.path);
		if (!real) {
			return yield* Effect.fail(new NotFound({ message: "The document is missing." }));
		}
		const fs = yield* FileSystem.FileSystem;
		const source = yield* fs.readFileString(real);
		const parsed = metadataParse(source);
		const document = { file: file.path, parsed };
		const documents = [...snapshot.documents.filter((entry) => entry.file !== file.path), document];
		const model = metadataModel(documents, snapshot.unavailable, home ?? files[0]?.path);
		const id = parsed.fields.id;
		const identity = id && snapshot.unavailable.length === 0 && model.ids.get(id)?.length === 1 ? id : undefined;
		if (item && identity !== item) {
			return yield* Effect.fail(new NotFound({ message: "The document is missing." }));
		}
		const questionActions = yield* readingActions(document, source, writable, identity);
		const reading = readingContext(document, model, file.path === home);
		return {
			...documentTargets(
				document,
				model,
				Object.values(reading.receipts).map((receipt) => receipt.question),
			),
			diagnostics: model.diagnostics.get(file.path) ?? parsed.diagnostics,
			file: file.path,
			...(identity ? { identity } : {}),
			metadata: parsed.fields,
			modified: file.modified,
			questionActions: Object.fromEntries(questionActions ?? []),
			reading,
			requests: documentRequests(document, source, { ...snapshot, documents, model }),
			source: documentBody(document),
			unavailable: snapshot.unavailable,
			writable,
		} satisfies Document;
	});
}
