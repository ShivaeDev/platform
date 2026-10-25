import { createRequire, syncBuiltinESMExports } from "node:module";
// Materialize Node's lazy stdio exports before guarding Socket construction.
import "node:process";

const load = createRequire(import.meta.url);
const installed = Symbol.for("@shivaedev/quality/unitIoGuard");
let loading = 0;

function assertUnitIoAllowed(call: string, boundary: (...args: never[]) => unknown): void {
	const worker: { readonly filepath?: string } | undefined = Reflect.get(globalThis, "__vitest_worker__");
	const file = worker?.filepath;
	if (loading > 0 || file === undefined || !/\.unit\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file)) {
		return;
	}
	const error = new Error(`Unit test ${file} cannot call ${call}; use a story through the package's kit for I/O.`);
	Error.captureStackTrace(error, boundary);
	const caller = error.stack
		?.split("\n")
		.slice(1)
		.find((line) => !/node:(?:fs|internal\/fs)/u.test(line));
	// Node and Vitest still need to load the unit's modules; only their own immediate calls may pass.
	if (caller !== undefined && /node:internal\/modules\/|\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:vitest|@vitest|vite)\//u.test(caller)) {
		return;
	}
	throw error;
}

function runAllowed<T>(run: () => T): T {
	loading += 1;
	try {
		return run();
	} finally {
		loading -= 1;
	}
}

function guardModule(name: string): void {
	const module: Record<string, unknown> = load(name);
	for (const key of Object.keys(module)) {
		const original = module[key];
		if (typeof original !== "function") {
			continue;
		}
		const apply: NonNullable<ProxyHandler<typeof original>["apply"]> = (target, receiver, args) => {
			assertUnitIoAllowed(`${name}.${key}`, apply);
			return runAllowed(() => Reflect.apply(target, receiver, args));
		};
		const construct: NonNullable<ProxyHandler<typeof original>["construct"]> = (target, args, newTarget) => {
			assertUnitIoAllowed(`${name}.${key}`, construct);
			return runAllowed(() => Reflect.construct(target, args, newTarget));
		};
		Object.defineProperty(module, key, {
			configurable: true,
			enumerable: true,
			value: new Proxy(original, { apply, construct }),
			writable: true,
		});
	}
}

if (Reflect.get(globalThis, installed) !== true) {
	Reflect.set(globalThis, installed, true);
	for (const name of ["node:fs", "node:fs/promises", "node:net", "node:http", "node:https", "node:child_process", "node:worker_threads"]) {
		guardModule(name);
	}
	const fetch = globalThis.fetch;
	globalThis.fetch = function unitIoFetch(...args) {
		assertUnitIoAllowed("fetch", unitIoFetch);
		return fetch(...args);
	};
	syncBuiltinESMExports();
}
