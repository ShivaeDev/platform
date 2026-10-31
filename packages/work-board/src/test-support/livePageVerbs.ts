import { Effect } from "effect";
import { openPage } from "./browser.ts";
import { paragraphOf } from "./live.ts";
import { pageMutation } from "./packetPageVerbs.ts";
import { type BoardEngine, connected, rememberReader, served } from "./storyEngine.ts";

export function livePageVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const marks: { paragraphs: Map<string | null, unknown>; reads: Record<string, number> } = { paragraphs: new Map(), reads: {} };
	function readCounts(): Record<string, number> {
		return Object.fromEntries(
			[...Map.groupBy(connected(engine).page.pageRequests.calls, ({ tag }) => tag)].map(([tag, calls]) => [tag, calls.length]),
		);
	}
	return {
		detailsState: (index: number) =>
			Effect.sync(() => {
				tell(`the reader looks at details block ${index + 1}`);
				const details = connected(engine).page.document.querySelectorAll("#doc article details")[index];
				if (details === undefined) {
					return "missing";
				}
				return details.hasAttribute("open") ? "open" : "closed";
			}),
		liveStatus: () => {
			tell("the reader observes the page's live status");
			return connected(engine).page.document.getElementById("live")?.textContent;
		},
		openDetails: (index: number) => {
			tell(`the reader expands details block ${index + 1}`);
			const details = connected(engine).page.document.querySelectorAll("#doc article details")[index];
			if (!details) {
				throw new Error(`Missing details block ${index + 1}`);
			}
			details.setAttribute("open", "");
		},
		openLivePage: Effect.fn("Story.openLivePage")(function* (path: string) {
			tell(`the reader opens the live page ${path} and waits until it is live and shows its document`);
			const { board, client } = served(engine);
			const page = yield* openPage(board, path);
			yield* pageMutation(
				page,
				"the page is live and shows its document",
				() =>
					page.document.getElementById("live")?.getAttribute("data-state") === "live"
					&& page.document.querySelector("article.doc[data-source]") !== null,
			);
			engine.live = { board, client, page };
			yield* rememberReader(engine);
		}),
		pageMarked: () => {
			tell("the reader marks the open page and notes its paragraphs");
			const { page } = connected(engine);
			page.document.body.dataset.visit = "marked";
			marks.paragraphs = new Map([...page.document.querySelectorAll("#doc p")].map((element) => [element.textContent, element]));
			marks.reads = readCounts();
		},
		pageReadsSinceMark: () =>
			Effect.sync(() => {
				tell("the reader counts the page's reads since the mark");
				const before = marks.reads;
				return Object.fromEntries(
					Object.entries(readCounts())
						.filter(([tag, count]) => !tag.endsWith(".$changes") && count !== (before[tag] ?? 0))
						.map(([tag, count]) => [tag, count - (before[tag] ?? 0)]),
				);
			}),
		pageReloaded: () =>
			Effect.sync(() => {
				tell("the reader checks whether the page kept its mark");
				return connected(engine).page.document.body.dataset.visit === "marked" ? "same page" : "reloaded";
			}),
		pageShowing: (text: string) => {
			tell(`the reader waits for the open page to show ${JSON.stringify(text)}`);
			const { page } = connected(engine);
			return Effect.as(
				pageMutation(page, `the page shows ${JSON.stringify(text)}`, () => page.document.getElementById("doc")?.textContent?.includes(text) === true),
				"showing",
			);
		},
		paragraph: (text: string) => {
			tell(`the reader finds the paragraph ${JSON.stringify(text)}`);
			return paragraphOf(connected(engine).page, text);
		},
		paragraphElement: (text: string) =>
			Effect.sync(() => {
				tell(`the reader compares the paragraph ${JSON.stringify(text)} with the one it noted`);
				const now = paragraphOf(connected(engine).page, text);
				if (now === undefined) {
					return "missing";
				}
				return now === marks.paragraphs.get(text) ? "the element seen before" : "a new element";
			}),
	};
}
