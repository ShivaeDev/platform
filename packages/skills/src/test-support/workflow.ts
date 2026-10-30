import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path, Schema } from "effect";
import { parse } from "yaml";
import { CLI, exec } from "./cli.ts";
import { writeFile } from "./fixture.ts";

const TEMPLATE = fileURLToPath(new URL("../../templates/sync-skills.yml", import.meta.url));
const BRANCH = "change-selection";
const JOB = "sync-skills";

const WorkflowStep = Schema.Struct({
	"continue-on-error": Schema.optional(Schema.Boolean),
	id: Schema.optional(Schema.String),
	if: Schema.optional(Schema.String),
	name: Schema.String,
	run: Schema.optional(Schema.String),
});

const Workflow = Schema.Struct({
	jobs: Schema.Record(Schema.String, Schema.Struct({ if: Schema.optional(Schema.String), steps: Schema.Array(WorkflowStep) })),
	on: Schema.Record(Schema.String, Schema.Unknown),
	permissions: Schema.Record(Schema.String, Schema.String),
});

const template = Effect.fn("SkillsWorkflow.template")(function* () {
	const text = yield* (yield* FileSystem.FileSystem).readFileString(TEMPLATE);
	return yield* Schema.decodeUnknownEffect(Workflow)(parse(text));
});

const job = Effect.flatMap(template(), ({ jobs }) => {
	const found = jobs[JOB];
	return found === undefined ? Effect.die(new Error(`The workflow template has no job named ${JOB}`)) : Effect.succeed(found);
});

function step(name: string) {
	return Effect.flatMap(job, ({ steps }) => {
		const found = steps.find((candidate) => candidate.name === name);
		return found === undefined ? Effect.die(new Error(`The workflow template has no step named ${name}`)) : Effect.succeed(found);
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
	return Effect.flatMap(step(name), ({ run }) =>
		run === undefined
			? Effect.die(new Error(`The workflow step ${name} has no run script`))
			: Effect.succeed(exec("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", run], repo)),
	);
}

export const workflow = {
	jobCondition: () => Effect.map(job, (found) => found.if),
	permissions: () => Effect.map(template(), ({ permissions }) => permissions),
	stepField: (name: string, key: Exclude<keyof typeof WorkflowStep.Type, "name">) => Effect.map(step(name), (found) => found[key]),
	stepNames: () => Effect.map(job, ({ steps }) => steps.map((found) => found.name)),
	triggers: () => Effect.map(template(), ({ on }) => Object.keys(on)),
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
