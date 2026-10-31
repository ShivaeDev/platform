import { spawnSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";
import { Clock, Effect, Option, Order, Result, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { LibraryInput } from "#browser/navigation/library.ts";
import { fileUrl } from "#files/url.ts";
import { diagnosticsSnapshot } from "./diagnostics.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { type BoardEngine, served } from "./storyEngine.ts";
import { CLI, fleetBriefRequests, metadataSpies, mountedReadings, workspaceReads } from "./workspaceReads.ts";

export function workspaceBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const { rpc, document, saved, migrate, inbox, diskLibrary, daemon, goals } = workspaceReads(engine);
	return {
		answeredRecords: () =>
			Effect.map(inbox(), (read) => {
				tell("the reader reads which answer settles each item in the Answered lane, from a fresh index of the Board directory");
				return read.answered.map((item) => item.answered);
			}),
		boardColumns: (file: string) =>
			Effect.map(
				rpc((client) => client("work-board.board", { url: fileUrl(file) })),
				(board) => {
					tell(`the reader opens the heading board ${file} and reads each column with its card count`);
					return board.counts.map((column) => `${column.title}: ${column.count}`);
				},
			),
		boardFinishesIndexing: () =>
			Effect.map(document("document-0.md"), () => {
				tell("the board finishes its startup index, and the reader counts file reads and metadata work from here on");
				engine.reads?.files.splice(0);
				const spies = metadataSpies.get(engine);
				for (const spy of spies ? [spies.builds, spies.parses, spies.updates] : []) {
					spy.mockClear();
				}
			}),
		failedMigration: () =>
			Effect.sync(() => {
				tell("work-board migrate runs on the Board directory and the reader reads its exit and errors");
				const run = spawnSync(process.execPath, ["--conditions=source", CLI, "migrate", engine.notes.root], { encoding: "utf8" });
				return { errors: run.stderr, exit: run.status === 0 ? "succeeded" : "failed" };
			}),
		fleetBriefRequests: () =>
			Effect.sync(() => {
				tell("the reader checks which briefs the board asked Fleet about");
				return fleetBriefRequests.get(engine) ?? [];
			}),
		fleetDaemonFinishesAll: () =>
			Effect.sync(() => {
				tell("Fleet finishes and forgets every item");
				daemon().items = { completed: [], items: [] };
			}),
		fleetDaemonRestarts: Effect.fn("Story.fleetDaemonRestarts")(function* () {
			tell("the Fleet diagnostics daemon starts again on its old port with a current snapshot");
			if (!engine.fleetPort) {
				throw new Error("No diagnostics daemon port was configured");
			}
			const observedAt = yield* Clock.currentTimeMillis;
			yield* diagnosticsDaemon(() => diagnosticsSnapshot(observedAt), engine.fleetPort);
		}),
		fleetDaemonStops: () => {
			tell("the Fleet daemon stops");
			return daemon().stop();
		},
		fleetLibraryPaths: () => {
			tell("the reader lists the library with Fleet files shown, from the files now on disk");
			return Effect.map(diskLibrary(), (library) => library.files.map((entry) => entry.path).sort(Order.String));
		},
		fleetSource: () =>
			Effect.map(
				rpc((client) => client("work-board.diagnostics", undefined)),
				(diagnostics) => {
					tell("the reader reads the Fleet diagnostics source");
					return diagnostics.sources.fleet;
				},
			),
		fleetStartCommand: () =>
			Effect.map(
				rpc((client) => client("work-board.fleetItems", undefined)),
				(fleet) => {
					tell("the reader reads the command the board suggests for starting Fleet, with its folder's parent and port named");
					const command = "startCommand" in fleet ? (fleet.startCommand ?? "no command") : "no command";
					return command
						.replace(relative(resolve(), dirname(engine.notes.root)), "<parent>")
						.replace(`--port ${engine.fleetPort}`, "--port <fleet port>");
				},
			),
		fleetWork: () =>
			Effect.map(
				rpc((client) => client("work-board.fleetItems", undefined)),
				(fleet) => {
					tell("the reader reads Fleet work through the board");
					return fleet;
				},
			),
		goalCounts: (id: string) =>
			Effect.map(goals(), (data) => {
				tell(`the reader reads the work counts of the goal ${id}`);
				const goal = [...data.goals, ...data.closedGoals, ...data.deferredGoals].find((entry) => entry.id === id);
				return goal
					? {
							counts: goal.counts,
							criteria: goal.criteria.map((criterion) => criterion.counts),
							lanes: goal.lanes,
							linked: goal.linked,
							openAsks: goal.openAsks,
						}
					: "no such goal";
			}),
		goalLists: () =>
			Effect.map(goals(), (data) => {
				tell("the reader reads which goals are active, deferred and closed");
				function ids(entries: ReadonlyArray<{ readonly id: string }>) {
					return entries.map((entry) => entry.id);
				}
				return { active: ids(data.goals), closed: ids(data.closedGoals), deferred: ids(data.deferredGoals) };
			}),
		inboxLanes: () =>
			Effect.map(inbox(), (read) => {
				tell("the reader reads the items in each Inbox lane, from a fresh index of the Board directory");
				function ids(items: ReadonlyArray<{ readonly id: string }>) {
					return items.map((item) => item.id).sort(Order.String);
				}
				return { agents: ids(read.agents), answered: ids(read.answered), resolved: ids(read.resolved), you: ids(read.you) };
			}),
		inboxQuestions: () =>
			Effect.map(
				rpc((client) => client("work-board.inbox", undefined)),
				(read) => {
					tell("the reader reads the questions waiting on the maintainer in Inbox order");
					return read.you.map((entry) => `${entry.id}: ${entry.urgency} ${entry.scope}`);
				},
			),
		libraryKinds: () => {
			tell("the reader reads the kinds the library offers as filters, from the files now on disk");
			return Effect.map(diskLibrary(), (library) => library.kinds);
		},
		libraryResult: (input: LibraryInput) =>
			Effect.map(
				rpc((client) => client("work-board.library", input)),
				(library) => {
					tell(`the reader lists the library with ${JSON.stringify(input)}`);
					return { fleetCount: library.fleetCount, folders: library.folders, paths: library.files.map((entry) => entry.path) };
				},
			),
		libraryRow: (path: string) =>
			Effect.map(
				rpc((client) => client("work-board.library", {})),
				(library) => {
					tell(`the reader reads the library row of ${path}`);
					return library.files.find((entry) => entry.path === path) ?? "not listed";
				},
			),
		metadataWork: () =>
			Effect.sync(() => {
				tell("the reader counts the metadata parses and model rebuilds since then");
				const spies = metadataSpies.get(engine);
				if (!spies) {
					throw new Error("The story does not count metadata work; add the countedMetadataWork trait");
				}
				return { modelBuilds: spies.builds.mock.calls.length, modelUpdates: spies.updates.mock.calls.length, parses: spies.parses.mock.calls.length };
			}),
		migrationReport: () =>
			Effect.sync(() => {
				tell("work-board migrate runs on the Board directory and the reader reads its report");
				return migrate();
			}),
		migrationRuns: () =>
			Effect.sync(() => {
				tell("work-board migrate runs on the Board directory");
				migrate();
			}),
		migrationRunsAgain: (files: readonly string[]) =>
			Effect.sync(() => {
				tell("work-board migrate runs a second time and the reader compares the files before and after");
				const before = files.map(saved);
				const report = migrate();
				return { changed: files.filter((file, index) => saved(file) !== before[index]), report };
			}),
		mountedReadingUpdate: () => {
			tell("the reader waits for the mounted reading to show a new read");
			const mounted = mountedReadings.get(engine);
			if (!mounted) {
				throw new Error("No reading is mounted; call mountsReading first");
			}
			const before = JSON.stringify(mounted.latest);
			return AtomRegistry.toStream(served(engine).client.registry, mounted.atom).pipe(
				Stream.filterMap((result) =>
					AsyncResult.isSuccess(result) && !result.waiting && JSON.stringify(result.value) !== before
						? Result.succeed(result.value)
						: Result.failVoid,
				),
				Stream.runHead,
				Effect.flatMap((read) => Option.match(read, { onNone: () => Effect.die(new Error("The mounted reading stopped")), onSome: Effect.succeed })),
				Effect.tap((read) =>
					Effect.sync(() => {
						mounted.latest = read;
					}),
				),
			);
		},
		mountsReading: (url: string) =>
			Effect.gen(function* () {
				tell(`the reader's client mounts the reading of ${url} and waits for its live connection`);
				const { client } = served(engine);
				const atom = client.api.document.query({ url });
				yield* Effect.acquireRelease(
					Effect.sync(() => client.registry.mount(atom)),
					(release) => Effect.sync(release),
				);
				const read = yield* Effect.promise(() => client.read(atom));
				mountedReadings.set(engine, { atom, latest: read });
				yield* AtomRegistry.toStream(client.registry, client.updates.status).pipe(
					Stream.takeUntil((status) => status.connection === "live"),
					Stream.runDrain,
				);
				return read;
			}),
		navigationCounts: () =>
			Effect.map(
				rpc((client) => client("work-board.navigation", { current: "" })),
				(navigation) => {
					tell("the reader reads the counts in the navigation");
					return { goals: navigation.counts.goals, inbox: navigation.inboxCount ?? "unknown" };
				},
			),
		overviewFleet: () =>
			Effect.map(
				rpc((client) => client("work-board.overview", undefined)),
				({ fleet }) => {
					tell("the reader checks the Fleet work the overview shows");
					return fleet.state === "ready"
						? { completed: fleet.completed.map((item) => item.workId), shown: fleet.items.map((item) => item.workId) }
						: fleet.state;
				},
			),
	};
}
