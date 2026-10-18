import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { application } from "./application.ts";
import { templateSource } from "./templateSource.ts";

export const configuredIdentity = application.trait("workspace", "Git identifies App Author", (engine) => {
	engine.environment.push(
		"GIT_AUTHOR_NAME=App Author",
		"GIT_AUTHOR_EMAIL=author@example.com",
		"GIT_COMMITTER_NAME=App Author",
		"GIT_COMMITTER_EMAIL=author@example.com",
	);
});

export const realSetup = application.trait("installation", "setup installs the active Quality gate", (engine) => {
	engine.options = { ...engine.options, realSetup: true };
});

export const failingQualityGate = application.trait("installation", "the Quality typecheck gate fails", (engine) => {
	engine.options = { ...engine.options, realSetup: true, typecheckExit: 7 };
});

export const missingGit = application.trait("installation", "Git is unavailable", (engine) => {
	engine.options = { ...engine.options, gitAvailable: false };
});

export const enclosingRepository = application.trait("workspace", "a repository encloses the destination", (engine) => {
	const result = spawnSync("git", ["init", "--quiet"], { cwd: engine.root, encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(result.stderr);
	}
});

export function installationFails(exit = 7) {
	return application.trait("installation", `installation exits with ${exit}`, (engine) => {
		engine.options = { ...engine.options, installationExit: exit };
	});
}

export function destination(kind: "empty" | "file" | "nonempty" | "environment") {
	return application.trait("installation", `the destination is ${kind}`, (engine) => {
		engine.options = { ...engine.options, destination: kind };
	});
}

export function customTemplate(files: Readonly<Record<string, string>> = {}, localArtifacts = false) {
	return application.trait("template", "the template has custom source files", (engine) => {
		engine.source = templateSource(dirname(dirname(engine.cli)), { localArtifacts });
		engine.source.files(files);
	});
}
