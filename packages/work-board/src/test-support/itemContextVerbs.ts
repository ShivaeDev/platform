import { Effect, Order } from "effect";
import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

type Direction = "links-to" | "linked-from";

function group(direction: Direction) {
	return document.querySelector<HTMLElement>(`[data-context-group="${direction}"]`);
}

function linkOf(entry: Element) {
	const link = entry.querySelector("a");
	return {
		name: link?.textContent ?? entry.textContent,
		...(link ? { href: link.getAttribute("href") } : {}),
		...(entry.querySelector("[data-status-token]") ? { status: entry.querySelector("[data-status-token]")?.textContent } : {}),
		...(link?.getAttribute("title") ? { source: link.getAttribute("title") } : {}),
	};
}

export function itemContextVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		contextGroups: () =>
			Effect.sync(() => {
				tell("the reader reads the order of the item's link groups");
				return [
					...document.querySelectorAll<HTMLElement>('[data-context-group="links-to"], [data-slot="separator"], [data-context-group="linked-from"]'),
				].map((node) => node.dataset.contextGroup ?? "separator");
			}),
		contextHeading: (direction: Direction) =>
			Effect.sync(() => {
				tell(`the reader reads the heading of ${direction}`);
				return group(direction)?.querySelector("h3")?.textContent;
			}),
		contextKinds: (direction: Direction) =>
			Effect.sync(() => {
				tell(`the reader reads the kinds of link under ${direction}`);
				return [...(group(direction)?.querySelectorAll("h4") ?? [])].map((heading) => heading.textContent).sort(Order.String);
			}),
		contextLinks: (direction: Direction, kind?: string) =>
			Effect.sync(() => {
				tell(`the reader reads the ${kind ?? "listed"} links under ${direction}`);
				const scope = kind === undefined ? group(direction) : group(direction)?.querySelector(`[data-source-group="${kind}"]`);
				return [...(scope?.querySelectorAll("li") ?? [])].map(linkOf);
			}),
		criterion: (id: string) =>
			Effect.sync(() => {
				tell(`the reader looks for criterion ${id}`);
				const criterion = document.getElementById(`criterion-${id}`);
				if (!criterion) {
					return "missing";
				}
				return criterion.closest("details, [hidden]") === null ? `shown: ${criterion.textContent}` : `folded: ${criterion.textContent}`;
			}),
		itemSource: () =>
			Effect.sync(() => {
				tell("the reader looks at the item's source panel");
				const source = document.querySelector("[data-document-source]");
				if (!source || source.closest("[hidden]") !== null) {
					return "hidden";
				}
				return { file: source.querySelector("code")?.textContent, source: source.querySelector("pre")?.textContent };
			}),
		openSourceTab: () =>
			Effect.gen(function* () {
				tell("the reader opens the Source tab");
				const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((candidate) => candidate.textContent === "Source");
				if (!tab) {
					return yield* Effect.die(new Error("The item has no Source tab"));
				}
				yield* Effect.promise(() => act(async () => tab.click()));
				yield* screenSettles(engine, tell);
			}),
	};
}
