import { Effect } from "effect";
import { act } from "react";
import { chrome } from "./chrome.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { trackScreen } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { shellActs, shellElement } from "./shellScreenAct.ts";

function details(summary: string) {
	const found = [...document.querySelectorAll<HTMLDetailsElement>("#doc details")].find(
		(candidate) => candidate.querySelector("summary")?.textContent === summary,
	);
	if (!found) {
		throw new Error(`The page has no ${summary} details`);
	}
	return found;
}

function sectionLinks(name: string) {
	return [...document.querySelectorAll<HTMLAnchorElement>(`section[aria-label="${name}"] a`)];
}

export function shellReadingVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		detailsBlock: (summary: string) => reading(`the reader checks the ${summary} details`, () => (details(summary).open ? "open" : "closed")),
		historyNotice: () =>
			reading("the reader reads the reading history notice", () => document.querySelector('#library-dialog [role="status"]')?.textContent),
		openDetailsBlock: (summary: string) =>
			acting(`the reader opens the ${summary} details`, () => {
				const found = details(summary);
				found.open = true;
				found.dispatchEvent(new Event("toggle"));
			}),
		openFromReadingHistory: (title: string) =>
			acting(`the reader opens ${title} from Reading history`, () => {
				const link = [...document.querySelectorAll<HTMLAnchorElement>("#reading-library a[href]")].find((candidate) =>
					candidate.textContent?.startsWith(title),
				);
				if (!link) {
					throw new Error(`Reading history lists no ${title}`);
				}
				link.click();
			}),
		openReadingHistory: () =>
			acting("the reader opens Reading history from the sidebar", () => {
				const button = shellElement("#library-open", "Reading history button");
				button.focus();
				button.click();
			}),
		pinButton: () => reading("the reader reads the page's pin button", () => shellElement("#favorite-toggle", "pin button").textContent),
		pinPage: () => acting("the reader clicks the page's pin button", () => shellElement("#favorite-toggle", "pin button").click()),
		readingHistory: () =>
			reading("the reader reads each list in Reading history", () =>
				Object.fromEntries(
					[...document.querySelectorAll("#reading-library ul[aria-labelledby]")].map((list) => [
						document.getElementById(list.getAttribute("aria-labelledby") ?? "")?.textContent,
						[...list.querySelectorAll("a[href]")].map(
							(link) => `${link.textContent}${link.getAttribute("aria-current") === "page" ? " (current)" : ""}`,
						),
					]),
				),
			),
		reloadShell: () =>
			Effect.gen(function* () {
				const location = engine.router?.state.location;
				tell(`the reader reloads the Board at ${location?.href}`);
				yield* Effect.promise(async () => {
					act(() => window.dispatchEvent(new Event("pagehide")));
					await engine.view?.unmount();
					window.history.replaceState({ workBoard: { id: location?.state.key } }, "");
					const { workspace } = document.documentElement.dataset;
					for (const attribute of [...document.documentElement.attributes]) {
						document.documentElement.removeAttribute(attribute.name);
					}
					if (workspace) {
						document.documentElement.dataset.workspace = workspace;
					}
					const view = await chrome({ ...engine.files }, location?.href ?? engine.path);
					engine.router = view.router;
					trackScreen(engine, view, tell);
				});
				yield* screenSettles(engine, tell);
			}),
		sidebarLinks: (section: string) =>
			reading(`the reader reads the sidebar's ${section} links`, () =>
				sectionLinks(section).map((link) => ({ href: link.getAttribute("href"), title: link.textContent })),
			),
	};
}
