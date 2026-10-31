import { Effect } from "effect";
import { openPage } from "./browser.ts";
import { metadataScreen } from "./metadataScreen.tsx";
import { pageSettlesOn, pageTrafficScripts } from "./pageSignals.ts";
import { type BoardEngine, connected, rememberReader } from "./storyEngine.ts";

const GOAL_CHART = /\/GoalChart-[\w-]+\.js$/u;

function progress(value: unknown) {
	if (typeof value !== "object" || value === null || !("read" in value)) {
		return "none";
	}
	return `${value.read} of ${"total" in value ? value.total : undefined}`;
}

export function pagesBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function page() {
		return connected(engine).page;
	}
	function settles() {
		return pageSettlesOn(engine, tell, "the page has an answer to every RPC request it sent", () => true);
	}
	return {
		goalChartChunks: () =>
			Effect.sync(() => {
				tell("the reader checks whether the page loaded the goal chart's code");
				return page().chunkRequests.some((chunk) => GOAL_CHART.test(chunk)) ? "loaded" : "not loaded";
			}),
		indexingReaches: (read: number, total?: number) =>
			pageSettlesOn(
				engine,
				tell,
				`the page receives indexing progress of ${read} ${total === undefined ? "files of an unknown total" : `of ${total} files`} and settles`,
				(answers) => answers.some(({ tag, value }) => tag === "work-board.indexing" && progress(value) === `${read} of ${total}`),
			),
		pageReceives: (method: string) =>
			pageSettlesOn(engine, tell, `the page receives a new ${method} answer and settles`, (answers, since) =>
				answers.slice(since).some(({ tag }) => tag === `work-board.${method}`),
			),
		pageSettles: settles,
		readerOpens: (path: string) =>
			Effect.gen(function* () {
				tell(`the reader opens ${path}`);
				yield* Effect.promise(() => page().close());
				connected(engine).page = yield* openPage(connected(engine).board, path, pageTrafficScripts(engine));
				yield* rememberReader(engine);
				yield* settles();
			}),
		requestsByMethod: () =>
			Effect.gen(function* () {
				yield* settles();
				tell("the reader counts the page's RPC requests by method");
				return Object.fromEntries(
					Map.groupBy(
						page().pageRequests.methods.filter((method) => !method.endsWith(".$changes")),
						(method) => method.replace(/^work-board\./u, ""),
					)
						.entries()
						.map(([method, calls]) => [method, calls.length]),
				);
			}),
		sourceDiagnosticsOf: (file: string) =>
			Effect.gen(function* () {
				tell(`the reader reads the source diagnostics of ${file}`);
				const view = yield* metadataScreen(engine, file);
				return {
					problems: [...view.container.querySelectorAll("li")].map((problem) => problem.textContent),
					status: view.container.querySelector('[role="status"]')?.textContent,
				};
			}),
		startupScreen: () =>
			Effect.sync(() => {
				tell("the reader reads the page heading, indexing progress, live status and needs-you badges");
				const document = page().document;
				return {
					heading: document.querySelector("#doc h1")?.textContent ?? "none",
					indexing: document.querySelector('#doc [data-indexing] [data-slot="progress-label"]')?.textContent ?? "none",
					live: document.getElementById("live")?.textContent,
					needsYou: ["inbox-count", "inbox-topbar-count"].map((id) => document.getElementById(id)?.textContent),
				};
			}),
	};
}
