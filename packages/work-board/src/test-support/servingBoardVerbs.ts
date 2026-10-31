import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Order, Path, PlatformError } from "effect";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { item, needsYou, overview } from "@shivaedev/work-board-plugin/boardTools.ts";
import { fileUrl } from "#files/url.ts";
import { rawExchange, rawGet } from "./board.ts";
import { rpcCall, rpcNavigation, rpcPaths } from "./nativeRpc.ts";
import { readerVerbs } from "./readerVerbs.ts";
import { renderRemaining } from "./renderRemaining.tsx";
import { described, failureMessage, header, servingBoardReads, shellOf, statusPhrase } from "./servingBoardReads.ts";
import type { ServingOptions } from "./servingEngine.ts";
import { servingObservations } from "./servingObservations.ts";
import { type BoardEngine, connected, served } from "./storyEngine.ts";

export function servingBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { documentAt, linked, changeSeen, launched, pluginBoard, pluginTools } = servingBoardReads(engine, tell);
	return {
		buildBundle: (asset: string, build: string) => {
			tell(`the browser bundle ${asset} is built as "${build}"`);
			const source = `export const build = "${build.repeat(400)}";`;
			writeFileSync(join(engine.notes.root, asset), source);
			return source;
		},
		builtAsset: (name: string) => {
			tell(`the reader reads ${name} from the package's built assets`);
			return Effect.sync(() => readFileSync(new URL(`../../assets/${name}`, import.meta.url), "utf8"));
		},
		bundlePage: () =>
			Effect.sync(() => {
				tell("the story asks for its bundle page");
				try {
					connected(engine);
					return "open";
				} catch (error) {
					return `refused: ${error instanceof Error ? error.message : String(error)}`;
				}
			}),
		copyTemplates: Effect.fn("Story.copyTemplates")(function* () {
			const start = yield* rpcCall(served(engine).board, (client) => client("work-board.start", undefined)).pipe(Effect.orDie);
			yield* changeSeen(
				`the reader copies the start view's templates into the workspace: ${start.templates.map((template) => template.file).join(", ")}`,
				() => {
					for (const template of start.templates) {
						engine.notes.write(template.file, template.source);
					}
				},
				Effect.map(
					Effect.forEach(start.templates, (template) => documentAt(fileUrl(template.file))),
					(reads) => !reads.includes("not found"),
				),
			);
		}),
		documentAt: (url: string) => {
			tell(`the reader reads ${url} through the board`);
			return Effect.orDie(documentAt(url));
		},
		documentFindings: (file: string) =>
			Effect.promise(async () => {
				tell(`the reader reads the board's diagnostics and recorded evidence for ${file}`);
				const { client } = served(engine);
				const document = await client.run(client.api.document.run({ url: fileUrl(file) }));
				return { diagnostics: document.diagnostics, evidence: document.metadata.evidence ?? "none" };
			}),
		documentLinks: (file: string) =>
			Effect.promise(async () => {
				tell(`the reader reads the links the board resolved in ${file || "the home document"}`);
				const { client } = served(engine);
				return (await client.run(client.api.document.run({ url: fileUrl(file) }))).links;
			}),
		download: (path: string, headers: Readonly<Record<string, string>> = {}, method = "GET", body = "") => {
			const sent = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
			tell(`a local HTTP client sends ${method} ${path}${sent.length > 0 ? ` with ${sent.join(", ")}` : ""}`);
			return Effect.map(rawExchange(served(engine).board, path, headers, method, body), described);
		},
		editFileIn: (folder: "reference" | "replacement", file: string, source: string) => {
			tell(`an outside editor writes ${file} in the ${folder} folder`);
			linked()[folder].write(file, source);
		},
		fileReadCount: () =>
			Effect.sync(() => {
				tell("the reader counts the files the board has read");
				const reads = servingObservations(engine).fileReads;
				if (reads === undefined) {
					throw new Error("Add the fileReadsCounted trait before counting reads");
				}
				return reads;
			}),
		folderListings: (folder: string) =>
			Effect.sync(() => {
				tell(`the reader counts how often the board listed ${folder}`);
				const paths = servingObservations(engine).paths;
				if (!paths) {
					throw new Error("Add the directoryReadsRecorded trait before counting listings");
				}
				return paths.listed.filter((path) => path === join(engine.notes.root, folder)).length;
			}),
		homeFile: () => {
			tell("the reader asks the board for its home file");
			return Effect.map(rpcNavigation(served(engine).board), (navigation) => navigation.home?.file ?? "no home");
		},
		importedChunk: (path: string) =>
			Effect.map(rawGet(served(engine).board, path), (response) => {
				tell(`the reader finds a content-hashed chunk that ${path} imports`);
				const chunk = /react-assets\/[\w-]+\.js|chunks\/mermaid\.esm\.min\/[\w-]+\.mjs/u.exec(response.body)?.[0];
				if (!chunk) {
					throw new Error(`${path} imports no content-hashed chunk`);
				}
				return new URL(chunk, new URL(path, "http://board.test")).pathname;
			}),
		itemRead: (url: string) =>
			Effect.promise(async () => {
				tell(`the reader reads ${url} through the board`);
				const { client } = served(engine);
				try {
					const document = await client.run(client.api.document.run({ url }));
					return { file: document.file, identity: document.identity, source: document.source };
				} catch (error) {
					if (error instanceof NotFound) {
						return "not found";
					}
					throw error;
				}
			}),
		launch: (options?: ServingOptions) => {
			tell(`the board starts serving the project${options?.home ? ` with home ${options.home}` : ""}`);
			return launched(options);
		},
		launchWithInvalidAssetLocation: Effect.fn("Story.launchWithInvalidAssetLocation")(function* () {
			tell("the board starts while its browser asset location is not a valid file URL");
			const path = yield* Path.Path.pipe(Effect.provide(NodeServices.layer));
			return yield* launched({
				path: {
					...path,
					fromFileUrl: () => Effect.fail(new PlatformError.BadArgument({ description: "Invalid module URL", method: "fromFileUrl", module: "Path" })),
				},
			});
		}),
		libraryPaths: () => {
			tell("the reader lists the board's library");
			return Effect.map(rpcPaths(served(engine).board), (paths) => [...paths].sort(Order.String));
		},
		paddedRpc: (bytes: number) => {
			tell(`a local client sends an RPC request padded to ${bytes} bytes`);
			const request = `${JSON.stringify({ _tag: "Request", headers: [["x-padding", "x".repeat(bytes)]], id: "1", payload: null, tag: "work-board.watcher" })}\n`;
			return Effect.map(rawExchange(served(engine).board, "/_board/rpc", { "content-type": "application/ndjson" }, "POST", request), (response) => {
				if (response.status !== 200) {
					return `refused: ${statusPhrase(response.status)}`;
				}
				return response.text.includes('"_tag":"Success"') ? "answered" : `not answered: ${response.text}`;
			});
		},
		pageShell: (path: string) => {
			tell(`a browser downloads the first HTML of ${path}`);
			return Effect.map(rawGet(served(engine).board, path), (response) => ({ status: statusPhrase(response.status), ...shellOf(response.body) }));
		},
		pluginAgentStates: (at: number) => {
			tell("the Claude Code plugin reads the board's work in flight");
			return Effect.map(pluginBoard(at), (board) => board.flights.items.map((flight) => flight.agents.map((agent) => agent.state)));
		},
		pluginAgents: (at: number) => {
			tell("the Claude Code plugin reads the agents on the board's work in flight");
			return Effect.map(pluginBoard(at), (board) => board.flights.items.map((flight) => flight.agents));
		},
		pluginGoal: (id: string, at: number) => {
			tell(`the Claude Code plugin reads the progress of ${id}`);
			return Effect.map(pluginBoard(at), (board) => board.goals.items.find((goal) => goal.id === id) ?? "missing");
		},
		pluginItem: (id: string) => {
			tell(`the Claude Code plugin's item tool reads ${id}`);
			return Effect.promise(() => item(pluginTools(), id));
		},
		pluginNeedsYou: () => {
			tell("the Claude Code plugin's needs-you tool reads the board");
			return Effect.promise(() => needsYou(pluginTools()));
		},
		pluginOverview: () => {
			tell("the Claude Code plugin's overview tool reads the board");
			return Effect.promise(() => overview(pluginTools()));
		},
		pluginSection: (section: "asks" | "flights" | "goals", at: number) => {
			tell(`the Claude Code plugin reads the board's ${section}`);
			return Effect.map(pluginBoard(at), (board) => board[section]);
		},
		queryRpc: (path: string, headers: Readonly<Record<string, string>> = {}) => {
			tell(`a local client asks ${path} for the start view's data`);
			const request = `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.start" })}\n`;
			return Effect.map(
				rawExchange(served(engine).board, path, { "content-type": "application/ndjson", ...headers }, "POST", request),
				(response) => ({
					answer: response.text.includes('"_tag":"Success"') ? "answered" : `not answered: ${response.text}`,
					cacheControl: header(response, "cache-control"),
					encoding: header(response, "content-encoding") ?? "none",
				}),
			);
		},
		searchCount: (query: string) =>
			Effect.promise(async () => {
				tell(`the reader searches for ${JSON.stringify(query)} and counts the results`);
				const { client } = served(engine);
				const found = await client.run(client.api.search.run({ query }));
				return { shown: found.results.length, total: found.total };
			}),
		searchHits: (query: string) =>
			Effect.promise(async () => {
				tell(`the reader searches for ${JSON.stringify(query)}`);
				const { client } = served(engine);
				const found = await client.run(client.api.search.run({ query }));
				return found.results.map((result) => `${result.href} at line ${result.line}`);
			}),
		searchUnavailable: (query: string) =>
			Effect.promise(async () => {
				tell(`the reader searches for ${JSON.stringify(query)} and reads which files could not be searched`);
				const { client } = served(engine);
				return (await client.run(client.api.search.run({ query }))).unavailable;
			}),
		startTemplates: () => {
			tell("the reader lists the start view's templates");
			return Effect.map(
				rpcCall(served(engine).board, (client) => client("work-board.start", undefined)),
				(start) => start.templates.map((template) => template.file),
			);
		},
		startupWarnings: () =>
			Effect.sync(() => {
				tell("the reader reads the warnings the board logged");
				const logged = servingObservations(engine).logged;
				if (!logged) {
					throw new Error("Add the bundleNotBuilt trait before reading startup warnings");
				}
				return logged.filter(({ level }) => level === "Warn").map(({ message }) => (Array.isArray(message) ? message.join(" ") : String(message)));
			}),
		startView: () =>
			Effect.promise(async () => {
				tell("the reader opens the start view");
				const html = await renderRemaining(served(engine).board.url, "/_board/start");
				return /<h1[^>]*>(?<heading>.*?)<\/h1>/u.exec(html)?.groups?.heading ?? "no heading";
			}),
		statusOf: (path: string, host?: string) => {
			tell(`a local HTTP client requests ${path}${host ? ` addressed to ${host}` : ""}`);
			return Effect.map(rawGet(served(engine).board, path, host), (response) => statusPhrase(response.status));
		},
		tryOpenReader: (path: string) => {
			const reader = readerVerbs(engine, tell);
			return reader.open(path).pipe(Effect.matchCause({ onFailure: (cause) => `refused: ${failureMessage(cause)}`, onSuccess: () => "opened" }));
		},
		visitedPaths: () =>
			Effect.sync(() => {
				tell("the reader lists every workspace path the board visited, apart from its own socket");
				const paths = servingObservations(engine).paths;
				if (!paths) {
					throw new Error("Add the directoryReadsRecorded trait before listing visited paths");
				}
				return [...new Set(paths.visited.map((path) => relative(engine.notes.root, path)))]
					.filter((path) => path !== "board.sock")
					.sort(Order.String);
			}),
	};
}
