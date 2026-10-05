import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "#page/escape.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import type { page } from "./page.ts";
import { respond } from "./respond.ts";

function requestedIdentity(pathname: string): string {
	try {
		return decodeURIComponent(pathname.slice("/_board/item/".length).replace(/\/$/u, ""));
	} catch {
		return "";
	}
}

export function identity(
	index: Effect.Success<ReturnType<typeof searchSnapshot>>,
	pages: ReturnType<typeof page>,
	changes: Changes,
	home: string | undefined,
) {
	return Effect.fn("WorkBoard.identity")(function* (request: HttpServerRequest.HttpServerRequest) {
		const pathname = new URL(request.url, "http://127.0.0.1").pathname;
		const id = requestedIdentity(pathname);
		if (!pathname.endsWith("/") && /\.md$/iu.exec(id) !== null) {
			return yield* pages(request);
		}
		const snapshot = yield* index;
		const matches = snapshot.model.ids.get(id) ?? [];
		if (snapshot.unavailable.length > 0) {
			return respond(
				shell(
					`Item ${id}`,
					"",
					`<p class="empty">The workspace index is incomplete. Could not read ${escapeHtml(snapshot.unavailable.join(", "))}; item identity could not be validated. Retry when the files are readable.</p>`,
					changes.realRoot,
					false,
				),
				"text/html",
				503,
			);
		}
		if (matches.length === 1 && matches[0]) {
			return yield* pages(request, matches[0].file, id);
		}
		const text =
			matches.length > 0
				? `The ID ${id} is duplicated. No document was selected.`
				: `No item with ID ${id} is available. It may be missing, renamed, or invalid.`;
		const choices = matches.map((document) => `<li><a href="${escapeHtml(fileUrl(document.file))}">${escapeHtml(document.file)}</a></li>`).join("");
		const nav = navHtml(yield* changes.files, "", home);
		return respond(
			shell(`Item ${id}`, nav, `<p class="empty">${escapeHtml(text)}</p>${choices ? `<ul>${choices}</ul>` : ""}`, changes.realRoot, false),
			"text/html",
			matches.length > 0 ? 409 : 404,
		);
	});
}
