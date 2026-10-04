import { Effect, FileSystem, Option, Path } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { type MarkdownFile, within } from "#files/list.ts";
import { boardHtml } from "#page/board.ts";
import { documentHtml } from "#page/document.ts";
import { escapeHtml } from "#page/escape.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import { boardOf } from "#render/board.ts";
import { respond } from "./respond.ts";

export interface PageOptions {
	readonly home: string | undefined;
	readonly root: string;
}

const requestedPath = (url: string): string => {
	const pathname = new URL(url, "http://127.0.0.1").pathname.replace(/^\/+/u, "");
	try {
		return decodeURIComponent(pathname);
	} catch {
		return pathname;
	}
};

const message = (text: string): string => `<p class="empty">${escapeHtml(text)}</p>`;

export const page = (options: PageOptions, changes: Changes) => {
	const body = Effect.fn("WorkBoard.pageBody")(function* (file: MarkdownFile) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const real = yield* Effect.option(fs.realPath(path.join(options.root, file.path)));
		if (Option.isNone(real) || !within(changes.realRoot, path.sep, real.value)) {
			return Option.none();
		}
		const source = yield* fs.readFileString(real.value);
		return Option.some(file.path === options.home ? yield* boardHtml(boardOf(source), file.path, file.modified) : yield* documentHtml(source, file));
	});
	return Effect.fn("WorkBoard.page")(function* (request: HttpServerRequest.HttpServerRequest) {
		const files = yield* changes.files;
		const requested = requestedPath(request.url) || options.home || files[0]?.path || "";
		const file = files.find((candidate) => candidate.path === requested);
		const nav = navHtml(files, requested, options.home);
		const missing = () => respond(shell(requested, nav, message(`No markdown file at ${requested || options.root}.`)), "text/html", 404);
		if (file === undefined) {
			return missing();
		}
		return yield* body(file).pipe(
			Effect.map(Option.match({ onNone: missing, onSome: (main) => respond(shell(file.path, nav, main), "text/html") })),
			Effect.catch(() => Effect.succeed(respond(shell(file.path, nav, message(`${file.path} could not be read.`)), "text/html", 500))),
		);
	});
};
