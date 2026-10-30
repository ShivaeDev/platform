import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path } from "effect";
import { CLI, exec } from "./cli.ts";
import { writeFile } from "./fixture.ts";

const TEMPLATE = fileURLToPath(new URL("../../templates/sync-skills.yml", import.meta.url));
const BRANCH = "change-selection";
const JOB = "sync-skills";

export type Yaml = string | readonly Yaml[] | { readonly [key: string]: Yaml };
interface YamlMap {
	readonly [key: string]: Yaml;
}

function indentOf(line: string) {
	return line.length - line.trimStart().length;
}

function isMap(value: Yaml | undefined): value is YamlMap {
	return typeof value === "object" && !Array.isArray(value);
}

// The package takes no YAML dependency, so the kit reads only what the template uses: nested maps, lists of maps and `|` blocks.
function parseYaml(source: string): Yaml {
	const lines = source.split("\n");
	let next = 0;
	function upcoming() {
		while (next < lines.length && /^\s*(?:#.*)?$/u.test(lines[next] ?? "")) {
			next += 1;
		}
		const line = lines[next];
		return line === undefined ? undefined : { indent: indentOf(line), text: line.trim() };
	}
	function literal(indent: number) {
		const kept: string[] = [];
		while (next < lines.length && ((lines[next] ?? "").trim() === "" || indentOf(lines[next] ?? "") > indent)) {
			kept.push(lines[next] ?? "");
			next += 1;
		}
		const margin = Math.min(...kept.filter((line) => line.trim() !== "").map(indentOf));
		return `${kept
			.map((line) => line.slice(margin))
			.join("\n")
			.trimEnd()}\n`;
	}
	function entry(text: string, indent: number, into: Record<string, Yaml>) {
		next += 1;
		const separator = text.indexOf(": ");
		const key = separator === -1 ? text.replace(/:$/u, "") : text.slice(0, separator);
		const value = separator === -1 ? "" : text.slice(separator + 2);
		if (value === "|") {
			into[key] = literal(indent);
		} else if (value === "") {
			const child = upcoming();
			into[key] = child !== undefined && child.indent > indent ? block(child.indent) : "";
		} else {
			into[key] = value;
		}
	}
	function map(indent: number, into: Record<string, Yaml> = {}) {
		for (let line = upcoming(); line?.indent === indent && !line.text.startsWith("- "); line = upcoming()) {
			entry(line.text, indent, into);
		}
		return into;
	}
	function block(indent: number): Yaml {
		if (!upcoming()?.text.startsWith("- ")) {
			return map(indent);
		}
		const items: Yaml[] = [];
		for (let line = upcoming(); line?.indent === indent && line.text.startsWith("- "); line = upcoming()) {
			const item: Record<string, Yaml> = {};
			entry(line.text.slice(2), indent + 2, item);
			items.push(map(indent + 2, item));
		}
		return items;
	}
	return block(0);
}

function field(value: Yaml | undefined, key: string): Yaml {
	const found = isMap(value) ? value[key] : undefined;
	if (found === undefined) {
		throw new Error(`The workflow template has no ${key}`);
	}
	return found;
}

function textOf(value: Yaml, key: string): string {
	if (typeof value !== "string") {
		throw new Error(`The workflow template's ${key} is not text`);
	}
	return value;
}

const template = Effect.fn("SkillsWorkflow.template")(function* () {
	return parseYaml(yield* (yield* FileSystem.FileSystem).readFileString(TEMPLATE));
});

const job = Effect.map(template(), (parsed) => field(field(parsed, "jobs"), JOB));

const steps = Effect.map(job, (found) => {
	const listed = field(found, "steps");
	if (!Array.isArray(listed)) {
		throw new Error("The workflow template's steps are not a list");
	}
	return listed.filter(isMap);
});

function step(name: string) {
	return Effect.map(steps, (listed) => {
		const found = listed.find((candidate) => candidate.name === name);
		if (found === undefined) {
			throw new Error(`The workflow template has no step named ${name}`);
		}
		return found;
	});
}

function git(cwd: string, ...args: readonly string[]): string {
	const result = exec("git", ["-c", "user.name=Contributor", "-c", "user.email=contributor@example.com", ...args], cwd);
	if (result.exit !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
	return result.stdout;
}

export function runStep(repo: string, name: string) {
	return Effect.map(step(name), (found) =>
		exec("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", textOf(field(found, "run"), "run")], repo),
	);
}

export const workflow = {
	jobCondition: () => Effect.map(job, (found) => textOf(field(found, "if"), "job condition")),
	permissions: () => Effect.map(template(), (parsed) => field(parsed, "permissions")),
	stepField: (name: string, key: string) => Effect.map(step(name), (found) => textOf(field(found, key), key)),
	stepNames: () => Effect.map(steps, (listed) => listed.map((found) => textOf(field(found, "name"), "step name"))),
	triggers: () =>
		Effect.map(template(), (parsed) => {
			const on = field(parsed, "on");
			return isMap(on) ? Object.keys(on) : [textOf(on, "trigger")];
		}),
};

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

export function pushedCommit(remote: string) {
	return {
		files: git(remote, "ls-tree", "-r", "--name-only", BRANCH).trim().split("\n"),
		subject: git(remote, "log", "-1", "--format=%s", BRANCH).trim(),
	};
}
