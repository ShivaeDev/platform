import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import type { ChangeResult } from "#policy.ts";

interface PullRequest {
	"created_at": string;
	head: { sha: string };
	merged: boolean;
	number: number;
	state: "open" | "closed";
}
export const MIGRATION_PATH = "packages/work-fleet/src/storage/fleetMigrations.ts";
export const predictionRepository = Effect.acquireRelease(
	Effect.sync(() => {
		const root = mkdtempSync(join(tmpdir(), "fleet-prediction-"));
		const remote = join(root, "remote.git");
		const cwd = join(root, "work");
		mkdirSync(cwd);
		function git(...args: string[]) {
			return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
		}
		git("init", "--bare", remote);
		git("init", "--initial-branch=main");
		git("config", "user.name", "Fleet Story");
		git("config", "user.email", "fleet@example.invalid");
		git("remote", "add", "origin", remote);
		function write(files: Readonly<Record<string, string>>) {
			for (const [path, content] of Object.entries(files)) {
				mkdirSync(dirname(join(cwd, path)), { recursive: true });
				writeFileSync(join(cwd, path), content);
			}
			git("add", ".");
		}
		write({ [MIGRATION_PATH]: 'export const migrations = {\n  "16_previous": previous,\n};\n' });
		git("commit", "-m", "Initial migrations");
		git("push", "origin", "main");
		const results = new Map<string, typeof ChangeResult.Type>();
		const prs = new Map<string, PullRequest>();
		function result(id: string) {
			const value = results.get(id);
			if (value === undefined) {
				throw new Error(`No pushed PR for ${id}`);
			}
			return value;
		}
		function record(id: string, paths: readonly string[]) {
			const prior = results.get(id);
			const number = prior?.prNumber ?? prs.size + 1;
			const pr = prior?.pr ?? `https://github.com/example/project/pull/${number}`;
			const head = git("rev-parse", "HEAD");
			results.set(id, { head, kind: "change", paths, pr, prNumber: number });
			const before = prs.get(pr);
			prs.set(pr, {
				"created_at": before?.created_at ?? new Date(number * 1000).toISOString(),
				head: { sha: head },
				merged: false,
				number,
				state: "open",
			});
		}
		return {
			cwd,
			delivery: (value: typeof ChangeResult.Type) => {
				const pr = prs.get(value.pr);
				if (pr === undefined) {
					throw new Error(`Unknown delivery ${value.pr}`);
				}
				return pr.merged ? { head: value.head, revision: git("rev-parse", "origin/main"), url: value.pr } : undefined;
			},
			git,
			github: {
				get: (endpoint: string) =>
					Effect.sync(() => {
						const pr = prs.get(`https://github.com/example/project/pull/${endpoint.split("/").at(-1)}`);
						if (pr === undefined) {
							throw new Error(`Unknown PR ${endpoint}`);
						}
						return JSON.stringify(pr);
					}),
				pages: () => Effect.die("Prediction reads individual watched PRs"),
			},
			merge: (id: string) => {
				git("switch", "main");
				git("merge", "--no-edit", "--no-ff", result(id).head);
				git("push", "origin", "main");
				const pr = prs.get(result(id).pr);
				if (pr === undefined) {
					throw new Error(`Unknown PR ${id}`);
				}
				pr.state = "closed";
				pr.merged = true;
			},
			mergeMain: (id: string, resolution: Readonly<Record<string, string>>) => {
				git("switch", `worker-${id}`);
				git("fetch", "origin", "main");
				const merged = spawnSync("git", ["merge", "--no-edit", "origin/main"], { cwd, encoding: "utf8" });
				if (merged.status !== 0 && merged.status !== 1) {
					throw new Error(merged.stderr);
				}
				write(resolution);
				git("commit", "-m", "Resolve migration after main merge");
				git("push", "origin", `worker-${id}`);
				record(id, Object.keys(resolution));
			},
			publication: (id: string) => ({ branch: `worker-${id}`, pullRequest: results.get(id)?.pr, remoteBranch: results.has(id) }),
			push: (id: string, files: Readonly<Record<string, string>>) => {
				git("switch", "-c", `worker-${id}`, "origin/main");
				write(files);
				git("commit", "-m", `Work on ${id}`);
				git("push", "origin", `worker-${id}`);
				record(id, Object.keys(files));
			},
			read: (path: string) => readFileSync(join(cwd, path), "utf8"),
			result,
			root,
		};
	}),
	(repository) => Effect.sync(() => rmSync(repository.root, { force: true, recursive: true })),
);
export type PredictionRepository = Effect.Success<typeof predictionRepository>;
