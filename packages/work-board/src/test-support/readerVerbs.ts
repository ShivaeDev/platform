import { Effect } from "effect";
import { openPage } from "./browser.ts";
import { enterField } from "./enterField.ts";
import { followLink } from "./followLink.ts";
import { formEvent } from "./formEvent.ts";
import { waitFor } from "./live.ts";
import { pageActions } from "./pageActions.ts";
import { setNativeValue } from "./setNativeValue.ts";
import { type BoardEngine, connected, readerView, rememberReader, savedResponseItems } from "./storyEngine.ts";
import { currentReplies } from "./storyReplies.ts";

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
		currentReplies: () => {
			tell("the reader reads the current saved replies");
			return currentReplies(engine);
		},
		enterAnswer: (value: string) => formEvent(page(), () => text("[data-answer-text]", value)),
		enterAuthor: (value: string) =>
			formEvent(page(), () => {
				tell(`the reader signs as ${value}`);
				enterField(page(), "author", value);
			}),
		fieldValue: (name: string) => {
			const field = page().document.querySelector(`[name="${name}"]`);
			return field instanceof page().window.HTMLTextAreaElement ? field.value : undefined;
		},
		follow: (href: string) =>
			formEvent(page(), () => {
				tell(`the reader follows ${href}`);
				followLink(page(), href);
			}),
		inboxCounts: () => ["inbox-count", "inbox-topbar-count"].map((id) => page().document.getElementById(id)?.textContent),
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
		requestsByMethod: Effect.fn("Story.requestsByMethod")(function* () {
			tell("the reader waits for the page to settle and counts its RPC requests by method");
			const opened = page();
			yield* Effect.promise(() =>
				waitFor(() => {
					if (opened.document.getElementById("live")?.textContent !== "live") {
						throw new Error("The page is not live yet");
					}
				}),
			);
			let seen = -1;
			while (seen !== opened.pageRequests.methods.length) {
				seen = opened.pageRequests.methods.length;
				yield* Effect.sleep("150 millis");
			}
			return Object.fromEntries(
				Map.groupBy(opened.pageRequests.methods, (method) => method)
					.entries()
					.map(([method, calls]) => [method, calls.length]),
			);
		}),
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
