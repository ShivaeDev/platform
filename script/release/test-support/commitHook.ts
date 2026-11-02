import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

export const commitHook = Effect.fn("ReleasePullRequest.commitHook")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const server = yield* fakeHttpService({ routes: { commit: { path: "/commit", reply: () => ({}) } } });
	const held = yield* server.hold("commit");
	return {
		blockCommit: Effect.fn("ReleasePullRequest.blockCommit")(function* () {
			const path = join(root, ".git/hooks/pre-commit");
			yield* fs.writeFileString(path, `#!/usr/bin/env node\nfetch(${JSON.stringify(`${server.url}/commit`)}).catch(() => process.exit(1));\n`);
			yield* fs.chmod(path, 0o755);
		}),
		waiting: () => held.waiting,
	};
});
