import { Effect } from "effect";
import { act } from "react";
import { captureReading, restoreReading } from "#client/react/readingState.ts";
import { shellIds } from "#client/react/shellIds.ts";
import {
	all,
	linkPair,
	outlinePopover,
	outlineTrigger,
	place,
	readingScreenReads,
	rememberedReadings,
	statusRegions,
	summaryFields,
	text,
} from "./readingScreenReads.ts";
import { framesSettle, readingSettles } from "./readingSettle.ts";
import { renderRouter } from "./renderRouter.tsx";
import { type ScreenEngine, trackScreen } from "./screenEngine.ts";
import { screenClient, screenContent } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { accessibleOf } from "./shellScreenAct.ts";

export function readingPageVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { data, reading, search, motion, availability, remembered, read, perform } = readingScreenReads(engine, tell);
	return {
		imageViewer: () => read("the reader looks at the image viewer", () => text(document.getElementById(shellIds.visualContext)) || "closed"),
		inspectImage: (alt: string) =>
			perform(
				`the reader inspects the image ${alt}`,
				() => all('button, [role="button"]').find((button) => accessibleOf(button).name === `Inspect image: ${alt}`),
				`The page offers no inspection of the image ${alt}`,
				(button) => button.click(),
			),
		itemActions: () =>
			read("the reader reads the actions in the page header", () =>
				all("[data-page-actions] a, [data-page-actions] button")
					.filter((action) => !(action.hasAttribute("data-outline-menu") || action.closest('[data-slot="popover-content"]')))
					.map((action) => ({
						...(action.getAttribute("href") ? { href: action.getAttribute("href") } : {}),
						name: action.getAttribute("aria-label") ?? text(action),
					})),
			),
		itemFieldLinks: () =>
			read("the reader reads the links in the owner and next action", () => all("a", summaryFields() ?? document.createElement("p")).map(linkPair)),
		itemFields: () => read("the reader reads the owner and next action", () => text(summaryFields()) || "none"),
		itemFleet: () =>
			read("the reader reads the Fleet stage in the item header", () => {
				const stage = all(".item-summary > div > *").find((badge) => text(badge).startsWith("Fleet · "));
				const pullRequest = all(".item-summary > div > a").find((link) => text(link) === "PR");
				return stage || pullRequest ? { pullRequest: pullRequest?.getAttribute("href"), stage: text(stage) } : "none";
			}),
		itemGoals: () =>
			read("the reader reads the goals the item is part of", () =>
				all(".item-summary a")
					.filter((link) => text(link).startsWith("Part of "))
					.map((link) => ({ href: link.getAttribute("href"), name: text(link) })),
			),
		itemKind: () => read("the reader reads the item's kind", () => text(document.querySelector(".item-summary > div > span")) || "none"),
		itemUpdated: () =>
			read("the reader reads when the item last changed", () => {
				const updated = document.querySelector("[data-item-updated]");
				if (!updated) {
					return "none";
				}
				const shown = updated.cloneNode(true);
				if (shown instanceof Element) {
					for (const time of shown.querySelectorAll("time")) {
						time.replaceWith("<time>");
					}
				}
				const before = updated.previousElementSibling;
				return { follows: text(before?.querySelector("a") ?? before), text: text(shown) };
			}),
		lastHeading: () =>
			read("the reader reads the last heading of the document", () => text(all("#doc article.doc :is(h2, h3, h4)").at(-1)) || "none"),
		loadingPage: () =>
			read("the reader reads the page's loading state", () => {
				const shape = document.querySelector<HTMLElement>("#doc [data-loading-shape]");
				return shape ? { message: text(document.querySelector("#doc [role=status]")), shape: shape.dataset.loadingShape } : "none";
			}),
		markdownError: () => read("the reader reads why Markdown is missing", () => text(document.querySelector("#doc [data-markdown-error]")) || "none"),
		metadataProblems: () => read("the reader reads the listed metadata problems", () => all(".metadata-problems li").map((problem) => text(problem))),
		missingPage: () =>
			read("the reader reads the page that says nothing was found", () => {
				const empty = document.querySelector("main [data-slot=empty]");
				return empty
					? {
							description: text(empty.querySelector("[data-slot=empty-description]")),
							links: all("a", empty).map(linkPair),
							title: text(empty.querySelector("[data-slot=empty-title]")),
						}
					: "none";
			}),
		navigateTo: (path: string) =>
			Effect.gen(function* () {
				tell(`the reader goes to ${path}`);
				const router = engine.router;
				if (!router) {
					return yield* Effect.die(new Error("The screen has no router"));
				}
				yield* Effect.promise(() => act(async () => router.history.push(path)));
				yield* readingSettles(engine, tell);
			}),
		openOutlineMenu: () =>
			perform("the reader opens the On this page menu", outlineTrigger, "The page has no On this page menu", (trigger) => trigger.click()),
		openSearchResult: (query: string, href: string) =>
			Effect.gen(function* () {
				yield* search.openSearch();
				yield* search.searchFor(query);
				yield* perform(
					`the reader opens the result that links to ${href}`,
					() => all('[cmdk-list] [role="option"] a').find((link) => link.getAttribute("href") === href),
					`Search lists no result linking to ${href}`,
					(link) => link.click(),
				);
			}),
		openSection: (summary: string) =>
			perform(
				`the reader opens the ${summary} section`,
				() => all("#doc details").find((details) => text(details.querySelector("summary")) === summary),
				`The page has no ${summary} section`,
				(details) => {
					if (details instanceof HTMLDetailsElement) {
						details.open = true;
						details.dispatchEvent(new Event("toggle"));
					}
				},
			),
		openSections: () =>
			read("the reader reads which folded sections are open", () =>
				all("#doc details")
					.filter((details) => details instanceof HTMLDetailsElement && details.open)
					.map((details) => text(details.querySelector("summary"))),
			),
		outline: () =>
			read("the reader reads the document outline", () => {
				const outline = document.querySelector("nav.document-outline");
				return outline ? { links: all("a", outline).map((link) => link.getAttribute("href")), within: place(outline) } : "none";
			}),
		outlineEntry: (href: string) =>
			read(`the reader reads the outline entry for ${href}`, () => text(document.querySelector(`nav.document-outline a[href="${href}"]`)) || "none"),
		outlineMenu: () =>
			read("the reader looks at the On this page menu", () => {
				if (!outlineTrigger()) {
					return "none";
				}
				const popover = outlinePopover();
				return popover ? all("a", popover).map((link) => link.getAttribute("href")) : "closed";
			}),
		passageVisibility: (id: string) =>
			read(`the reader looks for the passage ${id}`, () => {
				const passage = document.getElementById(id);
				if (!passage) {
					return "missing";
				}
				return passage.closest("[hidden]") ? "hidden" : `shown in ${place(passage)}`;
			}),
		readerFocus: () =>
			read("the reader checks where keyboard focus is", () => {
				const focused = document.activeElement;
				if (!focused || focused === document.body) {
					return "nothing";
				}
				if (focused.id === shellIds.doc) {
					return "the page";
				}
				const { name, role } = accessibleOf(focused);
				return name ? `${role} ${name}` : `#${focused.id}`;
			}),
		releaseReadiness: () =>
			Effect.gen(function* () {
				tell("the document reports it is ready for navigation");
				const release = document.querySelector<HTMLElement>("[data-release-reading]");
				if (!release) {
					return yield* Effect.die(new Error("The page has no readiness to release"));
				}
				yield* Effect.promise(() => act(async () => release.click()));
				yield* framesSettle(engine, tell);
			}),
		reloadReading: () =>
			Effect.gen(function* () {
				tell("the reader reloads the page, which the browser opens at its top with the same history entry");
				const view = engine.view;
				const router = engine.router;
				if (!(view && router)) {
					return yield* Effect.die(new Error("The screen has no routed page to reload"));
				}
				const { href, state } = router.state.location;
				yield* Effect.promise(() => act(async () => window.dispatchEvent(new Event("pagehide"))));
				yield* Effect.promise(() => view.unmount());
				window.history.replaceState({ workBoard: { id: state.key } }, "");
				engine.scrollPosition = 0;
				const reopened = yield* Effect.promise(() =>
					renderRouter(
						engine.files,
						href,
						screenOptions(engine, engine.options),
						(api) => screenClient(engine, api),
						(node) => screenContent(engine, node),
					),
				);
				engine.router = reopened.router;
				trackScreen(engine, reopened, tell);
				yield* readingSettles(engine, tell);
			}),
		rememberedSelection: () =>
			read("the reader reads which passage selection the page remembered", () => {
				const { selection } = remembered();
				return selection ? { from: selection.a, to: selection.f } : "none";
			}),
		rememberReading: () =>
			read("the page remembers the reader's place", () => {
				const captured = captureReading();
				if (!captured) {
					throw new Error("The page has no document to remember");
				}
				rememberedReadings.set(engine, captured);
			}),
		responseForm: () => read("the reader looks for the answer form", () => (document.querySelector("#response-form") ? "shown" : "none")),
		responseHistory: () =>
			read("the reader reads the answer history", () => {
				const history = document.querySelector("#response-history");
				return history ? { heading: text(history.querySelector("h2")), text: text(history) } : "none";
			}),
		restoreRememberedReading: () =>
			read("the page restores the remembered place", () => {
				restoreReading(remembered());
			}),
		restoreSavedReading: (scroll: readonly [number, number], hash: string) =>
			Effect.gen(function* () {
				motion.queueReading({ scroll: [...scroll], selection: null }, hash);
				yield* framesSettle(engine, tell);
			}),
		rewriteDocument: (file: string, source: string) =>
			Effect.gen(function* () {
				data.editFile(file, source);
				const location = engine.router?.state.location;
				yield* Effect.promise(() => data.refreshDocument(location && `${location.pathname}${location.searchStr}`));
				yield* readingSettles(engine, tell);
			}),
		scrollReading: (offset: number) =>
			Effect.gen(function* () {
				yield* Effect.promise(async () => reading.scrollDocument(offset));
				yield* readingSettles(engine, tell);
			}),
		searchOutput: () => read("the reader reads the search result", () => text(document.querySelector("output")) || "none"),
		shownPage: () =>
			read("the reader reads which page is shown", () => {
				const title = text(document.querySelector("#doc h1"));
				const empty = document.querySelector("main [data-slot=empty]");
				if (title || !empty) {
					return title || "none";
				}
				return `${text(empty.querySelector("[data-slot=empty-title]"))}: ${text(empty.querySelector("[data-slot=empty-description]"))}`;
			}),
		sourcePanel: () =>
			read("the reader looks at the Source tab's panel", () => {
				const source = document.querySelector("[data-document-source]");
				return source && source.closest("[hidden]") === null ? text(source) : "hidden";
			}),
		statusAnnouncement: () =>
			read("the reader reads the item header's status announcement", () => {
				const region = document.querySelector(".item-summary > [role=status]");
				if (!region) {
					return "none";
				}
				const first = statusRegions.get(engine) ?? region;
				statusRegions.set(engine, first);
				return { region: first === region ? "original" : "replaced", text: text(region) };
			}),
		workspaceAnswers: () =>
			Effect.gen(function* () {
				yield* Effect.promise(() => availability.releaseWorkspace());
				yield* readingSettles(engine, tell);
			}),
	};
}
