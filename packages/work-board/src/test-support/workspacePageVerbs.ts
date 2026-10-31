import { Effect } from "effect";
import { rawGet } from "./board.ts";
import { type BoardEngine, served } from "./storyEngine.ts";
import { parsedHtml, text, workspaceReads } from "./workspaceReads.ts";

export function workspacePageVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { search, rendered, system, card, work } = workspaceReads(engine);
	return {
		criterionLinks: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the results that link to a criterion`);
				return answer.results.map((entry) => entry.href).filter((href) => href.includes("#criterion-"));
			}),
		dataInSnippets: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and looks for front matter or JSON fields in the snippets`);
				if (answer.results.length === 0) {
					return "no results";
				}
				return answer.results
					.map((entry) => entry.snippet)
					.filter((snippet) => /^(?:\{|---)/u.test(snippet) || /(?:id|kind|next_action|reviewedRevision|question):/u.test(snippet));
			}),
		firstResult: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the first result`);
				return answer.results[0];
			}),
		githubResources: () =>
			Effect.map(card("github"), (github) => {
				tell("the reader reads each GitHub resource on System");
				return Object.fromEntries(
					[...(github?.querySelectorAll("[data-resource]") ?? [])].map((row) => [row.getAttribute("data-resource"), text(row)]),
				);
			}),
		rankedResults: (query: string, count = 40) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the first ${count} ranked results`);
				return answer.results
					.slice(0, count)
					.map((entry) => `${entry.kind === "document" && entry.itemKind ? "item" : entry.kind} ${entry.id ?? entry.href}`);
			}),
		renderedAttributes: (file: string, selector: string, attribute: string) =>
			Effect.map(rendered(file), (html) => {
				tell(`the server renders ${file} and the reader reads ${attribute} of each ${selector}`);
				return [...parsedHtml(html).querySelectorAll(selector)].map((element) => element.getAttribute(attribute));
			}),
		renderedElements: (file: string, selector: string) =>
			Effect.map(rendered(file), (html) => {
				tell(`the server renders ${file} and the reader reads the attributes of each ${selector}`);
				return [...parsedHtml(html).querySelectorAll(selector)].map((element) =>
					Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value])),
				);
			}),
		renderedMarkup: (file: string) =>
			Effect.map(rendered(file), (html) => {
				tell(`the server renders ${file}`);
				return html;
			}),
		renderedText: (file: string) =>
			Effect.map(rendered(file), (html) => {
				tell(`the server renders ${file} and the reader reads its text`);
				return text(parsedHtml(html));
			}),
		renderedTexts: (file: string, selector: string) =>
			Effect.map(rendered(file), (html) => {
				tell(`the server renders ${file} and the reader reads each ${selector}`);
				return [...parsedHtml(html).querySelectorAll(selector)].map(text);
			}),
		resultCount: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and counts the results returned`);
				return answer.results.length;
			}),
		resultIds: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the item results' identities`);
				return answer.results.filter((entry) => entry.kind === "document" && entry.id !== undefined).map((entry) => entry.id);
			}),
		resultKinds: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the kind of each result`);
				return answer.results.map((entry) => entry.kind);
			}),
		resultLines: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the source line of each result`);
				return answer.results.map((entry) => entry.line ?? "no line");
			}),
		resultMatches: (query: string, count = 40) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads how each of the first ${count} results matched`);
				return answer.results.slice(0, count).map((entry) => `${entry.match} ${entry.file}`);
			}),
		resultSources: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads which files the results come from`);
				return [...new Set(answer.results.map((entry) => entry.file))];
			}),
		resultsFrom: (query: string, file: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the results from ${file}`);
				return answer.results.filter((entry) => entry.file === file);
			}),
		searchResults: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)}`);
				return answer.results;
			}),
		searchSnippets: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the snippet of each result by file`);
				return Object.fromEntries(answer.results.map((entry) => [entry.file, entry.snippet]));
			}),
		searchTotal: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads the number of matches`);
				return answer.total;
			}),
		shownSnippets: (query: string) =>
			Effect.map(search(query), (answer) => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads every snippet that shows text`);
				return answer.results.map((entry) => entry.snippet).filter((snippet) => snippet !== "");
			}),
		systemCardFacts: (source: string) =>
			Effect.map(card(source), (found) => {
				tell(`the reader reads the labelled facts on the ${source} card`);
				return Object.fromEntries([...(found?.querySelectorAll("dt") ?? [])].map((term) => [text(term), text(term.nextElementSibling)]));
			}),
		systemCardLimits: (source: string) =>
			Effect.map(card(source), (found) => {
				tell(`the reader reads each limit on the ${source} card`);
				return Object.fromEntries([...(found?.querySelectorAll("h3") ?? [])].map((heading) => [text(heading), text(heading.nextElementSibling)]));
			}),
		systemCards: () =>
			Effect.map(system(), (page) => {
				tell("the reader reads the state of each System source card");
				return Object.fromEntries(
					[...page.querySelectorAll("[data-source]")].map((source) => [source.getAttribute("data-source"), source.getAttribute("data-state")]),
				);
			}),
		systemCardText: (source: string) =>
			Effect.map(system(), (page) => {
				tell(`the reader reads the ${source} card on System`);
				return text(page.querySelector(`[data-source="${source}"]`));
			}),
		systemCardTimes: (source: string) =>
			Effect.map(card(source), (found) => {
				tell(`the reader reads each time on the ${source} card with its machine-readable instant`);
				return [...(found?.querySelectorAll("time") ?? [])].map((time) => `${text(time)} at ${time.getAttribute("datetime")}`);
			}),
		systemFacts: () =>
			Effect.map(system(), (page) => {
				tell("the reader reads the labelled facts on System");
				return Object.fromEntries([...page.querySelectorAll("dt")].map((term) => [text(term), text(term.nextElementSibling)]));
			}),
		systemPageStatus: (host?: string) =>
			Effect.map(rawGet(served(engine).board, "/_board/system", host), (response) => {
				tell(`a reader${host ? ` addressing the board as ${host}` : ""} requests System`);
				return response.status;
			}),
		systemRegions: () =>
			Effect.map(system(), (page) => {
				tell("the reader reads the labelled regions on System");
				return [...page.querySelectorAll("article[aria-label]")].map((region) => region.getAttribute("aria-label"));
			}),
		systemText: () =>
			Effect.map(system(), (page) => {
				tell("the reader reads System");
				return text(page);
			}),
		workItem: (id: string) =>
			Effect.map(work("/_board/work"), (read) => {
				tell(`the reader reads ${id} on Work`);
				return read.items.find((entry) => entry.id === id) ?? "not listed";
			}),
		workRowIds: (url: string) =>
			Effect.map(work(url), (read) => {
				tell(`the reader opens ${url} and reads the rows`);
				return read.rows.map((row) => row.id);
			}),
		workSelection: (url: string) =>
			Effect.map(work(url), (read) => {
				tell(`the reader opens ${url} and reads the selected item`);
				return read.selected ? { file: read.selected.file, outsideFilter: read.selectedOutside } : "nothing selected";
			}),
		workState: (url: string) =>
			Effect.map(work(url), (read) => {
				tell(`the reader opens ${url} and reads the view state the board settled on`);
				return read.state;
			}),
	};
}
