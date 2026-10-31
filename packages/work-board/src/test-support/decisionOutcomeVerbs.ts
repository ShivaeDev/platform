import { Effect } from "effect";

const OUTCOME = "article.doc > [data-decision-outcome]";

export function decisionOutcomeVerbs(tell: (line: string) => void) {
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	return {
		decisionOutcome: () =>
			read("the reader reads the decision's Outcome", () => {
				const outcome = document.querySelector<HTMLElement>(OUTCOME);
				if (!outcome) {
					return "none";
				}
				return {
					answers: [...outcome.querySelectorAll<HTMLElement>("[data-outcome-answer]")].map((answer) => {
						const lines = [...answer.children];
						const by = lines.at(-1);
						return {
							at: Number(by?.querySelector("time")?.dataset.modified),
							by: by?.querySelector("a")?.textContent,
							choice: lines[0]?.textContent,
							file: by?.querySelector("a")?.getAttribute("href"),
							notes: lines.slice(1, -1).map((note) => note.textContent),
						};
					}),
					heading: outcome.querySelector("h2")?.textContent,
					leadsDocument: outcome.parentElement?.firstElementChild === outcome,
					message: outcome.querySelector(":scope > p")?.textContent ?? "none",
				};
			}),
		documentFences: () =>
			read("the reader reads the fenced blocks in the document and how they are styled", () =>
				[...document.querySelectorAll<HTMLElement>("article.doc pre")].map(
					(fence) => `${fence.textContent?.trim()} (${fence.className === "" ? "plain text" : `styled ${fence.className}`})`,
				),
			),
		documentSections: () =>
			read("the reader reads the document's section headings", () =>
				[...document.querySelectorAll("article.doc h2")].map((heading) => heading.textContent),
			),
		pageHeading: () => read("the reader reads the page heading", () => document.querySelector("h1")?.textContent ?? "none"),
	};
}
