export const AMBIENT_RUNTIME_CASES = [
	["a Clock runSync", "Effect.runSync(Clock.currentTimeMillis)"],
	["a Config runSync", 'Effect.runSync(Config.string("TOKEN"))'],
	["a Random runSync", "Effect.runSync(Random.next)"],
	["a Clock runPromise", "Effect.runPromise(Clock.currentTimeMillis)"],
	["a Random runFork", "Effect.runFork(Random.next)"],
	["a piped Config run", 'Effect.runSync(Config.string("TOKEN").pipe(Effect.orDie))'],
	["a generated Clock run", "Effect.runSync(Effect.gen(function* () { return yield* Clock.currentTimeMillis; }))"],
	["a piped Clock runner", "Clock.currentTimeMillis.pipe(Effect.runSync)"],
	["a piped Config runner", 'Config.string("TOKEN").pipe(Effect.orDie, Effect.runSync)'],
	["a piped Random runner", "Random.next.pipe(Effect.runPromise)"],
	["a captured unsafe clock", "clock.currentTimeMillisUnsafe()"],
	["a captured unsafe clock method", "clock.currentTimeMillisUnsafe"],
	["a crypto UUID", "crypto.randomUUID()"],
	["crypto bytes", "crypto.randomBytes(16)"],
	["an imported UUID", "randomUUID()"],
	["imported crypto bytes", "randomBytes(16)"],
	["a global crypto UUID", "globalThis.crypto.randomUUID()"],
	["global crypto bytes", "globalThis.crypto.randomBytes(16)"],
	["performance time", "performance.now()"],
	["process arguments", "process.argv"],
	["the working directory", "process.cwd()"],
	["a process exit", "process.exit(1)"],
	["a process exit code", "(process.exitCode = 1)"],
	["a global process exit code", "globalThis.process.exitCode"],
	["global process configuration", "globalThis.process.env.TOKEN"],
	["a timeout", "setTimeout(work, 1)"],
	["a microtask", "queueMicrotask(work)"],
	["a global timeout", "globalThis.setTimeout(work, 1)"],
	["a global microtask", "globalThis.queueMicrotask(work)"],
] as const;

const RUNTIME_EDGES = [
	"src/cli.ts",
	"src/nested/main.ts",
	"src/task-cli.ts",
	"tools/tool.config.ts",
	"src/nested/adapters/bridge.ts",
	"src/test-support/fixture.ts",
	"src/fixture.spec.ts",
	"src/fixture.test.ts",
] as const;

export function ambientFiles(expression: string) {
	const content = `import * as crypto from "node:crypto";\nimport { randomUUID, randomBytes } from "node:crypto";\nvoid ${expression};\n`;
	return [
		...["src/core.ts", "src/client.ts", ...RUNTIME_EDGES].map((path) => ({ content, path })),
		{ content: `${content}NodeRuntime.runMain(program);\n`, path: "src/bootstrap.ts" },
		{ content: `${content}program.pipe(NodeRuntime.runMain);\n`, path: "src/start.ts" },
		{ content: `${content}if (fileURLToPath(import.meta.url) === process.argv[1]) start();\n`, path: "src/attempt.ts" },
	];
}
