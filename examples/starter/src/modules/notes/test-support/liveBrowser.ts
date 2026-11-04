import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, DateTime, Effect, FileSystem, Layer, Result } from "effect";
import { playwright } from "@shivaedev/browser-check/adapters/playwright.ts";
import { passwordUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes } from "@shivaedev/test-story/server/watchedClock.ts";
import { developmentServer } from "#test-support/developmentServer.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";
import { liveNotes as checkLiveNotes } from "#tooling/notes/browser-check/live.ts";

const credentials = { email: "alice@app.test", password: "alice-current-password" };
// Precomputed so an existing-account precondition does not hash a password on every run.
const PASSWORD_HASH =
	"da7da4d4b2032d3db171953d91a26aa7:09ada347bcc8b3af83791aed7eb697747595c424fed117a5e0c7bc9979aee2c651444f6bb887c8eade00aade1f93d6db5ae0b4c0d5e4b08d9296d2d6359ed7ab";

const browserLayer = playwright.pipe(Layer.provideMerge(NodeServices.layer));
const liveNotesLayer = Layer.merge(postgres, browserLayer);
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const enabled = Effect.runSync(
	Effect.all([Config.String("TEST_DATABASE_URL").pipe(Config.withDefault("")), Config.String("CI").pipe(Config.withDefault(""))]).pipe(
		Effect.map(([database, ci]) => Boolean(database || ci)),
	),
);

export const liveBrowser = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const host = yield* startHost();
		const auth = yield* sessionPrecondition(host);
		yield* passwordUser(auth, { email: credentials.email, name: "alice", passwordHash: PASSWORD_HASH });
		const { url } = yield* developmentServer(host.baseUrl);
		const fs = yield* FileSystem.FileSystem;
		const folder = yield* fs.makeTempDirectoryScoped({ prefix: "live-notes-browser-" });
		return { folder, outcome: "not run", url };
	},
	inspect: ({ outcome, url }) => ({ outcome, url }),
	layer: liveNotesLayer,
	name: "live notes browser",
	runIf: enabled,
	stages: [],
	verbs: (engine, story) => ({
		check: Effect.fn("LiveNotesStory.check")(function* () {
			story.tell("alice runs the live-notes browser check against the app with her existing account");
			const revalidationIntervalPasses = Effect.suspend(() => {
				story.tell("after alice signs out, the host's 30-second session revalidation interval passes on the controlled clock");
				return passes("30 seconds", Effect.void);
			});
			const result = yield* checkLiveNotes(engine.url, engine.folder, credentials, revalidationIntervalPasses).pipe(Effect.scoped, Effect.result);
			engine.outcome = Result.isFailure(result) ? result.failure.message : "passed";
		}),
		outcome: () => Effect.sync(() => engine.outcome),
		screenshots: Effect.fn("LiveNotesStory.screenshots")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const files = (yield* fs.readDirectory(engine.folder)).sort();
			return yield* Effect.forEach(files, (file) =>
				Effect.map(fs.readFile(`${engine.folder}/${file}`), (bytes) =>
					PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ? `${file}: PNG image` : `${file}: invalid image`,
				),
			);
		}),
	}),
});
