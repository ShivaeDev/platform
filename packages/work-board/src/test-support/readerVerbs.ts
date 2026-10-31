import { Effect } from "effect";
import { openPage } from "#test/browser.ts";
import { followLink } from "#test/followLink.ts";
import { formEvent } from "#test/formEvent.ts";
import { pageActions } from "#test/pageActions.ts";
import { setNativeValue } from "#test/setNativeValue.ts";
import { type BoardEngine, connected, readerView, rememberReader } from "#test/storyEngine.ts";

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
		click,
		follow: (href: string) =>
			formEvent(page(), () => {
				tell(`the reader follows ${href}`);
				followLink(page(), href);
			}),
		heading: () => page().document.querySelector("#doc h1")?.textContent,
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
		releaseRequest: (method: string) => {
			tell(`the page sends its held ${method} requests`);
			const hold = engine.heldRequests?.get(method);
			if (!hold) {
				throw new Error(`The page does not hold ${method} requests`);
			}
			hold.release();
		},
		responseStatus: () => page().document.getElementById("response-status")?.textContent,
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
		view: () => {
			page();
			return readerView(engine);
		},
	};
}

export type BoardReader = ReturnType<typeof readerVerbs>;
