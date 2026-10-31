import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { engineProvider } from "#test/engineProvider.ts";
import { host } from "#test/hostStory.ts";

export const pendingNoChangeReview = host.trait("configuration", "the stock host adopts worker reports and awaits independent review", (engine) => {
	engine.config = { ...engine.config, result: "github" };
	const provider = engineProvider({ reviewRunning: true }, []);
	engine.providerFixture = provider;
	engine.provider = provider.transport;
});

export const noChangeMainHistory = host.trait("configuration", "main has advanced and a different branch has an unmerged commit", (engine) => {
	engine.beforeFixture = Effect.acquireRelease(
		Effect.sync(() => {
			const root = mkdtempSync(join(tmpdir(), "fleet-no-change-"));
			function git(...args: string[]) {
				return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
			}
			git("init", "--quiet", "--initial-branch=main");
			git("config", "user.name", "Fleet tests");
			git("config", "user.email", "fleet@example.test");
			git("commit", "--quiet", "--allow-empty", "-m", "Existing work");
			git("switch", "--quiet", "-c", "unmerged");
			git("commit", "--quiet", "--allow-empty", "-m", "Unmerged work");
			git("switch", "--quiet", "main");
			git("commit", "--quiet", "--allow-empty", "-m", "Main advances");
			git("remote", "add", "origin", root);
			engine.main = { observedAt: 1, revision: git("rev-parse", "main") };
			engine.repositoryRoot = root;
			return root;
		}),
		(root) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
	).pipe(Effect.asVoid);
});
