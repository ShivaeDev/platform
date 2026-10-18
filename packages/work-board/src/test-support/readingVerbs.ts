import { Effect } from "effect";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import { fileUrl } from "#files/url.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { rawGet } from "./board.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { renderRemaining } from "./renderRemaining.tsx";
import { type BoardEngine, served } from "./storyEngine.ts";

export function readingVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		activeDiagnosticsPolls: () => {
			tell("the reader observes the active diagnostics polling timers");
			if (!engine.activeDiagnosticsPolls) {
				throw new Error("Diagnostics polling was not instrumented");
			}
			return engine.activeDiagnosticsPolls();
		},
		getPage: (path: string, host?: string) => {
			tell(`a local reader requests ${path}`);
			return rawGet(served(engine).board, path, host);
		},
		pollDiagnostics: () => {
			tell("the diagnostics polling timer fires");
			if (!engine.pollDiagnostics) {
				throw new Error("The diagnostics polling timer has not started");
			}
			engine.pollDiagnostics();
		},
		readBoard: (file: string) =>
			Effect.promise(() => {
				tell(`the reader opens the heading board ${file}`);
				const { client } = served(engine);
				return client.run(client.api.board.run({ url: fileUrl(file) }));
			}),
		readDocument: (file: string) =>
			Effect.promise(() => {
				tell(`the reader requests ${file} through the board`);
				const { client } = served(engine);
				return client.run(client.api.document.run({ url: fileUrl(file) }));
			}),
		renderDocument: Effect.fn("Story.renderDocument")(function* (file: string) {
			tell(`the server renders the board's document ${file}`);
			const { client } = served(engine);
			const document = yield* Effect.promise(() => client.run(client.api.document.run({ url: fileUrl(file) })));
			return yield* renderMarkdown(document.source, {
				file: document.file,
				headings: documentHeadings(),
				questionActions: new Map(Object.entries(document.questionActions)),
			}).pipe(Effect.provide(Highlighter.layer));
		}),
		restartDiagnostics: (snapshot: DiagnosticsSnapshot) => {
			tell("the diagnostics daemon starts listening again");
			if (!engine.fleetPort) {
				throw new Error("No diagnostics daemon port was configured");
			}
			return diagnosticsDaemon(() => snapshot, engine.fleetPort);
		},
		search: (query: string) =>
			Effect.promise(() => {
				tell(`the reader searches for ${JSON.stringify(query)}`);
				const { client } = served(engine);
				return client.run(client.api.search.run({ query }));
			}),
		systemHtml: () =>
			Effect.promise(() => {
				tell("the reader reads System through HTTP RPC");
				return renderRemaining(served(engine).board.url, "/_board/system", engine.readAt);
			}),
	};
}
