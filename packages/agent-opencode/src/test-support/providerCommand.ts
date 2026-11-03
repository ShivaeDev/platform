import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
export const providerCommand = Effect.fnUntraced(function* (url: string) {
	const directory = yield* Effect.acquireRelease(
		Effect.promise(() => mkdtemp(join(tmpdir(), "opencode-peer-"))),
		(path) => Effect.promise(() => rm(path, { force: true, recursive: true })),
	);
	const command = join(directory, "opencode");
	const source = `#!${process.execPath}
import { createServer } from 'node:http';
await fetch(${JSON.stringify(`${url}/peer/config`)}, { method: 'POST', body: process.env.OPENCODE_CONFIG_CONTENT });
createServer().listen(0, '127.0.0.1');
console.log('opencode server listening on ${url}');
`;
	yield* Effect.promise(async () => {
		await writeFile(command, source);
		await chmod(command, 0o755);
	});
	return command;
});
