import { Effect, FileSystem } from "effect";
import { BadRequest, Conflict, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Document } from "#browser/document/schema.ts";
import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { archivedReading, documentPath, readingFiles } from "#server/archive/reading.ts";
import { currentDocument } from "#server/currentDocument.ts";
import { briefDiagnostic } from "#server/document/briefDiagnostic.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { areaDiagnostics } from "#server/metadata/areaDiagnostics.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import { vocabularyMessage } from "#server/metadata/vocabulary.ts";
import { locate } from "#server/responses/locate.ts";
import { readingActions } from "#server/responses/readingActions.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import type { WorkspaceSettings } from "#server/workspace.ts";
import { answerBody } from "./answerBody.ts";
import { type DocumentMention, documentMentions } from "./mentions.ts";
import { readingContext } from "./readingContext.ts";
import { requestOutcome } from "./requestOutcome.ts";
import { documentRequests } from "./requests.ts";
import { fleetDecisionTitle } from "./requestTitle.ts";
import { rulings } from "./rulings.ts";
import { documentTargets } from "./targets.ts";
import { waitingOn } from "./waitingOn.ts";

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

function referenceDetails(
	references: Readonly<Record<string, string>>,
	mentions: readonly DocumentMention[],
	model: MetadataModel,
	titles: ReadonlyMap<string, string>,
) {
	function details(referenced: MetadataDocument) {
		const { kind, status } = referenced.parsed.fields;
		return { kind, status, title: titles.get(referenced.file) ?? referenced.file };
	}
	return Object.fromEntries([
		...mentions.map((mention) => [mention.token, details(mention.target)] as const),
		...Object.keys(references).flatMap((target) => {
			const referenced = model.ids.get(target.split("#")[0] ?? "")?.[0];
			return referenced ? [[target, details(referenced)] as const] : [];
		}),
	]);
}

export function readDocument({ changes, fleetPort, home, pullRequests = Effect.succeed(undefined), root, realRoot, writable }: WorkspaceSettings) {
	return Effect.fn("WorkBoard.document")(function* (url: string, indexed: Snapshot) {
		const snapshot = yield* archivedReading(indexed, url);
		const files = readingFiles(yield* changes.files, snapshot);
		const { file, item } = yield* selected(url, snapshot, files, home);
		const real = yield* documentPath(root, realRoot, file.path, item);
		if (!real) {
			return yield* Effect.fail(new NotFound({ message: "The document is missing." }));
		}
		const fs = yield* FileSystem.FileSystem;
		const source = yield* fs.readFileString(real);
		const current = currentDocument(snapshot, file.path, source, home ?? files[0]?.path);
		const { document } = current;
		const { parsed } = document;
		const vocabulary = vocabularyMessage(document);
		if (vocabulary) {
			return yield* Effect.fail(new BadRequest({ message: vocabulary }));
		}
		const { model } = current.snapshot;
		const id = parsed.fields.id;
		const identity = id && referenceTarget(id, model) ? id : undefined;
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
		const mentions = documentMentions(parsed.fields.nextAction, document, model);
		const requests = documentRequests(document, source, current.snapshot);
		const pulls = yield* pullRequests;
		const briefProblems = yield* briefDiagnostic(parsed, real, fleetPort);
		return {
			...targets,
			diagnostics: [
				...(model.diagnostics.get(file.path) ?? parsed.diagnostics),
				...(yield* areaDiagnostics(root, parsed, file.path)),
				...briefProblems,
			],
			file: file.path,
			...(identity ? { identity } : {}),
			metadata: parsed.fields,
			modified: file.modified,
			pullRequests: pulls,
			questionActions: Object.fromEntries(questionActions ?? []),
			reading,
			referenceDetails: referenceDetails(targets.references, mentions, model, titles),
			references: { ...Object.fromEntries(mentions.map((mention) => [mention.token, mention.href])), ...targets.references },
			requestOutcome: requestOutcome(document, current.snapshot),
			requests,
			rulings: rulings(document, model, titles),
			source: answerBody(
				document,
				requests,
				fleetDecisionTitle(document, model, (path) => titles.get(path)),
			),
			unavailable: snapshot.unavailable,
			waitingOn: waitingOn(document, current.snapshot),
			writable,
		} satisfies Document;
	});
}
