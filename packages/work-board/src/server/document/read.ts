import { Effect, FileSystem } from "effect";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { Document } from "#browser/document/schema.ts";
import { currentDocument } from "#server/currentDocument.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { locate } from "#server/responses/locate.ts";
import { readingActions } from "#server/responses/readingActions.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import type { WorkspaceSettings } from "#server/workspace.ts";
import { answerBody } from "./answerBody.ts";
import { readingContext } from "./readingContext.ts";
import { requestOutcome } from "./requestOutcome.ts";
import { documentRequests } from "./requests.ts";
import { documentTargets } from "./targets.ts";

const selected = Effect.fn("WorkBoard.selected")(function* (
	url: string,
	snapshot: Snapshot,
	files: readonly MarkdownFile[],
	home: string | undefined,
) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	const requested = decodeURIComponent(pathname.slice(1));
	const encodedId = /^\/_board\/item\/(?<id>[^/]+)\/?$/u.exec(pathname)?.groups?.id;
	const item = encodedId === undefined ? undefined : decodeURIComponent(encodedId);
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

export function readDocument({ changes, home, root, realRoot, writable }: WorkspaceSettings) {
	return Effect.fn("WorkBoard.document")(function* (url: string, snapshot: Snapshot) {
		const files = yield* changes.files;
		const { file, item } = yield* selected(url, snapshot, files, home);
		const real = yield* markdownPath(root, realRoot, file.path);
		if (!real) {
			return yield* Effect.fail(new NotFound({ message: "The document is missing." }));
		}
		const fs = yield* FileSystem.FileSystem;
		const source = yield* fs.readFileString(real);
		const current = currentDocument(snapshot, file.path, source, home ?? files[0]?.path);
		const { document } = current;
		const { parsed } = document;
		const { model } = current.snapshot;
		const id = parsed.fields.id;
		const identity = id && snapshot.unavailable.length === 0 && model.ids.get(id)?.length === 1 ? id : undefined;
		if (item && identity !== item) {
			return yield* Effect.fail(new NotFound({ message: "The document is missing." }));
		}
		const questionActions = yield* readingActions(document, source, writable, identity, locate(root, realRoot, Effect.succeed(snapshot), fs));
		const titles = new Map(current.snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
		const reading = readingContext(document, model, file.path === home, titles);
		const targets = documentTargets(
			document,
			model,
			Object.values(reading.receipts).map((receipt) => receipt.question),
		);
		const referenceDetails = Object.fromEntries(
			Object.keys(targets.references).flatMap((target) => {
				const referenced = model.ids.get(target.split("#")[0] ?? "")?.[0];
				const { kind, status } = referenced?.parsed.fields ?? {};
				return referenced ? [[target, { kind, status, title: titles.get(referenced.file) ?? referenced.file }]] : [];
			}),
		);
		const requests = documentRequests(document, source, current.snapshot);
		return {
			...targets,
			diagnostics: model.diagnostics.get(file.path) ?? parsed.diagnostics,
			file: file.path,
			...(identity ? { identity } : {}),
			metadata: parsed.fields,
			modified: file.modified,
			questionActions: Object.fromEntries(questionActions ?? []),
			reading,
			referenceDetails,
			requestOutcome: requestOutcome(document, current.snapshot),
			requests,
			source: answerBody(document, requests),
			unavailable: snapshot.unavailable,
			writable,
		} satisfies Document;
	});
}
