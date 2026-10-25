import { createRequire, syncBuiltinESMExports } from "node:module";
// Materialize Node's lazy stdio exports before guarding Socket construction.
import "node:process";
import { fileURLToPath } from "node:url";

const load = createRequire(import.meta.url);
const setupFile = fileURLToPath(import.meta.url);
const installed = Symbol.for("@shivaedev/quality/unitIoGuard");

function assertUnitIoAllowed(call: string): void {
	const worker: { readonly filepath?: string } | undefined = Reflect.get(globalThis, "__vitest_worker__");
	const file = worker?.filepath;
	if (file === undefined || !/\.unit\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file)) {
		return;
	}
	const error = new Error(`Unit test ${file} cannot call ${call}; use a story through the package's kit for I/O.`);
	Error.captureStackTrace(error, assertUnitIoAllowed);
	const caller = error.stack
		?.split("\n")
		.slice(1)
		.find((line) => !(line.includes(setupFile) || /node:(?:fs|internal\/fs)/u.test(line)));
	// Node and Vitest still need to load the unit's modules; only their own immediate calls may pass.
	if (caller !== undefined && /node:internal\/modules\/|\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:vitest|@vitest|vite)\//u.test(caller)) {
		return;
	}
	throw error;
}

function guardModule(name: string): void {
	const module: Record<string, unknown> = load(name);
	for (const key of Object.keys(module)) {
		const original = module[key];
		if (typeof original !== "function") {
			continue;
		}
		Object.defineProperty(module, key, {
			configurable: true,
			enumerable: true,
			value: new Proxy(original, {
				apply(target, receiver, args) {
					assertUnitIoAllowed(`${name}.${key}`);
					return Reflect.apply(target, receiver, args);
				},
				construct(target, args, newTarget) {
					assertUnitIoAllowed(`${name}.${key}`);
					return Reflect.construct(target, args, newTarget);
				},
			}),
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
	globalThis.fetch = (...args) => {
		assertUnitIoAllowed("fetch");
		return fetch(...args);
	};
	syncBuiltinESMExports();
}
