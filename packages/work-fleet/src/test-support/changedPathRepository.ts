import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";

export function changedPathRepository(files: readonly string[]) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const root = mkdtempSync(join(tmpdir(), "fleet-changed-paths-"));
			const remote = join(root, "remote");
			const checkout = join(root, "checkout");
			const boardDir = join(checkout, "board");
			mkdirSync(remote);
			mkdirSync(boardDir, { recursive: true });
			function git(cwd: string, ...args: string[]) {
				return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
			}
			function write(path: string, content: string) {
				mkdirSync(dirname(join(remote, path)), { recursive: true });
				writeFileSync(join(remote, path), content);
			}
			function commit(message: string) {
				git(remote, "add", ".");
				git(remote, "commit", "--quiet", "-m", message);
				return git(remote, "rev-parse", "HEAD");
			}
			git(remote, "init", "--initial-branch=main");
			git(remote, "config", "user.name", "Fleet Story");
			git(remote, "config", "user.email", "fleet@example.invalid");
			write("src/old.ts", "renamed content\n");
			write("src/deleted.ts", "deleted content\n");
			commit("Initial files");
			git(remote, "switch", "-c", "worker");
			renameSync(join(remote, "src/old.ts"), join(remote, "src/renamed\tfile.ts"));
			rmSync(join(remote, "src/deleted.ts"));
			for (const path of files) {
				write(path, `content for ${path}\n`);
			}
			const head = commit("Worker changes");
			git(remote, "switch", "main");
			write("main-only.ts", "main advances independently\n");
			const base = commit("Main advances");
			git(checkout, "init", "--initial-branch=main");
			git(checkout, "remote", "add", "origin", remote);
			return {
				base,
				boardDir,
				breakRemote: () => git(checkout, "remote", "set-url", "origin", join(root, "missing")),
				head,
				root,
			};
		}),
		(repository) => Effect.sync(() => rmSync(repository.root, { force: true, recursive: true })),
	);
}
