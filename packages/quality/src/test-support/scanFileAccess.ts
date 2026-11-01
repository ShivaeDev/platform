import { rmSync } from "node:fs";
import { join, relative } from "node:path";
import { Deferred, Effect, Fiber, FileSystem } from "effect";
import { type PlatformError, systemError } from "effect/PlatformError";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import { loadConfig, type ResolvedConfig } from "#config/load.ts";
import { scan } from "#engine/session.ts";
import type { Violation } from "#engine/violation.ts";
import { seedTree } from "./tree.ts";

interface ScanState {
	readonly config: ResolvedConfig;
	fiber: Fiber.Fiber<unknown, unknown> | undefined;
	read: Effect.Effect<string, PlatformError>;
	readonly reads: string[];
	readonly root: string;
	readonly started: Deferred.Deferred<void>;
	readonly stopped: Deferred.Deferred<void>;
	target: string;
	violations: readonly Violation[] | undefined;
}

export const scanFileAccess = storyKit({
	*create() {
		const root = seedTree([
			{ content: '{"version":"1.0.0","name":"app"}\n', path: "package.json" },
			{ content: '{"name":"next"}\n', path: "packages/next/package.json" },
			{ content: '{"compilerOptions":{"ignoreDeprecations":"6.0"}}', path: "tsconfig.json" },
		]);
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const config = yield* loadConfig(root, undefined);
		const fs = yield* FileSystem.FileSystem;
		const engine: ScanState = {
			config: {
				...config,
				active: config.active.filter(({ id }) => ["manifests/valid", "manifests/sorted", "suppressions/no-ignore-deprecations"].includes(id)),
			},
			fiber: undefined,
			read: fs.readFileString(join(root, "package.json")),
			reads: [],
			root,
			started: yield* Deferred.make<void>(),
			stopped: yield* Deferred.make<void>(),
			target: "package.json",
			violations: undefined,
		};
		const check = scan(engine.config).pipe(
			Effect.provideService(FileSystem.FileSystem, {
				...fs,
				readFileString: (path, encoding) => {
					engine.reads.push(relative(root, path));
					return path === join(root, engine.target) ? engine.read : fs.readFileString(path, encoding);
				},
			}),
			Effect.tap(({ violations }) =>
				Effect.sync(() => {
					engine.violations = violations;
				}),
			),
		);
		return { check, state: engine };
	},
	inspect: ({ state: { reads, violations } }) => ({ reads, violations }),
	layer: services,
	name: "Quality scan file access",
	stages: ["filesystem", "running"],
	verbs: ({ check, state: engine }, story) => ({
		checks: () => {
			story.tell("quality scans the repository through the supplied file system");
			return check;
		},
		findings: () =>
			Effect.sync(() => engine.violations?.map(({ file, message, rule }) => ({ file, message: message.replaceAll(engine.root, "<root>"), rule }))),
		interrupts: Effect.fn("ScanFileAccess.interrupts")(function* () {
			story.tell("the author interrupts the scan while a manifest read is pending");
			if (engine.fiber === undefined) {
				return yield* Effect.die(new Error("Start the scan before interrupting it"));
			}
			yield* Fiber.interrupt(engine.fiber);
		}),
		manifestReads: () => Effect.sync(() => engine.reads.filter((path) => path.endsWith("package.json"))),
		pendingRead: () => Effect.map(Deferred.isDone(engine.stopped), (done) => (done ? "stopped" : "pending")),
	}),
});

export function unavailableRead(path: string, reason: "NotFound" | "PermissionDenied") {
	return scanFileAccess.trait("filesystem", `the supplied file system returns ${reason} for ${path}`, ({ state: engine }) => {
		engine.target = path;
		engine.read = Effect.fail(systemError({ _tag: reason, method: "readFileString", module: "FileSystem", pathOrDescriptor: path }));
	});
}

export const manifestReadPending = scanFileAccess.trait(
	"filesystem",
	"the supplied file system holds the first manifest read open",
	({ state: engine }) => {
		engine.read = Effect.andThen(Deferred.succeed(engine.started, undefined), Effect.never).pipe(
			Effect.ensuring(Deferred.succeed(engine.stopped, undefined)),
		);
	},
);

export const scanRunning = scanFileAccess.trait("running", "quality is scanning with a pending manifest read", function* ({ check, state: engine }) {
	engine.fiber = yield* check.pipe(Effect.forkScoped);
	yield* Deferred.await(engine.started);
});
