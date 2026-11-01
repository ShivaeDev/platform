import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Config, Effect } from "effect";
import { vi } from "vitest";

function quote(value: string) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

export const gitScopeRepository = Effect.acquireRelease(
	Effect.sync(() => {
		const root = mkdtempSync(join(tmpdir(), "fleet-git-scope-"));
		const cwd = join(root, "work");
		const bin = join(root, "bin");
		mkdirSync(cwd);
		mkdirSync(bin);
		const executable = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
		function git(...args: string[]) {
			return execFileSync(executable, args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
		}
		git("init", "--initial-branch=main");
		git("config", "user.name", "Fleet Story");
		git("config", "user.email", "fleet@example.invalid");
		function commit(value: string) {
			writeFileSync(join(cwd, "file.txt"), value);
			git("add", ".");
			git("commit", "-m", value);
			return git("rev-parse", "HEAD");
		}
		const base = commit("base\n");
		git("switch", "-c", "left");
		const left = commit("left\n");
		git("switch", "-c", "right", base);
		const right = commit("right\n");
		git("remote", "add", "origin", cwd);
		git("fetch", "origin");
		const tree = git("rev-parse", `${base}^{tree}`);
		const fifo = join(root, "trace");
		const held = join(root, "held");
		const pidFile = join(root, "pid");
		execFileSync("mkfifo", [fifo]);
		writeFileSync(held, "\n");
		writeFileSync(
			join(bin, "git"),
			`#!/bin/sh
read -r held < ${quote(held)}
if [ "$1" = "$held" ]; then
  echo $$ > ${quote(pidFile)}
  export GIT_TRACE2_EVENT=${quote(fifo)}
fi
exec ${quote(executable)} "$@"
`,
			{ mode: 0o755 },
		);
		const originalPath = Effect.runSync(Config.String("PATH"));
		vi.stubEnv("PATH", `${bin}:${originalPath}`);
		function pid() {
			return Number(readFileSync(pidFile, "utf8").trim());
		}
		return {
			base,
			breakRemote: () => git("remote", "set-url", "origin", join(root, "missing.git")),
			cwd,
			hold: (command: string) => writeFileSync(held, `${command}\n`),
			left,
			pending: Effect.whileLoop({
				body: () => Effect.sleep("5 millis"),
				step: () => undefined,
				while: () => {
					if (!existsSync(pidFile)) {
						return true;
					}
					return !execFileSync("ps", ["-p", String(pid()), "-o", "args="], { encoding: "utf8" })
						.trim()
						.startsWith(`${executable} `);
				},
			}).pipe(Effect.timeout("5 seconds")),
			pid,
			right,
			root,
			tree,
		};
	}),
	(repository) =>
		Effect.sync(() => {
			vi.unstubAllEnvs();
			if (existsSync(join(repository.root, "pid"))) {
				try {
					process.kill(repository.pid(), "SIGKILL");
				} catch (error) {
					if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
						throw error;
					}
				}
			}
			rmSync(repository.root, { force: true, recursive: true });
		}),
);
