import { type SqlMiddleware, SqlRuntimeBase } from "@prisma-next/sql-runtime";
import { Effect } from "effect";
import { vi } from "vitest";

export function signal() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve, wait: Effect.promise(() => promise) };
}

type RuntimeFaults = Partial<Record<"commit" | "rollback" | "release", unknown>>;
export function makeRuntimeControls() {
	const calls: string[] = [];
	const destroyReasons: unknown[] = [];
	const faults: RuntimeFaults = {};
	return {
		afterQuery: (): void => undefined,
		beforeQuery: () => Promise.resolve(),
		beforeSettlement: () => Promise.resolve(),
		calls,
		destroyReasons,
		faults,
		releaseSettlement: signal(),
		resume: (): void => undefined,
		settlementStarted: signal(),
	};
}
export type RuntimeControls = ReturnType<typeof makeRuntimeControls>;
let active: RuntimeControls | undefined;
export const controlledRuntime: SqlMiddleware = {
	afterExecute: () => {
		active?.afterQuery();
		return Promise.resolve();
	},
	beforeExecute: () => active?.beforeQuery(),
	name: "story-runtime-controls",
};

export const installRuntimeControls = Effect.fnUntraced(function* () {
	const controls = makeRuntimeControls();
	active = controls;
	const connection = SqlRuntimeBase.prototype.connection;
	const spy = vi.spyOn(SqlRuntimeBase.prototype, "connection").mockImplementation(async function (this: SqlRuntimeBase) {
		const real = await connection.call(this);
		const begin = real.transaction.bind(real);
		const release = real.release.bind(real);
		const destroy = real.destroy.bind(real);
		real.transaction = async () => {
			const transaction = await begin();
			for (const method of ["commit", "rollback"] as const) {
				const original = transaction[method].bind(transaction);
				transaction[method] = async () => {
					controls.calls.push(method);
					await controls.beforeSettlement();
					if (controls.faults[method] !== undefined) {
						throw controls.faults[method];
					}
					await original();
				};
			}
			return transaction;
		};
		real.release = async () => {
			controls.calls.push("release");
			if (controls.faults.release !== undefined) {
				throw controls.faults.release;
			}
			await release();
		};
		real.destroy = async (reason) => {
			controls.calls.push("destroy");
			controls.destroyReasons.push(reason);
			await destroy(reason);
		};
		return real;
	});
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			controls.resume();
			active = undefined;
			spy.mockRestore();
		}),
	);
	return controls;
});
