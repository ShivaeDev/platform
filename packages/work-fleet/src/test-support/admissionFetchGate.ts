import { createServer, type Socket } from "node:net";
import { createInterface } from "node:readline";
import { Deferred, Effect } from "effect";

export function admissionFetchGate(path: string) {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			const entered = Deferred.makeUnsafe<void>();
			const sockets = new Set<Socket>();
			let enabled = false;
			let active = 0;
			let overlapped = false;
			let held: Socket | undefined;
			const server = createServer((socket) => {
				sockets.add(socket);
				socket.on("close", () => sockets.delete(socket));
				createInterface({ input: socket }).on("line", (line) => {
					if (line === "done") {
						active -= 1;
						socket.end("done\n");
						return;
					}
					overlapped ||= active > 0;
					active += 1;
					if (enabled && held === undefined) {
						held = socket;
						Deferred.doneUnsafe(entered, Effect.void);
					} else {
						socket.write("continue\n");
					}
				});
			});
			await new Promise<void>((resolve) => server.listen(path, resolve));
			return {
				close: async () => {
					for (const socket of sockets) {
						socket.destroy();
					}
					await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
				},
				enable: () => {
					enabled = true;
				},
				entered: Deferred.await(entered).pipe(Effect.timeout("5 seconds")),
				overlapped: () => overlapped,
				release: () => {
					enabled = false;
					held?.write("continue\n");
					held = undefined;
				},
			};
		}),
		(gate) => Effect.promise(gate.close),
	);
}
