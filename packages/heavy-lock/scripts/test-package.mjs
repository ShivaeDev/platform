import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "heavy-lock-consumer-"));
const tarball = join(temporaryDirectory, "heavy-lock.tgz");
const lock = join(temporaryDirectory, "locks", "heavy-process.lock");

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

const { CI: _ci, HEAVY_PROCESS_LOCK_ID: _inherited, ...inheritedEnvironment } = process.env;
const environment = {
	...inheritedEnvironment,
	HEAVY_PROCESS_LOCK: lock,
	PATH: `${join(temporaryDirectory, "node_modules/.bin")}:${process.env.PATH}`,
};

const expectRun = (command, arguments_, status, stdout = undefined) => {
	const result = spawnSync(command, arguments_, { cwd: temporaryDirectory, encoding: "utf8", env: environment });
	if (result.status !== status || (stdout !== undefined && result.stdout !== stdout) || result.stderr !== "" || existsSync(lock)) {
		throw new Error(
			`${command} ${arguments_.join(" ")} exited ${result.status} (expected ${status}), lock left: ${existsSync(lock)}:\n${result.stdout}${result.stderr}`,
		);
	}
};

const writeJson = (path, value) => writeFile(join(temporaryDirectory, path), `${JSON.stringify(value, null, 2)}\n`);

const source = (path, content) => writeFile(join(temporaryDirectory, path), content);

try {
	execute("pnpm", ["pack", "--out", tarball], packageRoot);

	const contents = execute("tar", ["-tzf", tarball]).trim().split("\n");
	for (const required of [
		"package/dist/cli.js",
		"package/dist/index.js",
		"package/dist/index.d.ts",
		"package/dist/index.d.ts.map",
		"package/src/index.ts",
		"package/CHANGELOG.md",
		"package/README.md",
	]) {
		if (!contents.includes(required)) {
			throw new Error(`Packed package is missing ${required}`);
		}
	}
	if (contents.some((path) => path.startsWith("package/test/"))) {
		throw new Error("Packed package unexpectedly contains its test suite");
	}
	const packedManifest = JSON.parse(execute("tar", ["-xOzf", tarball, "package/package.json"]));
	if (packedManifest.bin?.["heavy-lock"] !== "./dist/cli.js" || JSON.stringify(packedManifest.peerDependencies).includes("catalog:")) {
		throw new Error("Packed manifest must expose the heavy-lock bin and pin its peer dependencies");
	}

	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	await writeJson("package.json", {
		name: "heavy-lock-consumer",
		private: true,
		type: "module",
		dependencies: {
			"@shivaedev/heavy-lock": `file:${tarball}`,
			"@types/node": manifest.devDependencies["@types/node"],
			...packedManifest.peerDependencies,
		},
	});
	// A consumer has none of this repository's overrides; keeping them would hide how the package resolves on its own.
	const workspace = await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
	await writeFile(join(temporaryDirectory, "pnpm-workspace.yaml"), workspace.replace(/^overrides:\n(?:(?:[ \t].*)?\n)*/m, ""));
	const compilerOptions = {
		lib: ["ESNext"],
		module: "ESNext",
		moduleResolution: "Bundler",
		noEmit: true,
		skipLibCheck: true,
		strict: true,
		target: "ESNext",
		types: ["node"],
		verbatimModuleSyntax: true,
	};
	await writeJson("tsconfig.json", { compilerOptions, include: ["typing.ts"] });
	await writeJson("tsconfig.nodenext.json", { extends: "./tsconfig.json", compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } });
	await source(
		"typing.ts",
		`import { NodeServices } from "@effect/platform-node"
import { acquireHeavyLock, HeavyLockError, HeldLock, heavyLockLayer, withHeavyLock } from "@shivaedev/heavy-lock"
import { Effect, Layer } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

const build = Effect.gen(function* () {
  const held = yield* HeldLock
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  return yield* spawner.exitCode(ChildProcess.make("pnpm", ["build"], { env: { ...held.env }, extendEnv: true, stdout: "inherit", stderr: "inherit" }))
})

export const program: Effect.Effect<number, HeavyLockError | import("effect").PlatformError.PlatformError> = withHeavyLock(build, {
  command: "pnpm build",
  lockPath: "/tmp/heavy.lock",
  pollInterval: "2 seconds",
}).pipe(Effect.provide(NodeServices.layer))

export const scoped = Effect.scoped(acquireHeavyLock()).pipe(Effect.provide(NodeServices.layer))
export const layered: Layer.Layer<HeldLock, HeavyLockError> = heavyLockLayer().pipe(Layer.provide(NodeServices.layer))
export const failure = (error: HeavyLockError): string => error.message

// @ts-expect-error The lock needs Node services until they are provided.
export const unprovided: Effect.Effect<number, unknown> = withHeavyLock(build)
`,
	);
	await source(
		"run.mjs",
		`import { readFileSync } from "node:fs"
import { NodeServices } from "@effect/platform-node"
import { HeldLock, withHeavyLock } from "@shivaedev/heavy-lock"
import { Effect } from "effect"

const held = await Effect.runPromise(
  withHeavyLock(
    Effect.gen(function* () {
      const held = yield* HeldLock
      return { env: held.env, file: JSON.parse(readFileSync(process.env.HEAVY_PROCESS_LOCK, "utf8")) }
    }),
    { command: "consumer" },
  ).pipe(
    Effect.provide(NodeServices.layer),
  ),
)
if (held.file.command !== "consumer" || held.env.HEAVY_PROCESS_LOCK_ID !== held.file.id) {
  throw new Error("withHeavyLock did not hold the lock: " + JSON.stringify(held))
}
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	const installed = await readdir(join(temporaryDirectory, "node_modules/.pnpm"));
	for (const name of ["effect", "@effect/platform-node-shared"]) {
		const prefix = `${name.replace("/", "+")}@`;
		const copies = installed.filter((entry) => entry.startsWith(prefix)).map((entry) => entry.split("_")[0]);
		if (copies.join() !== `${prefix}${packedManifest.peerDependencies[name]}`) {
			throw new Error(`Consumer must hold one ${name} copy at the peer version, found: ${copies.join(", ")}`);
		}
	}
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);

	expectRun("node", ["run.mjs"], 0);
	expectRun("heavy-lock", ["--", "sh", "-c", 'grep -q "\\"id\\":\\"$HEAVY_PROCESS_LOCK_ID\\"" "$HEAVY_PROCESS_LOCK" && echo held'], 0, "held\n");
	expectRun("heavy-lock", ["--", "heavy-lock", "--", "sh", "-c", 'echo "nested $HEAVY_PROCESS_LOCK_ID" | grep -q "^nested ." && exit 4'], 4);
	expectRun("heavy-lock", ["--", "node", "-e", "process.exit(3)"], 3);
	expectRun("heavy-lock", ["--", "sh", "-c", "kill -TERM $$"], 143);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
