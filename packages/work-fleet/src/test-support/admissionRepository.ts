import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Effect } from "effect";
import { admissionFetchGate } from "#test/admissionFetchGate.ts";

const execute = promisify(execFile);

export const admissionRepository = Effect.fn("FleetFixture.admissionRepository")(function* (cwd: string) {
	const root = yield* Effect.acquireRelease(
		Effect.sync(() => mkdtempSync(join(tmpdir(), "fleet-admission-"))),
		(directory) => Effect.sync(() => rmSync(directory, { force: true, recursive: true })),
	);
	const socket = join(root, "fetch.sock");
	const gate = yield* admissionFetchGate(socket);
	return yield* Effect.sync(() => {
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
		const uploadPack = fileURLToPath(new URL("./admissionUploadPack.ts", import.meta.url));
		git("config", "remote.origin.uploadpack", `node '${uploadPack}' '${socket}'`);
		return {
			breakRemote: () => git("remote", "set-url", "origin", join(root, "unreachable.git")),
			enable: () => {
				git("update-ref", "refs/remotes/origin/main", initial);
				gate.enable();
			},
			entered: gate.entered,
			externalFetch: () => Effect.promise(() => execute("git", ["fetch", "--upload-pack=git-upload-pack", "origin", "main"], { cwd })),
			overlapped: gate.overlapped,
			release: gate.release,
			revision,
		};
	});
});
