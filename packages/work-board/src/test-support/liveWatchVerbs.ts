import { relative } from "node:path";
import { Cause, Effect, Exit, Fiber } from "effect";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { rawGet } from "./board.ts";
import { ended, fontFamily, liveBoardReads, watching } from "./liveBoardReads.ts";
import { type Change, watcherChange } from "./liveChanges.ts";
import { answeredPromise } from "./liveOutcomes.ts";
import { LIVE_CLIENT, present } from "./liveState.ts";
import { rpcDocument, rpcPaths } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function liveWatchVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { state, subscription, owned, failingWatcher } = liveBoardReads(engine);
	return {
		libraryListing: () => {
			tell("a native RPC client lists the library");
			return rpcPaths(served(engine).board);
		},
		listenerState: () => {
			tell("a local HTTP client tries to reach the board's listener");
			const { url } = served(engine).board;
			return Effect.promise(() =>
				fetch(new URL("/", url)).then(
					() => "answering",
					() => "refusing connections",
				),
			);
		},
		navigationRead: (current: string) => {
			tell(`the reader's client reads navigation for ${current === "" ? "the home" : current}`);
			const { client } = served(engine);
			return Effect.promise(() => client.run(client.api.navigation.run({ current })));
		},
		nextChange: (client = LIVE_CLIENT): Effect.Effect<Change, unknown> => {
			tell(`${client} receives its next change`);
			return subscription(client).next();
		},
		ownerEnding: () => {
			tell("the reader waits for the owner fiber to end");
			return Effect.map(Fiber.await(owned().owner), ended);
		},
		ownerFinishes: () => {
			tell("the owner fiber finishes and closes its scope");
			owned().finish();
		},
		ownerInterrupted: () => {
			tell("the owner fiber is interrupted");
			return Fiber.interrupt(owned().owner);
		},
		questionRegistration: () => {
			tell("the reader's client registers a question while responses are disabled");
			const { client } = served(engine);
			return answeredPromise(() =>
				client.mutate(client.responses.registerQuestion.run({ item: "missing", request: "review", revision: "0".repeat(64) })),
			);
		},
		requestStates: (path: string) => {
			tell(`a native RPC client reads whether the requests in ${path} can be answered`);
			return Effect.map(rpcDocument(served(engine).board, `/${path}`), (document) =>
				document.requests.map((request) => request.unavailable ?? "answerable"),
			);
		},
		responsesRead: (question: string) => {
			tell(`the reader's client reads the responses to the question ${question}`);
			const { client } = served(engine);
			return answeredPromise(() => client.run(client.responses.responses.run({ question })));
		},
		restartWaits: () =>
			Effect.sync(() => {
				tell("the reader compares the waits between the watcher's restarts");
				const restarts = failingWatcher().attempts.slice(1);
				const waits = restarts.slice(1).map((at, index) => at - (restarts[index] ?? at));
				const shorter = waits.findIndex((wait, index) => index > 0 && wait <= (waits[index - 1] ?? 0));
				return shorter === -1
					? "each wait longer than the one before"
					: `wait ${shorter + 1} of ${Math.round(waits[shorter] ?? 0)}ms is not longer than wait ${shorter} of ${Math.round(waits[shorter - 1] ?? 0)}ms`;
			}),
		serverSpanCause: (span: string) =>
			Effect.sync(() => {
				tell(`the reader inspects the failures recorded on the server's ${span} spans`);
				const { original, spans } = present(state.crashing, "The story does not record spans; add crashableTracedBoard");
				return spans
					.filter((recorded) => recorded.kind === "server" && recorded.name === span)
					.flatMap((recorded) =>
						recorded.status._tag === "Ended" && Exit.isFailure(recorded.status.exit)
							? recorded.status.exit.cause.reasons.filter(Cause.isFailReason)
							: [],
					)
					.map(({ error }) =>
						error instanceof InternalServerError && Cause.isCause(error.cause) && Cause.squash(error.cause) === original
							? "internal server error carrying the original defect"
							: `other failure: ${String(error)}`,
					);
			}),
		shellFolderTree: (path: string) => {
			tell(`a local HTTP client requests the reading shell for ${path}`);
			return Effect.map(rawGet(served(engine).board, path), ({ body }) => (body.includes('data-key="folder:') ? "a folder tree" : "no folder tree"));
		},
		sourceOf: (path: string) => {
			tell(`a native RPC client reads ${path}`);
			return Effect.map(rpcDocument(served(engine).board, `/${path}`), (document) => document.source);
		},
		stableItemSource: (id: string) => {
			tell(`a native RPC client reads the item ${id} by its stable URL`);
			return Effect.map(rpcDocument(served(engine).board, `/_board/item/${id}/`), (document) => document.source);
		},
		storageCrashes: () => {
			tell("the board's storage starts crashing on note.md with a secret in the defect");
			present(state.crashing, "The story's storage cannot crash; add crashableTracedBoard").crash = true;
		},
		stylesheetFonts: () => {
			tell("a local HTTP client requests the fonts the board's stylesheet names");
			const { url } = served(engine).board;
			return Effect.promise(async () => {
				const css = await (await fetch(new URL("/_board/react.css", url))).text();
				const fonts = new Set([...css.matchAll(/url\((?<font>\/_board\/react-assets\/[^)]+\.woff2)\)/gu)].map((match) => match.groups?.font ?? ""));
				const byFamily: Record<string, string[]> = {};
				for (const font of fonts) {
					const family = fontFamily(font);
					const response = await fetch(new URL(font, url));
					await response.arrayBuffer();
					byFamily[family] = [
						...new Set([...(byFamily[family] ?? []), response.ok ? (response.headers.get("content-type") ?? "untyped") : String(response.status)]),
					];
				}
				return byFamily;
			});
		},
		watchedFolders: () =>
			Effect.sync(() => {
				tell("the reader lists the folders the board's watcher started on");
				const directories = present(
					state.directories,
					"The story does not report directories; add onlyDirectoriesReported or directoriesReportedLate",
				);
				return directories.watchedPaths().map((path) => relative(engine.notes.root, path) || ".");
			}),
		watcherBecomes: Effect.fn("Story.watcherBecomes")(function* (wanted: "watching" | "not watching") {
			tell(`${LIVE_CLIENT} waits until the board tells it the project is ${wanted}`);
			yield* watcherChange(subscription(LIVE_CLIENT), served(engine).board, wanted === "watching");
		}),
		watcherFails: () =>
			Effect.sync(() => {
				tell("the project's file watcher fails and keeps failing");
				failingWatcher().fail();
			}),
		watcherHeals: () =>
			Effect.sync(() => {
				tell("the project's file watcher works again");
				failingWatcher().broken = false;
			}),
		watcherRestarts: (times: number) => {
			tell(`the board tries to restart the failed watcher ${times} times`);
			return failingWatcher().restarts.reaches(1 + times);
		},
		watcherState: () => {
			tell("a native RPC client asks whether the project is watched");
			return watching(engine);
		},
	};
}
