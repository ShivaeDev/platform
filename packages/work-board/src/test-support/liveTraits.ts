import { chmodSync } from "node:fs";
import { relative } from "node:path";
import { Deferred, Effect, PlatformError, Stream, Tracer } from "effect";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import { boardStory, deferredServing } from "./boardStory.ts";
import { codexResponse, githubObservations, health } from "./diagnostics.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { directoryNotifications } from "./directoryNotifications.ts";
import { embeddedBoard } from "./embeddedBoard.ts";
import { changeSubscription, watcherChange } from "./liveChanges.ts";
import { type CrashingStorage, type FailingWatcher, LIVE_CLIENT, liveState, type StartupReads } from "./liveState.ts";
import { rpcWatcher } from "./nativeRpc.ts";
import { attachServer, startProject } from "./servingEngine.ts";
import { served, wrapFilesystem } from "./storyEngine.ts";
import { Tally } from "./Tally.ts";

export const liveClientSubscribed = boardStory.trait(
	"reader",
	"a live client subscribes to the project's changes and receives its opening resync while the project is watched",
	function* (engine) {
		const { board } = served(engine);
		const subscription = yield* changeSubscription(board);
		const opening = yield* subscription.next();
		if (opening !== "resync") {
			throw new Error(`The subscription opened with ${JSON.stringify(opening)} instead of a resync`);
		}
		while (!(yield* rpcWatcher(board)).watching) {
			yield* subscription.next();
		}
		liveState(engine).subscriptions.set(LIVE_CLIENT, subscription);
	},
);

export const indexClientSubscribed = boardStory.trait(
	"reader",
	"a live client subscribes to the Board index alone and the project is watched",
	function* (engine) {
		const { board } = served(engine);
		const subscription = yield* changeSubscription(board, true);
		while ((yield* subscription.next()) !== "resync" || !(yield* rpcWatcher(board)).watching) {
			// The index-only client hears the watcher start as the resync that follows it.
		}
		liveState(engine).subscriptions.set(LIVE_CLIENT, subscription);
	},
);

const injected = PlatformError.systemError({ _tag: "Unknown", description: "Injected watcher failure", method: "watch", module: "FileSystem" });

export const watcherCanFail = boardStory.trait("project", "the project's file watcher can be made to fail", (engine) => {
	let failure = Deferred.makeUnsafe<void>();
	const watcher: FailingWatcher = {
		attempts: [],
		broken: false,
		fail: () => {
			watcher.broken = true;
			Deferred.doneUnsafe(failure, Effect.void);
		},
		restarts: new Tally(),
	};
	liveState(engine).watcher = watcher;
	wrapFilesystem(engine, (fs) => ({
		...fs,
		watch: (path, options) =>
			Stream.suspend(() => {
				if (watcher.broken || options?.recursive) {
					watcher.attempts.push(performance.now());
					watcher.restarts.bump();
				}
				if (watcher.broken) {
					return Stream.fail(injected);
				}
				failure = Deferred.makeUnsafe<void>();
				return Stream.merge(
					fs.watch(path, options),
					Stream.flatMap(Stream.fromEffect(Deferred.await(failure)), () => Stream.fail(injected)),
				);
			}),
	}));
});

function reportedDirectories(onlyDirectories: boolean, line: string) {
	const reports = directoryNotifications(onlyDirectories);
	return boardStory.traits(
		reports.trait,
		boardStory.trait("project", line, (engine) => {
			liveState(engine).directories = reports;
		}),
	);
}

export function directoriesReportedLate() {
	return reportedDirectories(false, "the watcher can also report a directory again after its files were reported");
}

export function onlyDirectoriesReported() {
	return reportedDirectories(true, "the watcher reports only the directory when files inside it change");
}

export const watcherHasFailed = boardStory.trait(
	"reader",
	"the project's file watcher has failed and the live client was told the project is not watched",
	function* (engine) {
		const state = liveState(engine);
		const watcher = state.watcher;
		const subscription = state.subscriptions.get(LIVE_CLIENT);
		if (!(watcher && subscription)) {
			throw new Error("watcherHasFailed needs watcherCanFail and liveClientSubscribed before it");
		}
		watcher.fail();
		yield* watcherChange(subscription, served(engine).board, false);
	},
);

export const watcherRecovered = boardStory.trait("reader", "the failed watcher works again and the live client has resynced", function* (engine) {
	const state = liveState(engine);
	const watcher = state.watcher;
	const subscription = state.subscriptions.get(LIVE_CLIENT);
	if (!(watcher && subscription)) {
		throw new Error("watcherRecovered needs watcherCanFail and liveClientSubscribed before it");
	}
	watcher.broken = false;
	yield* watcherChange(subscription, served(engine).board, true);
	while ((yield* subscription.next()) !== "resync") {
		// The watcher change comes before its resync; any change between them is part of the recovery.
	}
});

export const mountedInApplication = boardStory.traits(
	deferredServing,
	boardStory.trait("reader", "an application mounts the board beside its own health route", function* (engine) {
		yield* attachServer(engine, yield* embeddedBoard(engine.notes.root, engine.responses));
	}),
);

export const boardOwnedByFiber = boardStory.traits(
	deferredServing,
	boardStory.trait("reader", "an owner fiber starts the board in its own scope and holds it open", function* (engine) {
		const listening = Deferred.makeUnsafe<void>();
		const release = Deferred.makeUnsafe<void>();
		const owner = yield* Effect.scoped(
			Effect.gen(function* () {
				yield* startProject(engine);
				Deferred.doneUnsafe(listening, Effect.void);
				yield* Deferred.await(release);
			}),
		).pipe(Effect.forkScoped);
		yield* Deferred.await(listening);
		liveState(engine).owned = { finish: () => Deferred.doneUnsafe(release, Effect.void), owner };
	}),
);

const notConfigured = { cause: "Not configured for fixture", observedAt: 0, state: "not-configured" } as const;
const READY_SNAPSHOT: DiagnosticsSnapshot = {
	codex: { observedAt: 100, state: "ready", value: codexResponse.rateLimits },
	fleet: { observedAt: 100, state: "ready", value: health },
	github: { observedAt: 100, state: "ready", value: githubObservations },
};
const UNCONFIGURED_SNAPSHOT: DiagnosticsSnapshot = { codex: notConfigured, fleet: notConfigured, github: notConfigured };

export function boardWithFleet(items: Parameters<typeof diagnosticsDaemon>[2], diagnostics: "ready" | "not configured" = "ready") {
	return boardStory.traits(
		deferredServing,
		boardStory.trait(
			"reader",
			`the board starts beside a Fleet daemon that reports ${diagnostics} diagnostics and its work items`,
			function* (engine) {
				const daemon = yield* diagnosticsDaemon(() => (diagnostics === "ready" ? READY_SNAPSHOT : UNCONFIGURED_SNAPSHOT), 0, items);
				yield* startProject(engine, { fleetPort: daemon.port });
			},
		),
	);
}

export const boardWithoutFleet = boardStory.traits(
	deferredServing,
	boardStory.trait("reader", "the board starts without Fleet set up", function* (engine) {
		yield* startProject(engine, { fleetPort: null });
	}),
);

export function startupReadsObserved(held = false) {
	return boardStory.trait(
		"project",
		held
			? "the board's workspace file reads wait until released, and the reader sees each one"
			: "the reader sees each workspace file the board reads",
		(engine) => {
			const reads: StartupReads = { distinct: new Tally(), files: new Set(), ...(held ? { gate: Deferred.makeUnsafe<void>() } : {}) };
			liveState(engine).startupReads = reads;
			wrapFilesystem(engine, (fs) => ({
				...fs,
				readFileString: (path, encoding) => {
					const file = relative(engine.notes.root, path);
					if (!reads.files.has(file)) {
						reads.files.add(file);
						reads.distinct.bump();
					}
					return reads.gate ? Effect.andThen(Deferred.await(reads.gate), fs.readFileString(path, encoding)) : fs.readFileString(path, encoding);
				},
			}));
		},
	);
}

export const drainingBoard = boardStory.traits(
	deferredServing,
	boardStory.trait("reader", "the board starts and drains open requests when it shuts down", function* (engine) {
		yield* startProject(engine, { drainRequests: true });
	}),
);

export const groupWritableProject = boardStory.trait("project", "the project folder is group-writable, as under umask 0002", (engine) => {
	chmodSync(engine.notes.root, 0o775);
});

export const stagingObserved = boardStory.trait("project", "the reader sees the address the board stages its socket at", (engine) => {
	const staged = { path: "" };
	liveState(engine).staging = staged;
	wrapFilesystem(engine, (fs) => ({
		...fs,
		chmod: (path, mode) => {
			staged.path = path;
			return fs.chmod(path, mode);
		},
	}));
});

export const crashableTracedBoard = boardStory.traits(
	deferredServing,
	boardStory.trait(
		"reader",
		"the board starts with its server spans recorded and storage that can crash with a secret in its defect",
		function* (engine) {
			const crashing: CrashingStorage = { crash: false, original: new Error("Unexpected storage failure with token=private-value"), spans: [] };
			liveState(engine).crashing = crashing;
			const tracer = Tracer.make({
				span: (options) => {
					const span = new Tracer.NativeSpan(options);
					crashing.spans.push(span);
					return span;
				},
			});
			yield* startProject(engine, {
				tracer,
				wrap: (fs) => ({
					...fs,
					readFileString: (path, options) =>
						crashing.crash && path.endsWith("note.md") ? Effect.die(crashing.original) : fs.readFileString(path, options),
				}),
			});
		},
	),
);
