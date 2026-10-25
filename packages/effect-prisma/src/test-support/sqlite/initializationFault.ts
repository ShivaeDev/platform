import * as sqliteRuntime from "@prisma-next/sqlite/runtime";
import { Effect } from "effect";
import { vi } from "vitest";

vi.mock("@prisma-next/sqlite/runtime", async (importOriginal) => {
	const actual = await importOriginal<typeof sqliteRuntime>();
	return { ...actual, default: vi.fn(actual.default) };
});

export function initializationFault() {
	return {
		enabled: false,
		observe: (): { closeCalls: number; closed: boolean; connected: boolean; discoveryAttempts: number; operations: readonly string[] } => ({
			closeCalls: 0,
			closed: false,
			connected: false,
			discoveryAttempts: 0,
			operations: [],
		}),
	};
}

export const failInitialization = Effect.fnUntraced(function* (fault: ReturnType<typeof initializationFault>) {
	const { default: create } = yield* Effect.promise(() => vi.importActual<typeof sqliteRuntime>("@prisma-next/sqlite/runtime"));
	let dispose: (() => Promise<void>) | undefined;
	const factory = vi.mocked(sqliteRuntime.default).mockImplementation((options) => {
		const client = create(options);
		const connect = client.connect.bind(client);
		const close = client.close.bind(client);
		const operations: string[] = [];
		const closeSpy = vi.spyOn(client, "close").mockImplementation(async () => {
			operations.push("close");
			await close();
		});
		let connected = false;
		let discoveryAttempts = 0;
		const connectSpy = vi.spyOn(client, "connect").mockImplementation(async (...args) => {
			const runtime = await connect(...args);
			connected = true;
			Object.defineProperty(client, "orm", {
				get() {
					discoveryAttempts += 1;
					operations.push("discover models");
					throw new Error("model discovery failed");
				},
			});
			return runtime;
		});
		fault.observe = () => {
			let closed = false;
			try {
				client.runtime();
			} catch (error) {
				if (!(error instanceof Error) || error.message !== "SQLite client is closed") {
					throw error;
				}
				closed = true;
			}
			return { closeCalls: closeSpy.mock.calls.length, closed, connected, discoveryAttempts, operations };
		};
		dispose = async () => {
			connectSpy.mockRestore();
			closeSpy.mockRestore();
			await close();
		};
		return client;
	});
	fault.enabled = true;
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			factory.mockReset();
			await dispose?.();
		}),
	);
});
