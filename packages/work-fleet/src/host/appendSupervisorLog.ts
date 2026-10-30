import { Buffer } from "node:buffer";
import { Effect, FileSystem, Semaphore } from "effect";

const MAX_BYTES = 5 * 1024 * 1024;
const BACKUPS = 3;
const writing = Semaphore.makeUnsafe(1);

const rotate = Effect.fnUntraced(function* (log: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.remove(`${log}.${BACKUPS}`, { force: true });
	for (let index = BACKUPS - 1; index >= 0; index -= 1) {
		const source = index === 0 ? log : `${log}.${index}`;
		if (yield* fs.exists(source)) {
			yield* fs.rename(source, `${log}.${index + 1}`);
		}
	}
});

export const appendSupervisorLog = Effect.fn("FleetSupervisor.appendSupervisorLog")(function* (log: string, text: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* writing.withPermit(
		Effect.gen(function* () {
			const size = (yield* fs.exists(log)) ? Number((yield* fs.stat(log)).size) : 0;
			if (size > 0 && size + Buffer.byteLength(text) > MAX_BYTES) {
				yield* rotate(log);
			}
			yield* fs.writeFileString(log, text, { flag: "a" });
		}).pipe(Effect.uninterruptible),
	);
});
