import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Cause, Clock, Deferred, Effect, Exit, Fiber, Order } from "effect";
import { folder, type RunningBoard, rawGet, rawPost, startBoard } from "./board.ts";
import { boardCommand } from "./boardCommand.ts";
import { answered, answeredPromise } from "./liveOutcomes.ts";
import { type BoardPlace, octal, sameOverBoth, serverAnswerOf, socketCall, socketFileOf, socketState } from "./liveSockets.ts";
import { liveState, present } from "./liveState.ts";
import { rpcCall, rpcDocument, rpcNavigation } from "./nativeRpc.ts";
import { type ServingOptions, startProject } from "./servingEngine.ts";
import { shutdownConnection } from "./shutdownConnection.ts";
import { socketStartup } from "./socketStartup.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

function message(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function liveSocketVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const state = socketState(engine);
	function label(text: string) {
		let labelled = text;
		if (engine.server) {
			labelled = labelled.replaceAll(`${engine.server.board.url}/`, "the board");
		}
		for (const [value, name] of state.labels) {
			labelled = labelled.replaceAll(value, name);
		}
		return labelled.replaceAll(engine.notes.root, "the project folder");
	}
	function place(of: "the project" | "the other folder"): BoardPlace {
		if (of === "the other folder") {
			return present(state.other, "No board runs in another folder; call otherBoardStarts first");
		}
		return { root: engine.notes.root, url: served(engine).board.url };
	}
	function command() {
		return present(state.command, "No board command was started; call commandStarts first");
	}
	function worker(name: string) {
		return present(state.workers.get(name), `${name} was not started; call workerStarts first`);
	}
	function started(attempt: Exit.Exit<unknown, unknown>) {
		return Exit.isSuccess(attempt) ? "started" : `refused: ${label(message(Cause.squash(attempt.cause)))}`;
	}
	return {
		bothBoardsStart: Effect.fn("Story.bothBoardsStart")(function* () {
			tell("two boards start on the same fresh folder at the same moment");
			const attempts = yield* Effect.all([Effect.exit(Effect.gen(() => startProject(engine))), Effect.exit(Effect.gen(() => startProject(engine)))], {
				concurrency: "unbounded",
			});
			return attempts.map(started).sort(Order.String);
		}),
		commandAddress: () => {
			tell("the reader waits for the command to announce where it listens");
			return Effect.map(command().listening(), (url) => (/^http:\/\/127\.0\.0\.1:\d+$/u.test(url) ? "a loopback address" : url));
		},
		commandEnding: () => {
			tell("the reader waits for the command to exit");
			return Effect.map(command().exit(), ({ code, signal }) => {
				if (code === null) {
					return `stopped by ${signal}`;
				}
				return code === 0 ? "succeeded" : "failed";
			});
		},
		commandSaid: () => {
			tell("the reader reads what the command printed by the time it exited");
			return Effect.map(command().exit(), () => label(command().output()));
		},
		commandSignalled: Effect.fn("Story.commandSignalled")(function* (signal: NodeJS.Signals) {
			const before = yield* Clock.currentTimeMillis;
			command().signal(signal);
			yield* command().exit();
			state.commandStop = (yield* Clock.currentTimeMillis) - before;
		}),
		commandStarts: Effect.fn("Story.commandStarts")(function* (args: readonly string[] = []) {
			state.command = yield* boardCommand(engine, args, tell);
		}),
		commandStopTime: () =>
			Effect.sync(() => {
				tell("the reader checks how long the command took to stop");
				const took = present(state.commandStop, "The command was not signalled");
				return took < 3000 ? "within three seconds" : `${Math.round(took)}ms`;
			}),
		documentRefusal: (path: string) => {
			tell(`a native RPC client reads ${path}`);
			return answered(rpcDocument(served(engine).board, `/${path}`));
		},
		filesReadAtStartup: (count: number) => {
			tell(`the reader waits until the board has read ${count} workspace files`);
			const reads = present(liveState(engine).startupReads, "The story does not observe startup reads; add startupReadsObserved");
			return Effect.as(reads.distinct.reaches(count), [...reads.files].sort(Order.String));
		},
		inboxAudience: () => {
			tell("a native RPC client reads who the Inbox asks");
			return Effect.map(
				rpcCall(served(engine).board, (client) => client("work-board.inbox", undefined)),
				(inbox) => ({
					agents: inbox.agents.length,
					you: inbox.you.length,
				}),
			);
		},
		navigationHome: () => {
			tell("a native RPC client reads the board's home");
			return Effect.map(rpcNavigation(served(engine).board), (navigation) => navigation.home?.file ?? "none");
		},
		otherBoardStarts: Effect.fn("Story.otherBoardStarts")(function* (files: Readonly<Record<string, string>>) {
			tell("a second board starts in another folder");
			const other = yield* Effect.acquireRelease(
				Effect.sync(() => folder(files)),
				(notes) => Effect.sync(notes.remove),
			);
			const board: RunningBoard = yield* startBoard(other.root);
			state.labels.set(`${board.url}/`, "the other board");
			state.labels.set(other.root, "the other folder");
			state.other = { root: other.root, url: board.url };
		}),
		projectEntries: () =>
			Effect.sync(() => {
				tell("the reader lists what the project folder holds");
				return readdirSync(engine.notes.root).sort(Order.String);
			}),
		readOverBoth: (tag: string) => {
			tell(`local clients call ${tag} over the socket and over TCP`);
			return sameOverBoth(place("the project"), tag);
		},
		rpcPostStatus: (headers: Readonly<Record<string, string>>) => {
			const sent = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
			tell(`a local HTTP client posts a native RPC request${sent.length > 0 ? ` with ${sent.join(", ")}` : ""}`);
			const body = `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.server" })}\n`;
			const { board } = served(engine);
			const resolved = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, value === "the board" ? board.url : value]));
			return Effect.map(rawPost(board, "/_board/rpc", resolved, body), (response) => String(response.status));
		},
		rpcResponseHeaders: () => {
			tell("a local HTTP client posts a native RPC request for the start page");
			return Effect.promise(async () => {
				const response = await fetch(new URL("/_board/rpc", served(engine).board.url), {
					body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.start" })}\n`,
					headers: { "content-type": "application/ndjson" },
					method: "POST",
				});
				await response.text();
				return {
					"cache-control": response.headers.get("cache-control"),
					status: response.status,
					"x-content-type-options": response.headers.get("x-content-type-options"),
				};
			});
		},
		scriptBuild: () => {
			tell("a local HTTP client requests the board's browser script");
			return Effect.map(
				Effect.suspend(() => rawGet(served(engine).board, "/_board/react.js")),
				({ body }) => {
					if (body.includes("staleBrowserBuild")) {
						return "the stale build";
					}
					return body.includes("current-checkout-browser") ? "the current checkout's build" : "an unknown build";
				},
			);
		},
		searchAnswer: (query: string) => {
			tell(`the reader's client searches for ${JSON.stringify(query)}`);
			const { client } = served(engine);
			return answeredPromise(() => client.run(client.api.search.run({ query })));
		},
		searchFinds: () => {
			tell("the reader waits for the search's answer");
			return Fiber.join(present(state.search, "No search was sent; call searchStarts first"));
		},
		searchStarts: Effect.fn("Story.searchStarts")(function* (query: string) {
			tell(`the reader's client sends a search for ${JSON.stringify(query)}`);
			const { client } = served(engine);
			state.search = yield* Effect.promise(() => client.run(client.api.search.run({ query }))).pipe(
				Effect.map((found) => found.results.map((result) => result.file)),
				Effect.forkScoped,
			);
		}),
		serverAnswer: (over: "socket" | "TCP", of: "the project" | "the other folder" = "the project") => {
			tell(`a local ${over} client asks ${of === "the project" ? "the board" : "the other folder's board"} which folder it serves`);
			const root = of === "the project" ? engine.notes.root : place(of).root;
			return serverAnswerOf(over === "socket" ? join(root, "board.sock") : place(of).url, label);
		},
		shutdownWait: () =>
			Effect.sync(() => {
				tell("the reader checks how long shutdown waited");
				const took = present(state.stopped, "The board was not stopped with stopTimed");
				return took >= 4900 ? "the full drain period" : `${Math.round(took)}ms`;
			}),
		socketFile: (of: "the project" | "the other folder" = "the project") =>
			Effect.sync(() => {
				tell(`the reader inspects the socket in ${of === "the project" ? "the project folder" : "the other folder"}`);
				return socketFileOf(of === "the project" ? engine.notes.root : place(of).root);
			}),
		socketRead: (tag: string) => {
			tell(`a local socket client calls ${tag}`);
			return Effect.map(socketCall(join(engine.notes.root, "board.sock"), tag), (answer) =>
				"failure" in answer ? label(answer.failure) : "answered",
			);
		},
		stagingFits: () =>
			Effect.sync(() => {
				tell("the reader compares the staged socket address with the public one");
				const staged = present(liveState(engine).staging, "The story does not observe staging; add stagingObserved").path;
				const socket = join(engine.notes.root, "board.sock");
				return Buffer.byteLength(staged) <= Buffer.byteLength(socket) ? "no longer than the public socket" : "longer than the public socket";
			}),
		stagingSocket: (name: string) =>
			Effect.sync(() => {
				tell(`the reader inspects where ${name} bound its new socket`);
				const path = present(state.staged.get(name), `${name} has not reported a staged socket`);
				return { folder: octal(join(path, "..")), socket: octal(path) };
			}),
		startAttempt: (fault?: "failing chmod") => {
			tell(`the board tries to start${fault ? ` with a ${fault}` : ""}`);
			const options: ServingOptions =
				fault === undefined ? {} : { wrap: (fs) => ({ ...fs, chmod: (_path, mode) => fs.chmod(join(engine.notes.root, "missing"), mode) }) };
			return Effect.map(Effect.exit(Effect.scoped(Effect.gen(() => startProject(engine, options)))), started);
		},
		startupReadsReleased: () => {
			tell("the held workspace reads are released");
			const reads = present(liveState(engine).startupReads, "The story does not observe startup reads; add startupReadsObserved");
			return Deferred.succeed(present(reads.gate, "The startup reads are not held"), undefined);
		},
		stopTimed: Effect.fn("Story.stopTimed")(function* () {
			tell("the board shuts down");
			const before = yield* Clock.currentTimeMillis;
			yield* served(engine).board.stop();
			state.stopped = (yield* Clock.currentTimeMillis) - before;
		}),
		unfinishedRequestEnd: () => {
			tell("the reader sees how the unfinished request ended");
			return Effect.map(present(state.unfinished, "No unfinished request is open").closed, ({ status }) =>
				status === 0 || status === 503 ? "cut off" : `answered ${status}`,
			);
		},
		unfinishedRequestOpens: Effect.fn("Story.unfinishedRequestOpens")(function* (over: "socket" | "TCP") {
			tell(`a ${over} client leaves an unfinished request open`);
			state.unfinished = yield* shutdownConnection(over === "TCP" ? served(engine).board.url : join(engine.notes.root, "board.sock"));
		}),
		workerCloses: Effect.fn("Story.workerCloses")(function* (name: string) {
			tell(`${name} closes and reports it closed`);
			yield* worker(name).send("close");
			const report = yield* worker(name).next();
			if (report.phase !== "closed") {
				return yield* Effect.die(new Error(`${name} reported ${report.phase} instead of closing`));
			}
		}),
		workerContinues: (name: string) => {
			tell(`${name} continues its startup`);
			return worker(name).send("continue");
		},
		workerReports: Effect.fn("Story.workerReports")(function* (name: string) {
			tell(`the reader waits for ${name}'s next report`);
			const report = yield* worker(name).next();
			if (report.path) {
				state.staged.set(name, report.path);
			}
			if (report.url) {
				state.labels.set(`${report.url}/`, name);
			}
			switch (report.phase) {
				case "ready":
				case "closed":
					return report.phase;
				case "rejected":
					return `rejected: ${label((report.error ?? "").split("\n")[0]?.replace(/^Error: /u, "") ?? "")}`;
				default:
					return `paused at ${report.phase}`;
			}
		}),
		workerStarts: Effect.fn("Story.workerStarts")(function* (name: string, pauseAt?: "permissions" | "reclaim") {
			tell(`${name} starts in a separate process${pauseAt ? ` and pauses at ${pauseAt}` : ""}`);
			state.workers.set(name, yield* socketStartup(engine.notes.root, pauseAt));
		}),
	};
}
