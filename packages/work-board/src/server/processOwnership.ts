import process from "node:process";
import { Config, Effect, Option, Scope } from "effect";
import { acquireInstance, alive, currentInstance, describeInstance, type ProcessInstance, readInstance, SUPERVISOR_ENV } from "./processInstance.ts";

const running = Effect.fn("WorkBoard.running")(function* (root: string, kind: ProcessInstance["kind"]) {
	const instance = yield* readInstance(root, kind);
	return instance !== undefined && alive(instance.pid) ? instance : undefined;
});

const checkChildren = Effect.fn("WorkBoard.checkChildren")(function* (root: string) {
	for (const kind of ["daemon", "board"] as const) {
		let instance = yield* running(root, kind);
		while (instance?.ownerPid !== undefined && !alive(instance.ownerPid)) {
			yield* Effect.sleep("100 millis");
			instance = yield* running(root, kind);
		}
		if (instance !== undefined) {
			return yield* Effect.fail(new Error(`Board is held by ${describeInstance(instance)}`));
		}
	}
});

export const claimSupervisor = Effect.fn("WorkBoard.claimSupervisor")(function* (root: string, instance: ProcessInstance) {
	yield* acquireInstance(root, instance);
	yield* checkChildren(root);
});

export const claimProcess = Effect.fn("WorkBoard.claimProcess")(function* (
	root: string,
	kind: "board" | "daemon",
	ports: { readonly boardPort?: number; readonly daemonPort?: number },
) {
	const owner = yield* running(root, "up");
	const supervised = owner?.kind === "up" && Option.contains(yield* Config.option(Config.String(SUPERVISOR_ENV)), owner.token);
	const instance = { ...(yield* currentInstance(kind, ports)), ...(supervised ? { ownerPid: owner.pid } : {}) };
	if (supervised) {
		yield* acquireInstance(root, instance);
		yield* Effect.forkScoped(
			Effect.gen(function* () {
				while (alive(owner.pid)) {
					yield* Effect.sleep("1 second");
				}
				process.kill(process.pid, "SIGTERM");
			}),
		);
	} else {
		const held = yield* Effect.scope;
		yield* Effect.scoped(
			Effect.gen(function* () {
				yield* acquireInstance(root, instance, "up");
				yield* acquireInstance(root, instance).pipe(Scope.provide(held));
			}),
		);
	}
});

export const processes = {
	alive,
	claimProcess,
	claimSupervisor,
	currentInstance,
	describeInstance,
	read: running,
	supervisorEnvironment: SUPERVISOR_ENV,
};
