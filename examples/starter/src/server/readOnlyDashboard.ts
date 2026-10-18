import { URL } from "node:url";
import { Worker as NodeWorker } from "node:worker_threads";
import type { DashboardHandler } from "@pg-boss/dashboard/handler";
import { Effect } from "effect";

interface Reply {
	readonly body: Uint8Array<ArrayBuffer>;
	readonly headers: [string, string][];
	readonly status: number;
}

export const readOnlyDashboard = Effect.fn("App.readOnlyDashboard")(function* (databaseUrl: string) {
	const worker = yield* Effect.acquireRelease(
		Effect.sync(
			() =>
				new NodeWorker(new URL(import.meta.resolve("./readOnlyDashboardWorker.ts")), {
					env: { "PGBOSS_DASHBOARD_READ_ONLY": "1" },
					execArgv: [],
					workerData: { databaseUrl },
				}),
		),
		(value) =>
			Effect.promise(async () => {
				await value.terminate();
			}),
	);
	let nextId = 0;
	let stopped: Error | undefined;
	const pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();
	function fail(error: Error) {
		stopped = error;
		for (const request of pending.values()) {
			request.reject(error);
		}
		pending.clear();
	}
	worker.on("error", fail);
	worker.on("exit", () => fail(new Error("Job board worker stopped")));
	worker.on("message", ({ id, reply, error }: { id: number; reply: Reply; error?: string }) => {
		const request = pending.get(id);
		pending.delete(id);
		if (error === undefined) {
			request?.resolve(reply);
		} else {
			request?.reject(new Error(error));
		}
	});
	function call(message: { readonly url: string; readonly method: string; readonly headers: [string, string][] } | "close") {
		return new Promise<Reply>((resolve, reject) => {
			if (stopped !== undefined) {
				reject(stopped);
				return;
			}
			nextId += 1;
			const id = nextId;
			pending.set(id, { reject, resolve });
			worker.postMessage({ id, message });
		});
	}
	const handler: DashboardHandler = Object.assign(
		async (request: Request) => {
			const reply = await call({ headers: [...request.headers], method: request.method, url: request.url });
			const body = request.method === "HEAD" || [204, 205, 304].includes(reply.status) ? null : reply.body;
			return new Response(body, { headers: reply.headers, status: reply.status });
		},
		{
			close: async () => {
				if (stopped === undefined) {
					await call("close");
				}
			},
		},
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => handler.close()));
	return handler;
});
