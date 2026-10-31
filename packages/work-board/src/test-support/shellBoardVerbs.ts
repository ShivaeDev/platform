import { Effect } from "effect";
import type { OpenPage } from "./browser.ts";
import { type BoardEngine, connected } from "./storyEngine.ts";

const PAGE_LIMIT_MS = 10_000;

function heading(page: OpenPage) {
	return page.document.querySelector("#doc h1")?.textContent ?? "no heading";
}

function shows(page: OpenPage, route: string) {
	return page.document.getElementById("doc")?.getAttribute("data-route") === route && heading(page) !== "no heading";
}

function changes(page: OpenPage, signal: string, done: () => boolean) {
	return new Promise<void>((resolve, reject) => {
		if (done()) {
			resolve();
			return;
		}
		const observer = new page.window.MutationObserver(() => {
			if (done()) {
				finish();
				resolve();
			}
		});
		const limit = setTimeout(() => {
			finish();
			reject(new Error(`The bundle page never reached: ${signal}`));
		}, PAGE_LIMIT_MS);
		function finish() {
			observer.disconnect();
			clearTimeout(limit);
		}
		observer.observe(page.document, { attributes: true, characterData: true, childList: true, subtree: true });
	});
}

// The Board restores open details and the selection in an animation frame after the route renders, and that frame leaves no mark in the page.
function frames(page: OpenPage, count: number): Promise<void> {
	return count === 0 ? Promise.resolve() : new Promise((resolve) => page.window.requestAnimationFrame(() => resolve(frames(page, count - 1))));
}

export function shellBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function moving(line: string, route: string, move: (page: OpenPage) => void) {
		return Effect.promise(async () => {
			tell(line);
			const { page } = connected(engine);
			move(page);
			await changes(page, `${route} rendered`, () => shows(page, route));
			await frames(page, 2);
		});
	}
	return {
		bundleLocation: () =>
			Effect.sync(() => {
				tell("the reader reads which page the Board shows and whether the browser reloaded it");
				const { page } = connected(engine);
				return { address: page.window.location.pathname, heading: heading(page), visit: page.document.body.dataset.visit ?? "reloaded" };
			}),
		bundlePageReady: () =>
			Effect.promise(async () => {
				tell("the page finishes loading and enables pinning");
				const { page } = connected(engine);
				await changes(
					page,
					"an enabled pin button",
					() => page.pageRequests.answered > 0 && page.document.getElementById("favorite-toggle")?.hasAttribute("disabled") === false,
				);
				page.document.body.dataset.visit = "kept";
			}),
		bundleReading: () =>
			Effect.sync(() => {
				tell("the reader reads whether the page's details are open and which of its text is selected");
				const { page } = connected(engine);
				const details = page.document.querySelector("article details");
				const selection = page.window.getSelection();
				const onPage = selection?.anchorNode?.isConnected === true && page.document.getElementById("doc")?.contains(selection.anchorNode) === true;
				const open = details?.hasAttribute("open") ? "open" : "closed";
				return {
					details: details ? open : "none",
					selection: onPage ? (selection?.toString() ?? "") : "",
				};
			}),
		followInBundle: (href: string) =>
			moving(`the reader clicks a link to ${href}`, href, (page) => {
				const link = page.document.createElement("a");
				link.href = href;
				const doc = page.document.getElementById("doc");
				if (!doc) {
					throw new Error("The bundle page has no document to hold a link");
				}
				doc.append(link);
				link.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
				link.remove();
			}),
		goBackInBundle: (to: string) => moving(`the reader goes back to ${to}`, to, (page) => page.window.history.back()),
		goForwardInBundle: (to: string) => moving(`the reader goes forward to ${to}`, to, (page) => page.window.history.forward()),
		openBundleDetails: () =>
			Effect.sync(() => {
				tell("the reader opens the page's details");
				connected(engine).page.document.querySelector("article details")?.setAttribute("open", "");
			}),
		selectBundleText: (length: number) =>
			Effect.sync(() => {
				tell(`the reader selects the first ${length} characters of the page's first paragraph`);
				const { page } = connected(engine);
				const text = page.document.querySelector("article p")?.firstChild;
				if (!text) {
					throw new Error("The page has no paragraph text to select");
				}
				page.window.getSelection()?.setBaseAndExtent(text, 0, text, length);
			}),
	};
}
