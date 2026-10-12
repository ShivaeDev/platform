import { Effect, FileSystem, Option } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { authoredQuestion } from "#server/attention/inbox.ts";
import { documentBody } from "#server/document/body.ts";
import type { Changes } from "#server/files/changes.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { boardHtml } from "#server/page/boardHtml.ts";
import { documentHtml } from "#server/page/documentHtml.ts";
import { itemIntroduction } from "#server/page/itemIntroduction.ts";
import { metadataHtml } from "#server/page/metadata.ts";
import { navHtml } from "#server/page/nav.ts";
import { shell } from "#server/page/shell.ts";
import { startHtml } from "#server/page/startHtml.ts";
import { boardOf } from "#server/render/board.ts";
import { authoredQuestionHtml } from "#server/responses/authoredQuestionHtml.ts";
import { readingActions } from "#server/responses/readingActions.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";
import { respond } from "./respond.ts";

export interface PageOptions {
	readonly home: string | undefined;
	readonly root: string;
	readonly writable?: boolean;
}

function requestedPath(url: string): string {
	const pathname = new URL(url, "http://127.0.0.1").pathname.replace(/^\/+/u, "");
	try {
		return decodeURIComponent(pathname);
	} catch {
		return pathname;
	}
}

function message(text: string): string {
	return `<p class="empty">${escapeHtml(text)}</p>`;
}

export function page(options: PageOptions, changes: Changes, index: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	const body = Effect.fn("WorkBoard.body")(function* (file: MarkdownFile, expectedIdentity?: string) {
		const fs = yield* FileSystem.FileSystem;
		const real = yield* markdownPath(options.root, changes.realRoot, file.path);
		if (real === undefined) {
			return Option.none();
		}
		const source = yield* fs.readFileString(real);
		const parsed = metadataParse(source);
		let identity: string | undefined;
		const snapshot = yield* index;
		const model = metadataModel(
			[...snapshot.documents.filter((document) => document.file !== file.path), { file: file.path, parsed }],
			snapshot.unavailable,
			options.home ?? (yield* changes.files)[0]?.path,
		);
		const metadata = metadataHtml(parsed, file.path, model, file.path === options.home);
		if (snapshot.unavailable.length === 0 && parsed.fields.id && model.ids.get(parsed.fields.id)?.length === 1) {
			identity = parsed.fields.id;
		}
		if (expectedIdentity && identity !== expectedIdentity) {
			return Option.none();
		}
		const actions = yield* readingActions({ file: file.path, parsed }, source, options.writable === true, identity);
		const prose = documentBody({ file: file.path, parsed });
		const html =
			file.path === options.home
				? yield* boardHtml(boardOf(prose), file.path, file.modified, metadata, actions)
				: yield* documentHtml(prose, file, metadata, itemIntroduction(parsed), actions);
		const question = identity && authoredQuestion({ file: file.path, parsed });
		const answer = question ? yield* authoredQuestionHtml({ file: file.path, parsed }, source, options.writable === true) : "";
		return Option.some({ html: html + answer, identity });
	});
	return Effect.fn("WorkBoard.page")(function* (request: HttpServerRequest.HttpServerRequest, resolved?: string, expectedIdentity?: string) {
		const files = yield* changes.files;
		const requested = resolved ?? (requestedPath(request.url) || options.home || files[0]?.path || "");
		const file = files.find((candidate) => candidate.path === requested);
		const snapshot = yield* index;
		const nav = navHtml(files, requested, options.home, snapshot);
		function layout(content: string, identity?: string) {
			return shell(requested, nav, content, changes.realRoot, requested === options.home, identity, false, snapshot);
		}
		function missing() {
			return respond(
				layout(
					message(
						expectedIdentity
							? `No item with ID ${expectedIdentity} at ${requested}; its source identity changed or is invalid.`
							: `No markdown file at ${requested || options.root}.`,
					),
				),
				"text/html",
				404,
			);
		}
		if (files.length === 0 && requestedPath(request.url) === "" && resolved === undefined && expectedIdentity === undefined) {
			return respond(layout(startHtml(true)), "text/html");
		}
		if (file === undefined) {
			return missing();
		}
		return yield* body(file, expectedIdentity).pipe(
			Effect.map(Option.match({ onNone: missing, onSome: (main) => respond(layout(main.html, main.identity), "text/html") })),
			Effect.catch(() => Effect.succeed(respond(layout(message(`${file.path} could not be read.`)), "text/html", 500))),
		);
	});
}
