import { execFileSync } from "node:child_process";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

interface ReportHistory {
	readonly base: string;
	readonly descendant: string;
	readonly divergent: string;
	readonly older: string;
}
const histories = new WeakMap<HostStoryEngine, ReportHistory>();

export function configureReportHistory(engine: HostStoryEngine) {
	const root = engine.repositoryRoot;
	if (root === undefined) {
		throw new Error("Research history needs a local Board repository");
	}
	function git(...args: string[]) {
		return execFileSync("git", ["-c", "user.name=Story", "-c", "user.email=story@example.invalid", ...args], { cwd: root })
			.toString()
			.trim();
	}
	function commit(message: string) {
		git("commit", "--quiet", "--allow-empty", "-m", message);
		return git("rev-parse", "HEAD");
	}
	git("checkout", "--quiet", "-b", "main");
	const older = commit("Older checkout");
	const base = commit("Current main");
	const descendant = commit("Later main");
	git("checkout", "--quiet", "--detach", older);
	const divergent = commit("Divergent checkout");
	git("checkout", "--quiet", "main");
	git("remote", "add", "origin", root);
	histories.set(engine, { base, descendant, divergent, older });
	engine.main = { observedAt: 2, revision: base };
}

export function reportHistoryVerbs(engine: HostStoryEngine) {
	return {
		researchRevisions: () => {
			const history = histories.get(engine);
			if (history === undefined) {
				throw new Error("Configure research history first");
			}
			return history;
		},
	};
}
