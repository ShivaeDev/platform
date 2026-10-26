import { Effect, FileSystem, Path, Schema } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";

const PORT_FILE = ".fleet-port";
const Port = Schema.NumberFromString.pipe(Schema.check(Schema.isInt(), Schema.isBetween({ maximum: 65_535, minimum: 1 })));

export const readDaemonPort = Effect.fn("FleetDaemon.readDaemonPort")(function* (board: string, override?: number) {
	if (override !== undefined) {
		return override;
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const file = path.join(path.resolve(board), PORT_FILE);
	const text = yield* fs
		.readFileString(file)
		.pipe(
			Effect.catchTag("PlatformError", (error) =>
				error.reason._tag === "NotFound"
					? Effect.succeed(String(diagnosticsApi.DAEMON_PORT))
					: Effect.fail(new ServiceUnavailable({ message: `Cannot read Fleet daemon port from ${file}: ${error.message}` })),
			),
		);
	return yield* Schema.decodeUnknownEffect(Port)(text.trim()).pipe(
		Effect.mapError(() => new ServiceUnavailable({ message: `Invalid Fleet daemon port in ${file}` })),
	);
});

export const publishDaemonPort = Effect.fn("FleetDaemon.publishDaemonPort")(function* (board: string) {
	const server = yield* HttpServer.HttpServer;
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP Fleet daemon");
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const file = path.join(board, PORT_FILE);
	const port = String(server.address.port);
	yield* Effect.acquireRelease(fs.writeFileString(`${file}.tmp`, `${port}\n`).pipe(Effect.andThen(fs.rename(`${file}.tmp`, file))), () =>
		Effect.gen(function* () {
			const current = yield* fs
				.readFileString(file)
				.pipe(Effect.catchTag("PlatformError", (error) => (error.reason._tag === "NotFound" ? Effect.succeed("") : Effect.fail(error))));
			if (current.trim() === port) {
				yield* fs.remove(file, { force: true });
			}
		}).pipe(Effect.orDie),
	);
});
