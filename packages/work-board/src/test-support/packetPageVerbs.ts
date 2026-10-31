import { Effect } from "effect";
import { metadataParse } from "#server/metadata/parse.ts";
import type { OpenPage } from "./browser.ts";
import { formEvent } from "./formEvent.ts";
import { type BoardEngine, connected, savedResponseFiles } from "./storyEngine.ts";

const PAGE_WAIT = "5 seconds";

// Waits on the page's own DOM mutations, never a timer, until the page has done what the line names.
export function pageMutation(page: OpenPage, line: string, done: () => boolean) {
	return Effect.callback<void>((resume) => {
		if (done()) {
			resume(Effect.void);
			return;
		}
		const observer = new page.window.MutationObserver(() => {
			if (done()) {
				observer.disconnect();
				resume(Effect.void);
			}
		});
		observer.observe(page.document, { attributes: true, characterData: true, childList: true, subtree: true });
		return Effect.sync(() => observer.disconnect());
	}).pipe(Effect.timeoutOrElse({ duration: PAGE_WAIT, orElse: () => Effect.die(new Error(`The page never got to this point: ${line}`)) }));
}

function inboxCount(page: OpenPage) {
	return page.document.getElementById("primary-navigation")?.getAttribute("data-inbox-count");
}

function status(page: OpenPage) {
	return page.document.getElementById("response-status")?.textContent ?? "";
}

export function packetPageVerbs(engine: BoardEngine, tell: (line: string) => void) {
	let badgeBeforeSend: string | null | undefined;
	function page() {
		return connected(engine).page;
	}
	return {
		inboxBadgeUpdates: () => {
			tell("the page's Inbox badge changes from its count before the answer was sent");
			const opened = page();
			return pageMutation(opened, "the Inbox badge changed after the answer was sent", () => inboxCount(opened) !== badgeBeforeSend);
		},
		pageAnswerStatus: () =>
			Effect.sync(() => {
				tell("the reader reads the answer's status on the page");
				return status(page());
			}),
		pageChooses: (option: string) =>
			formEvent(page(), () => {
				tell(`the reader chooses option ${option} on the page`);
				const choice = page().document.querySelector(`[data-choice="${option}"]`);
				if (!choice) {
					throw new Error(`The page has no option ${option}`);
				}
				choice.dispatchEvent(new (page().window.MouseEvent)("click", { bubbles: true }));
			}),
		pageInboxBadges: () =>
			Effect.sync(() => {
				tell("the reader reads the Inbox badges in the sidebar and the top bar");
				return ["inbox-count", "inbox-topbar-count"].map((id) => page().document.getElementById(id)?.textContent);
			}),
		recordedPageAnswer: () =>
			Effect.sync(() => {
				tell("the reader reads the answer file the board recorded");
				const saved = savedResponseFiles(engine).find(({ file }) => file.startsWith("responses/response."));
				if (!saved) {
					return "no answer recorded";
				}
				const { body, fields } = metadataParse(saved.source);
				return { author: fields.response?.author, body, kind: fields.kind, selected: fields.response?.answers?.map((answer) => answer.selected) };
			}),
		sendPageAnswer: () =>
			Effect.gen(function* () {
				tell("the reader sends the answer from the page and the page reports how the save ended");
				const opened = page();
				badgeBeforeSend = inboxCount(opened);
				const form = opened.document.getElementById("response-form");
				if (!(form instanceof opened.window.HTMLFormElement)) {
					return yield* Effect.die(new Error("The page has no answer form"));
				}
				const before = status(opened);
				form.dispatchEvent(new opened.window.Event("submit", { bubbles: true, cancelable: true }));
				yield* pageMutation(opened, "the answer status left saving", () => status(opened) !== before && !status(opened).startsWith("Saving"));
			}),
	};
}
