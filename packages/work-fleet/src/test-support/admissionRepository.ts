import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";

const execute = promisify(execFile);

export function admissionRepository(cwd: string) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const root = mkdtempSync(join(tmpdir(), "fleet-admission-"));
			const remote = join(root, "remote.git");
			function git(...args: string[]) {
				return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
			}
			git("init", "--bare", remote);
			git("init", "--initial-branch=main");
			git("config", "user.name", "Fleet Story");
			git("config", "user.email", "fleet@example.invalid");
			git("config", "protocol.version", "0");
			git("remote", "add", "origin", remote);
			git("commit", "--allow-empty", "-m", "Initial main");
			git("push", "origin", "main");
			const initial = git("rev-parse", "HEAD");
			const revision = git(
				"-c",
				"user.name=Fleet Story",
				"-c",
				"user.email=fleet@example.invalid",
				"--git-dir",
				remote,
				"commit-tree",
				`${initial}^{tree}`,
				"-p",
				initial,
				"-m",
				"Advance main",
			);
			git("--git-dir", remote, "update-ref", "refs/heads/main", revision);
			git("update-ref", "refs/remotes/origin/main", initial);
			const uploadPack = join(root, "upload-pack.mjs");
			writeFileSync(
				uploadPack,
				`import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const root = ${JSON.stringify(root)};
let claimed = false;
const child = spawn("git-upload-pack", process.argv.slice(2), { stdio: ["pipe", "pipe", "inherit"] });
child.stdout.pipe(process.stdout);
child.on("exit", code => {
  if (claimed) rmSync(root + "/active", { recursive: true });
  process.exit(code ?? 1);
});
process.stdin.once("data", async data => {
  process.stdin.pause();
  if (existsSync(root + "/enabled")) {
    try { mkdirSync(root + "/active"); claimed = true; }
    catch { writeFileSync(root + "/overlap", "overlapping fetches"); }
    if (!existsSync(root + "/entered")) {
      writeFileSync(root + "/entered", "fetch waiting");
      const deadline = Date.now() + 10000;
      while (!existsSync(root + "/release")) {
        if (Date.now() > deadline) process.exit(1);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
  }
  child.stdin.write(data);
  process.stdin.pipe(child.stdin);
  process.stdin.resume();
});
`,
			);
			git("config", "remote.origin.uploadpack", `node '${uploadPack}'`);
			return {
				breakRemote: () => git("remote", "set-url", "origin", join(root, "unreachable.git")),
				enable: () => {
					git("update-ref", "refs/remotes/origin/main", initial);
					writeFileSync(join(root, "enabled"), "hold next fetch");
				},
				entered: Effect.whileLoop({
					body: () => Effect.sleep("5 millis"),
					step: () => undefined,
					while: () => !existsSync(join(root, "entered")),
				}).pipe(Effect.timeout("5 seconds")),
				externalFetch: () => Effect.promise(() => execute("git", ["fetch", "--upload-pack=git-upload-pack", "origin", "main"], { cwd })),
				overlapped: () => existsSync(join(root, "overlap")),
				release: () => writeFileSync(join(root, "release"), "resume fetch"),
				revision,
				root,
			};
		}),
		(repository) => Effect.sync(() => rmSync(repository.root, { force: true, recursive: true })),
	);
}
