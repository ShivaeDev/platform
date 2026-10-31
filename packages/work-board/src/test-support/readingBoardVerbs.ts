import { Effect, Order, Schedule } from "effect";
import { entryModules } from "./entryModules.ts";
import { type BoardEngine, connected } from "./storyEngine.ts";

const PAGE_LIMIT = "10 seconds";
const PACKAGE = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?<name>(?:@[^/]+\/)?[^/]+)/u;
const CHUNK = /^\/_board\/react-assets\/(?<family>[A-Za-z]+)-[\w-]+\.js$/u;

function chunkFamilies(engine: BoardEngine) {
	return connected(engine).page.chunkRequests.flatMap((chunk) => CHUNK.exec(chunk)?.groups?.family ?? []);
}

export function readingBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	// The bundle page offers no event for its own rendering or for chunk fetches, so these waits sample what the page records.
	function sampled(signal: string, check: () => boolean) {
		return Effect.sync(() => tell(`wait until ${signal}`)).pipe(
			Effect.andThen(
				Effect.sync(check).pipe(
					Effect.flatMap((done) => (done ? Effect.void : Effect.fail("waiting" as const))),
					Effect.retry(Schedule.spaced("10 millis")),
					Effect.timeoutOrElse({ duration: PAGE_LIMIT, orElse: () => Effect.die(new Error(`The bundle page never reached: ${signal}`)) }),
				),
			),
		);
	}
	return {
		chunkArrives: (family: string) => sampled(`the page fetches its ${family} chunk`, () => chunkFamilies(engine).includes(family)),
		chunkFetched: (family: string) =>
			Effect.sync(() => {
				tell(`the reader checks how often the page fetched its ${family} chunk`);
				const count = chunkFamilies(engine).filter((fetched) => fetched === family).length;
				if (count === 0) {
					return "not fetched";
				}
				return count === 1 ? "fetched once" : `fetched ${count} times`;
			}),
		firstPageLibraries: () =>
			Effect.gen(function* () {
				tell("the reader lists the libraries bundled into the first page's chunks");
				const modules = yield* Effect.promise(entryModules);
				if (!modules.some((id) => id.endsWith("src/client/react/entry.tsx"))) {
					return yield* Effect.die(new Error("The first page's chunks do not contain the client entry"));
				}
				return [...new Set(modules.flatMap((id) => PACKAGE.exec(id)?.groups?.name ?? []))].sort(Order.String);
			}),
		mermaidLoads: () =>
			Effect.sync(() => tell("wait until the page fetches Mermaid")).pipe(
				Effect.andThen(Effect.promise(() => connected(engine).page.mermaidRequested)),
			),
		mermaidModules: () =>
			Effect.sync(() => {
				tell("the reader lists the Mermaid modules the page fetched");
				const { board, page } = connected(engine);
				return page.mermaidRequests.map((request) => request.replace(board.url, ""));
			}),
		pageShows: (route: string) =>
			sampled(
				`the page marks ${route} as rendered`,
				() => connected(engine).page.document.getElementById("doc")?.getAttribute("data-route") === route,
			),
	};
}
