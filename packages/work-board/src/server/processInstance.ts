import { randomUUID } from "node:crypto";
import { link, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { Clock, Effect, Schema } from "effect";

export const ProcessInstance = Schema.Struct({
	boardPort: Schema.optional(Schema.Number),
	daemonPort: Schema.optional(Schema.Number),
	kind: Schema.Literals(["up", "daemon", "board"]),
	ownerPid: Schema.optional(Schema.Number),
	pid: Schema.Number,
	startedAt: Schema.String,
	token: Schema.String,
});
export type ProcessInstance = typeof ProcessInstance.Type;

export const SUPERVISOR_ENV = "WORK_BOARD_SUPERVISOR";
export function instanceFile(root: string, kind: ProcessInstance["kind"]) {
	return join(root, `.work-${kind}.json`);
}

export function alive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ESRCH") {
			return false;
		}
		throw error;
	}
}

export function describeInstance(instance: ProcessInstance) {
	return `${instance.kind} pid ${instance.pid}, Fleet port ${instance.daemonPort ?? "none"}, Board port ${instance.boardPort ?? "none"}, started ${instance.startedAt}`;
}

function io<A>(run: () => Promise<A>) {
	return Effect.tryPromise({ catch: (cause) => new Error(String(cause)), try: run });
}

async function readInstanceFile(root: string, kind: ProcessInstance["kind"]) {
	try {
		return Schema.decodeUnknownSync(Schema.fromJsonString(ProcessInstance))(await readFile(instanceFile(root, kind), "utf8"));
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return undefined;
		}
		throw error;
	}
}

export function readInstance(root: string, kind: ProcessInstance["kind"]) {
	return io(() => readInstanceFile(root, kind));
}

export const currentInstance = Effect.fn("WorkBoard.currentInstance")(function* (
	kind: ProcessInstance["kind"],
	ports: { readonly boardPort?: number; readonly daemonPort?: number } = {},
) {
	return {
		...ports,
		kind,
		pid: process.pid,
		startedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
		token: randomUUID(),
	} satisfies ProcessInstance;
});

async function reclaimInstance(target: string, previous: ProcessInstance | undefined) {
	const aside = `${target}.${randomUUID()}.stale`;
	try {
		await rename(target, aside);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return;
		}
		throw error;
	}
	try {
		const moved = Schema.decodeUnknownSync(Schema.fromJsonString(ProcessInstance))(await readFile(aside, "utf8"));
		if (moved.token !== previous?.token && alive(moved.pid)) {
			await link(aside, target).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== "EEXIST") {
					throw error;
				}
			});
			throw new Error(`Board is held by ${describeInstance(moved)}`);
		}
	} finally {
		await unlink(aside);
	}
}

export const acquireInstance = Effect.fn("WorkBoard.acquireInstance")(function* (root: string, instance: ProcessInstance, slot = instance.kind) {
	const directory = yield* io(() => realpath(root));
	const target = instanceFile(directory, slot);
	yield* Effect.acquireRelease(
		io(async () => {
			const pending = `${target}.${instance.token}.tmp`;
			await writeFile(pending, JSON.stringify(instance));
			try {
				for (;;) {
					try {
						await link(pending, target);
						return;
					} catch (error) {
						if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
							throw error;
						}
					}
					const previous = await readInstanceFile(directory, slot);
					if (previous !== undefined && alive(previous.pid)) {
						throw new Error(`Board is held by ${describeInstance(previous)}`);
					}
					await reclaimInstance(target, previous);
				}
			} finally {
				await unlink(pending);
			}
		}),
		() =>
			readInstance(directory, slot).pipe(
				Effect.flatMap((current) => (current?.token === instance.token ? io(() => unlink(target)) : Effect.void)),
				Effect.orDie,
			),
	);
	return instance;
});
