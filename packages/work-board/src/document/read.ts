import { Effect, FileSystem } from "effect";
import type { Document } from "#browser/document/schema.ts";
import type { Changes } from "#files/changes.ts";
import type { MarkdownFile } from "#files/list.ts";
import { markdownPath } from "#files/markdownPath.ts";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { readingActions } from "#responses/readingActions.ts";
import type { responseService } from "#responses/service.ts";
import { ReadFailed } from "#rpc/contract.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { documentRequests } from "./requests.ts";
import { documentTargets } from "./targets.ts";

export interface DocumentOptions {
	readonly changes: Changes;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly responses?: Effect.Success<ReturnType<typeof responseService>>;
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
		return yield* Effect.fail(new ReadFailed({ operation: "document", status: 503 }));
	}
	const matches = item ? snapshot.model.ids.get(item) : undefined;
	if (matches && matches.length > 1) {
		return yield* Effect.fail(new ReadFailed({ operation: "document", status: 409 }));
	}
	const path = item ? matches?.[0]?.file : requested || home || files[0]?.path;
	const file = files.find((candidate) => candidate.path === path);
	if (!file) {
		return yield* Effect.fail(new ReadFailed({ operation: "document", status: 404 }));
	}
	return { file, item };
});

export function readDocument({ changes, home, index, responses, root, writable }: DocumentOptions) {
	return Effect.fn("WorkBoard.document")(function* (url: string) {
		const snapshot = yield* index;
		const files = yield* changes.files;
		const { file, item } = yield* selected(url, snapshot, files, home);
		const real = yield* markdownPath(root, changes.realRoot, file.path);
		if (!real) {
			return yield* Effect.fail(new ReadFailed({ operation: "document", status: 404 }));
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
			return yield* Effect.fail(new ReadFailed({ operation: "document", status: 404 }));
		}
		const questionActions = yield* readingActions(document, source, responses, writable, identity);
		return {
			...documentTargets(document, model),
			diagnostics: model.diagnostics.get(file.path) ?? parsed.diagnostics,
			file: file.path,
			...(identity ? { identity } : {}),
			metadata: parsed.fields,
			modified: file.modified,
			questionActions: Object.fromEntries(questionActions ?? []),
			requests: documentRequests(document, source, { ...snapshot, documents, model }),
			source: parsed.body,
			unavailable: snapshot.unavailable,
			writable,
		} satisfies Document;
	});
}
