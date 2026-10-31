import { Deferred, Effect, Order } from "effect";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { rawGet } from "./board.ts";
import { agentReads, agentTools } from "./liveAgent.ts";
import { answerOf, boardIndex, liveBoardReads } from "./liveBoardReads.ts";
import { type Change, changeNaming, changeShowing, changeSubscription } from "./liveChanges.ts";
import { answered, answeredPromise, rejection } from "./liveOutcomes.ts";
import { LIVE_CLIENT, present } from "./liveState.ts";
import { rpcCall, rpcDocument } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function liveReadVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { state, subscription, agent, goals } = liveBoardReads(engine);
	return {
		agentReads: (tool: string, args: Record<string, unknown> = {}) => {
			tell(`an agent calls the MCP tool ${tool}${Object.keys(args).length > 0 ? ` with ${JSON.stringify(args)}` : ""}`);
			return agentReads(agent(), tool, args);
		},
		agentTools: () => {
			tell("an agent lists the board's MCP tools");
			return agentTools(agent());
		},
		assetAnswer: (path: string) => {
			tell(`a local HTTP client requests the asset ${path}`);
			return Effect.promise(async () => {
				const response = await fetch(new URL(path, served(engine).board.url));
				const body = await response.text();
				if (!response.ok) {
					return `${response.status} ${response.statusText}`;
				}
				return body === "" ? "empty" : (response.headers.get("content-type")?.split(";")[0] ?? "untyped");
			});
		},
		boardRead: (read: "document" | "handoffs" | "navigation" | "search") => {
			tell(`the reader's client reads the board's ${read}`);
			const { client } = served(engine);
			const reads = {
				document: () => client.run(client.api.document.run({ url: "/proposal.md" })),
				handoffs: () => client.run(client.handoffs.handoffs.run({ item: "investigation.choices" })),
				navigation: () => client.run(client.api.navigation.run({ current: "" })),
				search: () => client.run(client.api.search.run({ query: "review" })),
			};
			return answeredPromise(reads[read]);
		},
		boardStops: () => {
			tell("the application stops the board");
			return served(engine).board.stop();
		},
		canceledDocumentRead: (how: "query" | "run") => {
			tell(`the reader's client starts a ${how === "query" ? "document query" : "direct document call"} for note.md and cancels it at once`);
			const { client } = served(engine);
			const canceled = AbortSignal.abort();
			return answeredPromise(() =>
				how === "query"
					? client.read(client.api.document.query({ url: "/note.md" }), canceled)
					: client.run(client.api.document.run({ url: "/note.md" }), canceled),
			);
		},
		changeLost: () => {
			tell("the server's live delivery loses that change");
			return Deferred.await(state.dropped);
		},
		changeNaming: (path: string, client = LIVE_CLIENT): Effect.Effect<Change, unknown> => {
			tell(`${client} waits for the change naming ${path}`);
			return changeNaming(subscription(client), path);
		},
		changeShowing: (path: string, text: string) => {
			tell(`${LIVE_CLIENT} waits for the change after which ${path} reads ${JSON.stringify(text)}`);
			return changeShowing(subscription(LIVE_CLIENT), served(engine).board, path, text);
		},
		clientSubscribes: Effect.fn("Story.clientSubscribes")(function* (client = LIVE_CLIENT, { afterResync = false } = {}) {
			tell(`${client} subscribes to the project's changes${afterResync ? " and receives its opening resync" : ""}`);
			const opened = yield* changeSubscription(served(engine).board);
			state.subscriptions.set(client, opened);
			if (afterResync && (yield* opened.next()) !== "resync") {
				return yield* Effect.die(new Error(`${client} did not open with a resync`));
			}
		}),
		directoryReported: (directory: string) => {
			tell(`the watcher reports the directory ${directory}`);
			return present(state.directories, "The story does not report directories; add onlyDirectoriesReported or directoriesReportedLate").changed(
				directory,
			);
		},
		documentFacts: (path: string) => {
			tell(`a native RPC client reads the identity and problems of ${path}`);
			return Effect.map(rpcDocument(served(engine).board, `/${path}`), (document) => ({
				identity: document.identity ?? "none",
				problems: document.diagnostics.map((diagnostic) => diagnostic.message),
			}));
		},
		documentQueryAnswer: (path: string) => {
			tell(`the reader's client queries the document ${path}`);
			const { client } = served(engine);
			return answeredPromise(() => client.read(client.api.document.query({ url: `/${path}` })));
		},
		documentRejection: (path: string) => {
			tell(`the reader's client reads ${path} and inspects the rejection it gets`);
			const { client } = served(engine);
			return Effect.promise(() =>
				client.run(client.api.document.run({ url: `/${path}` })).then(
					() => "answered",
					(error: unknown) => ({
						answer: rejection(error),
						cause: error instanceof InternalServerError && error.cause !== undefined ? "attached" : "none",
						secret: JSON.stringify(error).includes("private-value") ? "leaked" : "withheld",
					}),
				),
			);
		},
		fleetItemsAnswer: () => {
			tell("a native RPC client reads the Fleet items");
			return answered(rpcCall(served(engine).board, (client) => client("work-board.fleetItems", undefined)));
		},
		fleetOnlyFiles: () => {
			tell("the reader lists the files the library shows only with Fleet records");
			const { board } = served(engine);
			return Effect.map(
				Effect.all([
					rpcCall(board, (client) => client("work-board.library", {})),
					rpcCall(board, (client) => client("work-board.library", { showFleet: true })),
				]),
				([hidden, shown]) => shown.files.map((file) => file.path).filter((path) => !hidden.files.some((listed) => listed.path === path)),
			);
		},
		goalDetail: (id: string) => {
			tell(`the reader reads the goal ${id}`);
			return Effect.map(goals(), (read) => [...read.goals, ...read.deferredGoals, ...read.closedGoals].find((goal) => goal.id === id) ?? "missing");
		},
		goalGroups: () => {
			tell("the reader reads how the board groups its goals");
			return Effect.map(goals(), (read) => ({
				closed: read.closedGoals.map((goal) => goal.id),
				deferred: read.deferredGoals.map((goal) => goal.id),
				open: read.goals.map((goal) => goal.id),
			}));
		},
		goalItems: () => {
			tell("the reader reads the items the goals query lists");
			return Effect.map(goals(), (read) => ({
				ids: read.items.map((item) => item.id).sort(Order.String),
				modified: read.items.every((item) => typeof item.modified === "number") ? "dated" : "undated",
			}));
		},
		httpAnswer: (path: string, host?: string) => {
			tell(`a local HTTP client requests ${path}${host ? ` under the Host ${host}` : ""}`);
			return Effect.map(rawGet(served(engine).board, path, host), answerOf);
		},
		inboxDecisions: () => {
			tell("the maintainer reads the decisions waiting in the Inbox");
			const { client } = served(engine);
			return Effect.map(
				Effect.promise(() => client.run(client.api.inbox.run())),
				(inbox) => inbox.you.map((item) => item.id).sort(Order.String),
			);
		},
		indexEntry: (path: string) => {
			tell(`a native RPC client reads the Board index entry of ${path}`);
			return Effect.map(boardIndex(served(engine).board), (index) => {
				const document = present(
					index.documents.find((entry) => entry.file === path),
					`The Board index has no document ${path}`,
				);
				return {
					body: document.parsed.body,
					fields: document.parsed.fields,
					problems: index.diagnostics
						.filter((entry) => entry.file === path)
						.flatMap((entry) => entry.diagnostics.map((problem) => problem.field ?? problem.message)),
				};
			});
		},
		indexListing: () => {
			tell("a native RPC client lists the files in the Board index");
			return Effect.map(boardIndex(served(engine).board), (index) => index.files.map((file) => file.path));
		},
		indexRevision: () => {
			tell("a native RPC client reads the Board index revision");
			return Effect.map(boardIndex(served(engine).board), (index) => index.revision);
		},
	};
}
