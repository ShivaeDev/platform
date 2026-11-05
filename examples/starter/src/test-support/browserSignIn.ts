import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { passwordUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { browserAuthRequests } from "#test-support/browserAuthRequests.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";

const browserPostgres = Layer.merge(postgres, NodeServices.layer);
const alice = { email: "alice@app.test", password: "alice-current-password" };
const PASSWORD_HASH =
	"da7da4d4b2032d3db171953d91a26aa7:09ada347bcc8b3af83791aed7eb697747595c424fed117a5e0c7bc9979aee2c651444f6bb887c8eade00aade1f93d6db5ae0b4c0d5e4b08d9296d2d6359ed7ab";

export const browserSignIn = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const host = yield* startHost();
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "browser-sign-in-" });
		return { host, requests: yield* browserAuthRequests(host.baseUrl), root };
	},
	inspect: ({ requests }) => requests.adoption(),
	layer: browserPostgres,
	name: "browser-check password sign-in",
	runIf: configured,
	stages: ["account"],
	verbs: ({ host, requests, root }, story) => ({
		checksSessionPages: Effect.fn("BrowserAuthStory.checksSessionPages")(function* (password = alice.password) {
			story.tell("browser-check attempts alice's sign-in before opening two session pages");
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(
				ChildProcess.make(
					process.execPath,
					[
						"--conditions=@shivaedev/source",
						fileURLToPath(import.meta.resolve("@shivaedev/browser-check/cli.ts")),
						"--url",
						host.baseUrl,
						"--page",
						"/api/auth/get-session?first",
						"--page",
						"/api/auth/get-session?second",
						"--text",
						alice.email,
					],
					{
						cwd: root,
						env: { "BROWSER_CHECK_EMAIL": alice.email, "BROWSER_CHECK_PASSWORD": password },
						extendEnv: true,
					},
				),
			);
			const [code, stdout, stderr] = yield* Effect.all(
				[child.exitCode, Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr))],
				{ concurrency: "unbounded" },
			);
			return { exitCode: Number(code), stderr, stdout };
		}),
		cookieAdoption: () => Effect.sync(requests.adoption),
	}),
});

export const aliceHasPasswordAccount = browserSignIn.trait(
	"account",
	"alice has an existing account with a precomputed password hash, without a browser session",
	function* ({ host }) {
		const auth = yield* sessionPrecondition(host);
		yield* passwordUser(auth, { email: alice.email, name: "alice", passwordHash: PASSWORD_HASH });
	},
);
