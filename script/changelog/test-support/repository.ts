import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function repository() {
	const root = mkdtempSync(join(tmpdir(), "platform-changelog-"));
	const directory = join(root, "packages", "sample");
	function git(...args: string[]) {
		return execFileSync("git", args, { cwd: root, encoding: "utf8" });
	}
	mkdirSync(join(directory, "changes"), { recursive: true });
	git("init", "--initial-branch=main");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "Changelog test");
	function write(path: string, text: string) {
		mkdirSync(dirname(join(directory, path)), { recursive: true });
		writeFileSync(join(directory, path), text);
	}
	function read(path: string) {
		return readFileSync(join(directory, path), "utf8");
	}
	function version(value: string) {
		write("package.json", JSON.stringify({ name: "sample", version: value }));
	}
	version("1.0.0");
	write("CHANGELOG.md", "# Changelog\n\n## 1.0.0 - 2026-01-01\n\n### Added\n\n- First release.\n");
	function commit() {
		git("add", ".");
		git("commit", "-m", "Record package notes");
		return git("rev-parse", "HEAD").trim();
	}
	return { commit, directory, git, read, remove: () => rmSync(root, { force: true, recursive: true }), root, version, write };
}
