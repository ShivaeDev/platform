import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path } from "effect";
import { writeFile } from "./fixture.ts";

const TEMPLATE = fileURLToPath(new URL("../../templates/sync-skills.yml", import.meta.url));
const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));
export const BRANCH = "change-selection";

export interface WorkflowStep {
	readonly fields: Readonly<Record<string, string>>;
	readonly run: string | undefined;
}
export interface ProcessRun {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

export const workflowTemplate = Effect.fn("SkillsWorkflow.workflowTemplate")(function* () {
	return yield* (yield* FileSystem.FileSystem).readFileString(TEMPLATE);
});

function indentOf(line: string) {
	return line.length - line.trimStart().length;
}

function fieldLines(lines: readonly string[], name: string) {
	const start = lines.findIndex((line) => line.trim() === `- name: ${name}`);
	if (start === -1) {
		throw new Error(`The workflow template has no step named ${name}`);
	}
	const indent = indentOf(lines[start] ?? "") + 2;
	const end = lines.findIndex((line, index) => index > start && line.trim() !== "" && indentOf(line) < indent);
	return { indent, lines: lines.slice(start + 1, end === -1 ? lines.length : end) };
}

function blockAt(lines: readonly string[], index: number, indent: number) {
	const block: string[] = [];
	for (const line of lines.slice(index + 1)) {
		if (line.trim() !== "" && indentOf(line) <= indent) {
			break;
		}
		block.push(line.slice(indent + 2));
	}
	return `${block.join("\n").trimEnd()}\n`;
}

export function workflowStep(template: string, name: string): WorkflowStep {
	const step = fieldLines(template.split("\n"), name);
	const fields: Record<string, string> = {};
	let run: string | undefined;
	step.lines.forEach((line, index) => {
		if (line.trim() === "" || indentOf(line) !== step.indent) {
			return;
		}
		const [key = "", ...rest] = line.trim().split(": ");
		const value = rest.join(": ");
		if (key === "run") {
			run = value === "|" ? blockAt(step.lines, index, step.indent) : value;
		} else {
			fields[key] = value;
		}
	});
	return { fields, run };
}

function exec(command: string, args: readonly string[], cwd: string): ProcessRun {
	const { status, stderr, stdout } = spawnSync(command, args, { cwd, encoding: "utf8" });
	return { status, stderr, stdout };
}

function git(cwd: string, ...args: readonly string[]): string {
	const result = exec("git", ["-c", "user.name=Contributor", "-c", "user.email=contributor@example.com", ...args], cwd);
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
	return result.stdout;
}

export const checkOutPullRequest = Effect.fn("SkillsWorkflow.checkOutPullRequest")(function* (repo: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const remote = yield* fs.makeTempDirectoryScoped({ prefix: "skills-remote-" });
	yield* writeFile("node_modules/.bin/shivaedev-skills", `#!/bin/sh\nexec "${process.execPath}" --conditions=source "${CLI}" "$@"\n`)(repo);
	yield* fs.chmod(path.join(repo, "node_modules/.bin/shivaedev-skills"), 0o755);
	yield* writeFile(".gitignore", "node_modules\n")(repo);
	git(remote, "init", "--bare", "--quiet");
	git(repo, "init", "--quiet", `--initial-branch=${BRANCH}`);
	git(repo, "remote", "add", "origin", remote);
	git(repo, "add", "--all");
	git(repo, "commit", "--quiet", "--message", "Select the shared skills");
	git(repo, "push", "--quiet", "--set-upstream", "origin", BRANCH);
	return remote;
});

export function runStep(repo: string, step: WorkflowStep): ProcessRun {
	if (step.run === undefined) {
		throw new Error("The workflow step has no run script");
	}
	return exec("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", step.run], repo);
}

export function pushedCommit(remote: string) {
	return {
		files: git(remote, "ls-tree", "-r", "--name-only", BRANCH).trim().split("\n"),
		subject: git(remote, "log", "-1", "--format=%s", BRANCH).trim(),
	};
}

export function workingTreeChanges(repo: string): string {
	return git(repo, "status", "--porcelain");
}
