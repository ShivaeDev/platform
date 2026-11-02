import { Deferred, Effect } from "effect";
import { act } from "react";
import { onTestFinished, vi } from "vitest";
import { PENDING_FEEDBACK_MS } from "#client/react/navigationTarget.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { setNativeValue } from "./setNativeValue.ts";
import { accessibleOf, shellActs, shellElement } from "./shellScreenAct.ts";

const ANSWERS: Readonly<Record<string, string>> = { "200": "OK", "404": "Not found", "500": "Server error", "503": "Unavailable" };

function heading() {
	return document.querySelector("#doc [data-page-header] > h1") ?? document.querySelector("#doc h1");
}

export function shellPageVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	let clicked: "the Board handles it" | "the browser follows it" | "nothing clicked" = "nothing clicked";
	return {
		actionControls: () =>
			reading("the reader reads each action control on the page, whether it is a link or a button and where a link goes", () =>
				[...document.querySelectorAll('#doc :is([data-slot="button"], [data-slot="link-button"])')].map((control) => ({
					name: control.textContent?.trim(),
					opens: control.getAttribute("href") ?? "in place",
					role: accessibleOf(control).role,
				})),
			),
		beginOpeningWithHeldRead: (to: string) =>
			Effect.promise(async () => {
				tell(`the reader begins opening ${to}, whose page read waits, before the ${PENDING_FEEDBACK_MS} ms pending-feedback delay passes`);
				if (!(engine.router && engine.heldRead)) {
					throw new Error("The story needs a router and a paused document read");
				}
				Object.assign(engine.heldRead, { gate: Deferred.makeUnsafe<void>(), started: false, startedSignal: Deferred.makeUnsafe<void>() });
				vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
				onTestFinished(() => {
					vi.useRealTimers();
				});
				await act(async () => {
					engine.pendingNavigation = engine.router?.navigate({ to });
					await vi.advanceTimersByTimeAsync(0);
				});
				await Effect.runPromise(Deferred.await(engine.heldRead.startedSignal));
			}),
		boardTaskCount: () => reading("the reader reads the board's task count", () => document.querySelector(".counts")?.textContent),
		breadcrumb: () => reading("the reader reads the breadcrumb", () => document.querySelector("#breadcrumbs")?.textContent),
		browserTitle: () => reading("the reader reads the browser title", () => document.title),
		clickLinkTo: (href: string) =>
			acting(`the reader clicks a plain link to ${href}`, () => {
				const link = document.createElement("a");
				link.href = href;
				document.body.append(link);
				document.addEventListener(
					"click",
					(event) => {
						clicked = event.defaultPrevented ? "the Board handles it" : "the browser follows it";
						event.preventDefault();
					},
					{ once: true },
				);
				try {
					link.click();
				} finally {
					link.remove();
				}
			}),
		currentWorkLayout: () =>
			reading(
				"the reader reads which Work layout is current",
				() => document.querySelector('nav[aria-label="Work layout"] [aria-current="page"]')?.textContent,
			),
		historyEntry: () =>
			reading("the reader reads which browser history entry is current", () => {
				const state: unknown = engine.router?.state.location.state;
				return state !== null && typeof state === "object" && "key" in state ? state.key : undefined;
			}),
		linkClick: () => reading("the reader reads who handled the plain link", () => clicked),
		linkTarget: (name: string) =>
			reading(`the reader reads where the ${name} link goes`, () => {
				const link = [...document.querySelectorAll("#doc a")].find((candidate) => accessibleOf(candidate).name === name);
				return link?.getAttribute("href") ?? "no such link";
			}),
		mainHeading: () => reading("the reader reads the page heading", () => heading()?.textContent ?? "no heading"),
		markShell: () =>
			Effect.sync(() => {
				tell("the story marks the header, the main area and any projection to see whether later steps replace them");
				for (const part of document.querySelectorAll<HTMLElement>("header, main[data-react-document], [data-react-projection]")) {
					part.dataset.storyMark = "kept";
				}
			}),
		navigationStatus: () =>
			reading("the reader reads the header's navigation status", () => {
				const status = shellElement("#navigation-status", "navigation status");
				return { state: status.dataset.state ?? "normal", text: status.textContent };
			}),
		pageAddress: () => reading("the reader reads which address the page shows", () => document.querySelector<HTMLElement>("#doc")?.dataset.route),
		pageAlert: () =>
			reading("the reader reads the page's alert", () => document.querySelector("#doc [data-slot=alert-description]")?.textContent ?? "no alert"),
		pageAnswer: () =>
			reading("the reader reads how the Board answered the page", () => {
				const status = document.querySelector<HTMLElement>("#doc")?.dataset.status ?? "none";
				return ANSWERS[status] ?? status;
			}),
		pageHeaders: () =>
			reading("the reader reads the heading of each page header", () =>
				[...document.querySelectorAll("#doc [data-page-header]")].map((header) => header.querySelector("h1")?.textContent),
			),
		pageKind: () =>
			reading("the reader reads what kind of page the Board shows", () => {
				const page = document.querySelector<HTMLElement>("#doc");
				return page?.dataset.projection ?? (document.querySelector("[data-react-document]") ? "document" : "none");
			}),
		pageNotice: () =>
			reading("the reader reads the page's notice", () => {
				const notice = document.querySelector("#doc [data-slot=empty]");
				if (!notice) {
					return "no notice";
				}
				return {
					description: notice.querySelector("[data-slot=empty-description]")?.textContent,
					links: [...notice.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]),
					retry: [...document.querySelectorAll("#doc button")].some((button) => button.textContent === "Retry") ? "offered" : "not offered",
					title: notice.querySelector("[data-slot=empty-title]")?.textContent,
				};
			}),
		pageOutline: () =>
			reading("the reader reads the page outline", () => [...document.querySelectorAll(".document-outline a")].map((link) => link.textContent)),
		pageRequestsOf: (url: string) =>
			reading(`the reader counts the document reads of ${url}`, () => engine.pageRequests.filter((read) => read === url).length),
		pageText: () => reading("the reader reads the page", () => (document.querySelector("#doc") ?? document.body).textContent),
		pendingFeedback: () =>
			reading("the reader looks for the header's Opening page bar", () =>
				document.querySelector('[role="progressbar"][aria-label="Opening page"]') ? "shown" : "not shown",
			),
		pendingFeedbackDelayAlmostPasses: () =>
			Effect.gen(function* () {
				tell(`${PENDING_FEEDBACK_MS - 1} ms of the pending-feedback delay pass`);
				yield* Effect.promise(() => act(() => vi.advanceTimersByTimeAsync(PENDING_FEEDBACK_MS - 1)));
			}),
		pendingFeedbackDelayPasses: () =>
			Effect.gen(function* () {
				tell(`the ${PENDING_FEEDBACK_MS} ms pending-feedback delay passes`);
				yield* Effect.promise(() => act(() => vi.advanceTimersByTimeAsync(PENDING_FEEDBACK_MS)));
				vi.useRealTimers();
				yield* screenSettles(engine, tell);
			}),
		refreshBoardPage: (url: string) =>
			acting(`the Board refreshes the board page at ${url} and the shell`, () => {
				if (!(engine.api && engine.view)) {
					throw new Error("The Board screen has not opened");
				}
				engine.view.registry.refresh(engine.api.board.query({ url }, routeQueryOptions));
				engine.view.registry.refresh(documentQuery(engine.api, url));
				engine.view.registry.refresh(navigationQuery(engine.api));
			}),
		retryPage: () =>
			acting("the reader clicks Retry", () => {
				const retry = [...document.querySelectorAll<HTMLElement>("#doc button")].find((button) => button.textContent === "Retry");
				if (!retry) {
					throw new Error("The page offers no Retry");
				}
				retry.click();
			}),
		shellParts: () =>
			reading("the reader checks whether the header, main area and projection are the ones marked before", () => {
				function mark(selector: string) {
					const part = document.querySelector<HTMLElement>(selector);
					return part ? (part.dataset.storyMark ?? "replaced") : "none";
				}
				return { header: mark("header"), main: mark("main[data-react-document]"), projection: mark("[data-react-projection]") };
			}),
		typeAnswerAndSelect: (text: string, start: number, end: number, direction: "backward" | "forward") =>
			acting(`the reader types ${JSON.stringify(text)} as an answer and selects characters ${start} to ${end} ${direction}`, () => {
				const field = shellElement<HTMLTextAreaElement>("#response-form textarea", "answer field");
				field.focus();
				setNativeValue(field, text);
				field.dispatchEvent(new Event("input", { bubbles: true }));
				field.setSelectionRange(start, end, direction);
			}),
		workLayoutLinks: () =>
			reading("the reader reads the Work layout links", () =>
				[...document.querySelectorAll("nav[aria-label='Work layout'] a")].map((link) => ({
					current: link.getAttribute("aria-current") ?? "no",
					href: link.getAttribute("href"),
					name: accessibleOf(link).name,
				})),
			),
		workTableShown: () => reading("the reader looks for the Work table", () => (document.querySelector("#work-results table") ? "shown" : "none")),
	};
}
