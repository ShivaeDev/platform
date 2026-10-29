import { Effect } from "effect";
import { openPage } from "#test/browser.ts";
import { followLink } from "#test/followLink.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { pageActions } from "#test/pageActions.ts";
import { setNativeValue } from "#test/setNativeValue.ts";
import { type BoardEngine, connected, readerView, rememberReader, savedResponseItems } from "#test/storyEngine.ts";

export function readerVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function page() {
		return connected(engine).page;
	}
	function text(selector: string, value: string) {
		tell(`the reader enters ${JSON.stringify(value)} in ${selector}`);
		const field = page().document.querySelector(selector);
		if (!(field instanceof page().window.HTMLInputElement || field instanceof page().window.HTMLTextAreaElement)) {
			throw new Error(`Missing ${selector}`);
		}
		setNativeValue(field, value);
		field.dispatchEvent(new (page().window.Event)("input", { bubbles: true }));
		return field;
	}
	function click(id: string) {
		tell(`the reader clicks ${id}`);
		const control = page().document.getElementById(id);
		if (!control) {
			throw new Error(`Missing ${id}`);
		}
		control.dispatchEvent(new (page().window.MouseEvent)("click", { bubbles: true }));
	}
	return {
		...pageActions(page, tell),
		answer: (prompt: string, value: string) => text(`[data-prompt="${prompt}"] textarea`, value),
		chooseOption: (value: string) =>
			formEvent(page(), () => {
				tell(`the reader chooses ${value}`);
				const control = page().document.querySelector(`[data-choice="${value}"]`);
				if (!control) {
					throw new Error(`Missing choice ${value}`);
				}
				control.dispatchEvent(new (page().window.MouseEvent)("click", { bubbles: true }));
			}),
		click,
		enterAnswer: (value: string) => formEvent(page(), () => text("[data-answer-text]", value)),
		fieldValue: (name: string) => {
			const field = page().document.querySelector(`[name="${name}"]`);
			return field instanceof page().window.HTMLTextAreaElement ? field.value : undefined;
		},
		follow: (href: string) =>
			formEvent(page(), () => {
				tell(`the reader follows ${href}`);
				followLink(page(), href);
			}),
		heading: () => page().document.querySelector("#doc h1")?.textContent,
		inboxCounts: () => ["inbox-count", "inbox-topbar-count"].map((id) => page().document.getElementById(id)?.textContent),
		indexingProgress: () => page().document.querySelector('#doc [data-indexing] [data-slot="progress-label"]')?.textContent,
		input: (name: string, value: string) => text(`[name="${name}"]`, value),
		open: Effect.fn("Story.open")(function* (path: string, before?: Parameters<typeof openPage>[2]) {
			tell(`the reader opens ${path}`);
			yield* Effect.promise(() => page().close());
			const opened = yield* openPage(connected(engine).board, path, before);
			connected(engine).page = opened;
			yield* rememberReader(engine);
			return opened;
		}),
		preview: () => formEvent(page(), () => click("response-preview")),
		readsByMethod: Effect.fn("Story.readsByMethod")(function* () {
			tell("the reader waits for the page to settle and counts its RPC requests by method");
			const opened = page();
			yield* Effect.promise(() =>
				waitFor(() => {
					if (opened.document.getElementById("live")?.getAttribute("data-state") !== "live") {
						throw new Error("The page is not live yet");
					}
				}),
			);
			return Object.fromEntries(
				Map.groupBy(
					opened.pageRequests.methods.filter((method) => !method.endsWith(".$changes")),
					(method) => method,
				)
					.entries()
					.map(([method, calls]) => [method, calls.length]),
			);
		}),
		releaseRequest: (method: string) => {
			tell(`the page sends its held ${method} requests`);
			const hold = engine.heldRequests?.get(method);
			if (!hold) {
				throw new Error(`The page does not hold ${method} requests`);
			}
			hold.release();
		},
		responseStatus: () => page().document.getElementById("response-status")?.textContent,
		savedResponses: () => savedResponseItems(engine),
		submit: (form = "response-form") =>
			formEvent(page(), () => {
				tell(`the reader submits ${form}`);
				const control = page().document.getElementById(form);
				if (!(control instanceof page().window.HTMLFormElement)) {
					throw new Error(`Missing form ${form}`);
				}
				control.dispatchEvent(new (page().window.Event)("submit", { bubbles: true, cancelable: true }));
			}),
		text,
		todayRows: (list: string) =>
			[...page().document.querySelectorAll(`ul[aria-label="${list}"] > li`)].map((row) => ({
				detail: row.querySelector("p")?.getAttribute("title"),
				title: row.querySelector("a")?.getAttribute("title"),
			})),
		view: () => {
			page();
			return readerView(engine);
		},
	};
}

export type BoardReader = ReturnType<typeof readerVerbs>;
