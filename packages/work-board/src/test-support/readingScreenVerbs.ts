import { Effect } from "effect";
import { act } from "react";
import { shellIds } from "#client/react/shellIds.ts";
import { diagramDrawingVerbs } from "./diagramDrawingVerbs.ts";
import { readingHistoryVerbs } from "./readingHistoryVerbs.ts";
import { all, clipboards, copyButton, firstShells, linkPair, outlinePopover, place, readingScreenReads, text } from "./readingScreenReads.ts";
import { readingSettles, releaseLaterRead } from "./readingSettle.ts";
import { readingStructureVerbs } from "./readingStructureVerbs.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function readingScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { read, perform } = readingScreenReads(engine, tell);
	return {
		...diagramDrawingVerbs(engine, tell),
		...readingHistoryVerbs(engine, tell),
		...readingStructureVerbs(engine, tell),
		address: () => read("the reader reads the address bar", () => engine.router?.state.location.pathname ?? "none"),
		addressHash: () => read("the reader reads the passage the address points to", () => engine.router?.state.location.hash ?? "none"),
		answerCards: () => read("the reader reads the answer cards on the page", () => all(".answer-cards .answer-reason").map((reason) => text(reason))),
		bodyHeaders: () =>
			read("the reader reads the headers written in the document text", () => all("article.doc header").map((header) => text(header))),
		chooseOutlineSection: (href: string) =>
			perform(
				`the reader chooses ${href} in the On this page menu`,
				() => outlinePopover()?.querySelector<HTMLElement>(`a[href="${href}"]`),
				`The On this page menu has no entry for ${href}`,
				(link) => {
					// The browser resolves the section link against the address bar, which the story's in-memory router does not move.
					window.history.replaceState(window.history.state, "", engine.router?.state.location.href);
					link.click();
				},
			),
		clipboard: () => read("the reader reads what was copied to the clipboard", () => clipboards.get(engine) ?? []),
		closeViewer: (way: "Escape" | "Close") =>
			perform(
				way === "Escape" ? "the reader presses Escape in the image viewer" : "the reader clicks Close in the image viewer",
				() => {
					if (way === "Close") {
						return document.getElementById(shellIds.visualClose);
					}
					return document.activeElement instanceof HTMLElement ? document.activeElement : null;
				},
				"The image viewer is not open",
				(target) => {
					if (way === "Escape") {
						target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }));
					} else {
						target.click();
					}
				},
			),
		contextTab: () =>
			read(
				"the reader reads which item context tab is selected",
				() => text(document.querySelector('.item-context [role="tab"][aria-selected="true"]')) || "none",
			),
		copyButton: () => read("the reader reads the label of the copy button", () => copyButton()?.getAttribute("aria-label") ?? "none"),
		copyItemId: () =>
			perform("the reader copies the item ID", copyButton, "The item header has no copy button", (button) => {
				button.focus();
				button.click();
			}),
		criteriaList: () =>
			read("the reader reads where the criteria are listed", () => {
				const criteria = all("li[id^='criterion-']");
				const [first] = criteria;
				return first ? { criteria: criteria.map((criterion) => criterion.id.replace("criterion-", "")), place: place(first) } : "none";
			}),
		criterionEvidence: (id: string) =>
			read(`the reader reads the recorded evidence of criterion ${id}`, () => {
				const criterion = document.getElementById(`criterion-${id}`);
				const links = all("a", criterion ?? document.createElement("li")).map((link) => link.getAttribute("href"));
				return links.length === 0 ? "none" : { claims: /\d+ recorded claims?:/u.exec(text(criterion))?.[0], links };
			}),
		criterionMarkup: (id: string) =>
			read(`the reader reads how criterion ${id} is formatted`, () => {
				const criterion = document.getElementById(`criterion-${id}`) ?? document.createElement("li");
				return {
					code: all("code:not(:first-child)", criterion).map((code) => text(code)),
					links: all("a", criterion).map(linkPair),
					strong: all("strong", criterion).map((strong) => text(strong)),
					text: text(criterion),
				};
			}),
		currentSection: (where: "outline" | "On this page menu") =>
			read(`the reader reads which section the ${where} marks as current`, () => {
				const within = where === "outline" ? document.querySelector("nav.document-outline") : outlinePopover();
				return within?.querySelector('a[aria-current="location"]')?.getAttribute("href") ?? "none";
			}),
		documentBody: () => read("the reader reads the document text", () => text(document.querySelector("#doc article.doc"))),
		documentLinks: () =>
			read("the reader reads the links in the document text", () =>
				all("article.doc a")
					.filter((link) => !link.closest(".item-summary, [data-page-header], .document-criteria, nav, h1, h2, h3, h4, h5, h6"))
					.map(linkPair),
			),
		documentParagraphs: () =>
			read("the reader reads the paragraphs of the document text", () => all("article.doc p").map((paragraph) => text(paragraph))),
		documentShell: () =>
			read("the reader checks whether the page still uses the shell it opened in", () => {
				const shell = document.querySelector("main");
				if (!shell) {
					return "none";
				}
				const first = firstShells.get(engine) ?? shell;
				firstShells.set(engine, first);
				return first === shell ? "the shell the page opened in" : "a new shell";
			}),
		evidenceSummaries: () =>
			read("the reader reads the criteria evidence summaries", () =>
				all("p")
					.map((paragraph) => text(paragraph))
					.filter((line) => line.endsWith("criteria have recorded evidence")),
			),
		focusPin: () =>
			perform(
				"the reader moves focus to Pin",
				() => document.querySelector<HTMLElement>("#favorite-toggle"),
				"The page has no Pin button",
				(pin) => pin.focus(),
			),
		formCaret: () =>
			read("the reader checks focus and the caret in the form", () => {
				const field = document.querySelector("form textarea");
				if (!(field instanceof HTMLTextAreaElement)) {
					return "no form field";
				}
				return { focused: document.activeElement === field, selection: [field.selectionStart, field.selectionEnd, field.selectionDirection] };
			}),
		goBack: () =>
			Effect.gen(function* () {
				tell("the reader goes back");
				const router = engine.router;
				if (!router) {
					return yield* Effect.die(new Error("The screen has no router"));
				}
				yield* Effect.promise(() => act(async () => router.history.back()));
				yield* readingSettles(engine, tell);
			}),
		headerHeightsInLayout: () =>
			read("the reader reads the heights the layout reserved for the page header at each measurement", () => {
				void document.querySelector<HTMLElement>("[data-page-header]")?.offsetHeight;
				return [...new Set(engine.headerFootprints ?? [])].sort((left, right) => left - right);
			}),
		headerState: () =>
			read("the reader looks at the page header", () => {
				const header = document.querySelector("[data-page-header]");
				if (!header) {
					return "none";
				}
				return header.hasAttribute("data-compact") ? "compact" : "expanded";
			}),
		headerTitle: () => read("the reader reads the title in the page header", () => text(document.querySelector("[data-page-header] h1"))),
		headerTitles: () => read("the reader reads the titles of every page header", () => all("[data-page-header] h1").map((title) => text(title))),
		headingAnchors: () =>
			read("the reader reads the anchors of the document's headings", () => all("#doc [id^='heading-']").map((heading) => heading.id)),
		heldReadFinishes: () =>
			Effect.gen(function* () {
				tell("the held document read answers");
				yield* Effect.promise(() => act(async () => releaseLaterRead(engine)));
				yield* readingSettles(engine, tell);
			}),
	};
}
