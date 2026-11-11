import { Effect, Option, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { HeldLock } from "@shivaedev/heavy-lock/HeldLock.ts";
import { projectScripts } from "#engine/projectScripts.ts";
import { SetupFailure } from "#failure.ts";

const SCRIPT = "generate";

// Generated files are not committed, so the project writes them before any rule reads an import of them; a run holding the heavy lock lends it to the generator. An unreadable manifest names no script, and manifests/valid reports it.
export const generateFirst = Effect.fn("Engine.generateFirst")(
	function* (root: string) {
		const project = yield* projectScripts(root, [SCRIPT]).pipe(
			Effect.catchTags({ FilesystemFailure: () => Effect.undefined, ManifestFailure: () => Effect.undefined }),
		);
		if (project === undefined || project.scripts.length === 0) {
			return;
		}
		const { manager } = project;
		const held = yield* Effect.serviceOption(HeldLock);
		const env = Option.match(held, { onNone: () => ({}), onSome: (lock) => lock.env });
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(ChildProcess.make(manager, ["run", SCRIPT], { cwd: root, env, extendEnv: true, stdin: "ignore" }));
		const [output, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(child.all)), child.exitCode], { concurrency: "unbounded" });
		if (Number(code) !== 0) {
			return yield* new SetupFailure({
				message: `\`${manager} run ${SCRIPT}\` failed (exit ${code}) before Quality read the sources:\n${output.trimEnd()}`,
			});
		}
	},
	Effect.scoped,
	Effect.catchTag("PlatformError", (cause) => new SetupFailure({ cause, message: `cannot run the project's ${SCRIPT} script: ${cause.message}` })),
);
