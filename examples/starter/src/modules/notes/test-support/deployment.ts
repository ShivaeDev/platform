import { Effect, Fiber } from "effect";
import { countWords } from "@shivaedev/test/answers.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Note } from "#modules/notes/notes.ts";
import { authPost, credentials } from "#test-support/authHttp.ts";
import {
	type DeploymentEngine,
	deploymentControls,
	deploymentEngine,
	deploymentVerbs,
	releaseEnv,
	webAddress,
} from "#test-support/deploymentProcesses.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { postgres } from "#test-support/postgres.ts";
import { watchBackends } from "#test-support/watchBackends.ts";
import { holdJob } from "./holdJob.ts";
import { watchedNote } from "./live.ts";
import { type NotesRequests, notesRequests } from "./requests.ts";

const LISTEN_CONNECTIONS = 2;
const CONNECTION_LIMIT = 2 * (testPoolSizes.sql + testPoolSizes.jobs) + LISTEN_CONNECTIONS;

interface Account {
	readonly cookie: string;
	readonly notes: NotesRequests;
}

interface NotesDeploymentEngine extends DeploymentEngine {
	readonly accounts: Map<string, Account>;
	held: Effect.Success<ReturnType<typeof holdJob>> | undefined;
	readonly stopping: Map<string, Fiber.Fiber<unknown, unknown>>;
	tell: (line: string) => void;
}

function wordCountWords(wordCount: number | null) {
	return wordCount === null ? "not counted" : countWords(wordCount, "word");
}

export const notesDeployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): NotesDeploymentEngine => ({
		...deploymentEngine(),
		accounts: new Map(),
		held: undefined,
		stopping: new Map(),
		tell: () => undefined,
	}),
	inspect: ({ accounts, address, processes }) => ({ accounts: [...accounts.keys()], address, processes: [...processes.keys()] }),
	layer: postgres,
	name: "notes deployment",
	stages: ["release", "web", "accounts"],
	verbs: (engine, story) => {
		engine.tell = story.tell;
		const { processOf } = deploymentControls(engine);
		function account(name: string) {
			const found = engine.accounts.get(name);
			if (found === undefined) {
				throw new Error(`${name} has no account; give the story signedUp("${name}")`);
			}
			return found;
		}
		function held() {
			if (engine.held === undefined) {
				throw new Error("No note is held; call noteIsHeld(note) first");
			}
			return engine.held;
		}
		const wordCountArrives = Effect.fn("DeploymentStory.wordCountArrives")(function* (name: string, note: Pick<Note, "id">) {
			const address = webAddress(engine);
			const watched = yield* watchedNote({ baseUrl: address, origin: address }, account(name).cookie, note.id);
			while (true) {
				const current = yield* watched.nextNote();
				if (typeof current === "string") {
					return current;
				}
				if (current.wordCount !== null) {
					return wordCountWords(current.wordCount);
				}
			}
		});
		return {
			...deploymentVerbs(engine, story.tell),
			connectionsAreWatched: Effect.fn("DeploymentStory.connectionsAreWatched")(function* () {
				story.tell("sample the app's PostgreSQL connections from now on");
				const activity = yield* watchBackends();
				return {
					peak: Effect.fn("DeploymentStory.peak")(function* () {
						yield* activity.stop;
						const counts = activity.counts();
						const peak = Math.max(...counts);
						return counts.length > 1 && Math.min(...counts) > 0 && peak <= CONNECTION_LIMIT
							? "within the pool limits"
							: `peaked at ${peak} of ${CONNECTION_LIMIT} connections over ${counts.length} samples`;
					}),
				};
			}),
			heartbeatWindowPasses: () => {
				story.tell("the draining worker outlives the heartbeat staleness window");
				return Effect.sleep("6 seconds");
			},
			heldNoteIsReleased: () => {
				story.tell("the lock on the held note is released");
				return held().release;
			},
			noteIsHeld: Effect.fn("DeploymentStory.noteIsHeld")(function* (note: Pick<Note, "id" | "title">) {
				story.tell(`another session locks ${JSON.stringify(note.title)}, so its word count blocks`);
				engine.held = yield* holdJob(note.id);
			}),
			notesOf: (name: string) => account(name).notes,
			sessionsCreateNotesAtOnce: Effect.fn("DeploymentStory.sessionsCreateNotesAtOnce")(function* (name: string, sessions: number) {
				story.tell(`${name} signs in ${sessions} times at once and each session creates a note`);
				const address = webAddress(engine);
				return yield* Effect.all(
					Array.from({ length: sessions }, (_, index) =>
						Effect.gen(function* () {
							const session = yield* authPost(address, "sign-in/email", credentials(name));
							const notes = yield* notesRequests({ baseUrl: address, origin: address }, name, session.cookie, () => undefined);
							const note = yield* notes.create(`Concurrent note ${index}`);
							return yield* wordCountArrives(name, note);
						}),
					),
					{ concurrency: "unbounded" },
				);
			}),
			wordCountArrives: (name: string, note: Pick<Note, "id" | "title">) => {
				story.tell(`${name} watches ${JSON.stringify(note.title)} until its word count arrives`);
				return wordCountArrives(name, note);
			},
			wordCountBlocks: () => {
				story.tell("the worker's word count waits on the held note");
				return held().blocked;
			},
			wordCountOf: Effect.fn("DeploymentStory.wordCountOf")(function* (name: string, note: Pick<Note, "id" | "title">) {
				return wordCountWords((yield* account(name).notes.open(note)).wordCount);
			}),
			workerHasStopped: Effect.fn("DeploymentStory.workerHasStopped")(function* (release: string) {
				const stopping = engine.stopping.get(release);
				if (stopping !== undefined) {
					yield* Fiber.join(stopping);
				}
				return `exited with code ${yield* processOf(`${release} worker`).exitCode}`;
			}),
			workerIsAskedToStop: Effect.fn("DeploymentStory.workerIsAskedToStop")(function* (release: string) {
				story.tell(`the ${release} worker receives SIGTERM`);
				engine.stopping.set(release, yield* processOf(`${release} worker`).child.kill().pipe(Effect.forkScoped));
			}),
			workerIsKilled: Effect.fn("DeploymentStory.workerIsKilled")(function* (release: string) {
				story.tell(`the ${release} worker is killed`);
				yield* processOf(`${release} worker`).child.kill({ killSignal: "SIGKILL" });
			}),
			workerPauses: Effect.fn("DeploymentStory.workerPauses")(function* (release: string) {
				yield* processOf(`${release} worker`).paused;
				return "paused";
			}),
			workerPollPasses: () => {
				story.tell("a worker polling interval passes");
				return Effect.sleep("1200 millis");
			},
			workerResumes: Effect.fn("DeploymentStory.workerResumes")(function* (release: string) {
				yield* processOf(`${release} worker`).resumed;
				return "resumed";
			}),
		};
	},
});

export function releaseMigrated(release: string) {
	return notesDeployment.trait("release", `release ${release} has migrated the database`, function* (engine) {
		const { processOf, start } = deploymentControls(engine);
		const migration = yield* start(`${release} migration`, "migrate", releaseEnv(release));
		const code = yield* migration.exitCode;
		if (code !== 0) {
			return yield* Effect.die(`The ${release} migration exited with code ${code}\n${processOf(`${release} migration`).errors.join("\n")}`);
		}
	});
}

export function webRunning(env: Record<string, string> = {}) {
	return notesDeployment.trait("web", "the web process is running", function* (engine) {
		const { start } = deploymentControls(engine);
		engine.address = yield* (yield* start("web", "web", env)).ready;
	});
}

export function signedUp(name: string) {
	return notesDeployment.trait("accounts", `${name} has signed up over HTTP`, function* (engine) {
		const address = webAddress(engine);
		const { cookie } = yield* authPost(address, "sign-up/email", credentials(name));
		engine.accounts.set(name, {
			cookie,
			notes: yield* notesRequests({ baseUrl: address, origin: address }, name, cookie, (line) => engine.tell(line)),
		});
	});
}
