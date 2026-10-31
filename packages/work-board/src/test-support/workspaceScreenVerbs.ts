import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { semanticElement } from "./semanticElement.ts";

const RENDER_LIMIT_MS = 10_000;

function blockText(block: Element) {
	if (block.tagName === "UL" || block.tagName === "OL") {
		return [...block.querySelectorAll("li")].map((item) => item.textContent?.trim()).join(" | ");
	}
	return block.textContent?.trim() ?? "";
}

export function workspaceScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function root() {
		return engine.container ?? document.body;
	}
	function reference() {
		if (!engine.referenceMarkup) {
			throw new Error("The story has no server rendering to compare; add the serverMarkup trait");
		}
		return engine.referenceMarkup;
	}
	function settled<A>(line: string, read: () => A) {
		return Effect.gen(function* () {
			yield* screenSettles(engine, tell);
			tell(line);
			return read();
		});
	}
	return {
		answerLinks: () =>
			settled("the reader reads where each answer link points", () =>
				[...root().querySelectorAll(".questionnaire-answer")].map((link) => link.getAttribute("href")),
			),
		boardHead: () =>
			settled("the reader reads the board's heading and column counts", () => ({
				counts: root().querySelector(".board-head .counts")?.textContent ?? "none",
				title: root().querySelector(".board-head h1")?.textContent ?? "none",
			})),
		detailsStates: () =>
			settled("the reader reads which details blocks are open", () =>
				[...root().querySelectorAll("details")].map((details) => `${details.textContent}: ${details.open ? "open" : "closed"}`),
			),
		documentStructure: (index: number) =>
			settled(`the reader reads the titles of document ${index + 1} and the headings inside its details blocks`, () => {
				const article = root().querySelectorAll("article.doc")[index];
				return {
					headingsInDetails: [...(article?.querySelectorAll("details h1, details h2, details h3") ?? [])].map((heading) => heading.textContent),
					titles: [...(article?.querySelectorAll("h1") ?? [])].map((title) => title.textContent),
				};
			}),
		// A document view without its layout marks no point where its last section has rendered, so the story names the element that section brings.
		documentsShow: (selector: string) =>
			Effect.gen(function* () {
				tell(`wait until every document on screen shows ${selector}`);
				function pending() {
					const articles = [...root().querySelectorAll("article.doc")];
					return articles.length === 0
						? root().querySelector(selector) === null
						: articles.some((article) => article.querySelector(selector) === null);
				}
				yield* screenDriver({ act: (action) => act(action), pending, root: () => document.body, tell }).settle({ timeoutMs: RENDER_LIMIT_MS });
			}),
		footnotes: () =>
			settled("the reader follows each footnote reference to its note", () =>
				[...root().querySelectorAll("a[data-footnote-ref]")].map((link) => {
					const target = link.getAttribute("href") ?? "";
					const note = root().querySelector(`[id="${target.slice(1)}"]`);
					return { note: note?.textContent?.trim() ?? "missing", target };
				}),
			),
		headingLinks: () =>
			settled("the reader reads each heading's id and its self-links", () =>
				[...root().querySelectorAll("h1, h2, h3")].map((heading) => ({
					id: heading.id,
					links: [...heading.querySelectorAll(".heading-anchor")].map((anchor) => anchor.getAttribute("href")),
				})),
			),
		linkTargets: (text: string) =>
			settled(`the reader reads where the "${text}" links point`, () =>
				[...root().querySelectorAll("a")].filter((link) => link.textContent === text).map((link) => link.getAttribute("href")),
			),
		readerOpensDetails: (index: number) =>
			Effect.gen(function* () {
				yield* screenSettles(engine, tell);
				tell(`the reader opens details block ${index + 1}`);
				const details = root().querySelectorAll("details")[index];
				if (!details) {
					throw new Error(`The document has no details block ${index + 1}`);
				}
				yield* Effect.promise(() =>
					act(() => {
						details.open = true;
						details.dispatchEvent(new Event("toggle"));
						return Promise.resolve();
					}),
				);
				yield* screenSettles(engine, tell);
			}),
		renderedBesideServer: (selector: string) =>
			settled(`the reader compares the client's ${selector} with the server's`, () => ({
				client: [...(root().querySelector("article")?.querySelectorAll(selector) ?? [])].map(semanticElement),
				server: [...reference().querySelectorAll(selector)].map(semanticElement),
			})),
		sectionBlocks: (heading: string) =>
			settled(`the reader reads the blocks under the "${heading}" heading`, () => {
				const start = [...document.querySelectorAll("article.doc h2")].find((candidate) => candidate.textContent === heading);
				if (!start) {
					return "no such section";
				}
				const blocks: string[] = [];
				for (let block = start.nextElementSibling; block && block.tagName !== "H2"; block = block.nextElementSibling) {
					blocks.push(`${block.tagName.toLowerCase()}: ${blockText(block)}`);
				}
				return blocks;
			}),
		sectionedBesideWhole: () =>
			settled("the reader compares the blocks of the sectioned document with those of the whole document", () => {
				const [sectioned, whole] = [...root().querySelectorAll("article.doc")].map((article) =>
					[...article.children].map((block) => block.outerHTML),
				);
				return { sectioned, whole };
			}),
		textBesideServer: (selector: string) =>
			settled(`the reader compares the client's ${selector} text with the server's`, () => ({
				client: root().querySelector(selector)?.textContent ?? "missing",
				server: reference().querySelector(selector)?.textContent ?? "missing",
			})),
	};
}
