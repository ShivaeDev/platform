import { spawnSync } from "node:child_process";

// A git hook that runs the tests exports these for its own repository and commit, and git itself clears the first group
// (`git rev-parse --local-env-vars`) before it enters another repository.
const INHERITED = [
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_CONFIG",
	"GIT_CONFIG_PARAMETERS",
	"GIT_OBJECT_DIRECTORY",
	"GIT_DIR",
	"GIT_WORK_TREE",
	"GIT_IMPLICIT_WORK_TREE",
	"GIT_GRAFT_FILE",
	"GIT_INDEX_FILE",
	"GIT_NO_REPLACE_OBJECTS",
	"GIT_REPLACE_REF_BASE",
	"GIT_PREFIX",
	"GIT_SHALLOW_FILE",
	"GIT_COMMON_DIR",
	"GIT_AUTHOR_NAME",
	"GIT_AUTHOR_EMAIL",
	"GIT_AUTHOR_DATE",
	"GIT_COMMITTER_NAME",
	"GIT_COMMITTER_EMAIL",
	"GIT_COMMITTER_DATE",
];

export interface GitRun {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

// Detached auto maintenance outlives the git call and races the story's removal of its temporary repository.
export function isolatedGitEnvironment(handed: Readonly<Record<string, string>> = {}): Readonly<Record<string, string | undefined>> {
	return {
		...Object.fromEntries(INHERITED.map((name) => [name, undefined])),
		"GIT_CONFIG_COUNT": "2",
		"GIT_CONFIG_GLOBAL": "/dev/null",
		"GIT_CONFIG_KEY_0": "gc.auto",
		"GIT_CONFIG_KEY_1": "maintenance.auto",
		"GIT_CONFIG_NOSYSTEM": "1",
		"GIT_CONFIG_VALUE_0": "0",
		"GIT_CONFIG_VALUE_1": "false",
		...handed,
	};
}

export function isolatedGitCommand(
	command: readonly [string, ...string[]],
	handed: Readonly<Record<string, string>> = {},
): readonly [string, ...string[]] {
	const variables = Object.entries(isolatedGitEnvironment(handed)).flatMap(([name, value]) =>
		value === undefined ? ["-u", name] : [`${name}=${value}`],
	);
	return ["env", ...variables, ...command];
}

export function isolatedGit(cwd: string, args: readonly string[], handed: Readonly<Record<string, string>> = {}): GitRun {
	const [command, ...rest] = isolatedGitCommand(["git", ...args], handed);
	const { status, stderr, stdout } = spawnSync(command, rest, { cwd, encoding: "utf8" });
	return { status, stderr, stdout };
}
