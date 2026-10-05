import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as it } from "node:test";

const action = readFileSync(".github/actions/await-packages/action.yml", "utf8");

function stepScript(name: string) {
	const step = action.split(`    - name: ${name}\n`)[1]?.split("    - name: ")[0];
	return step?.split("      run: |\n")[1]?.replace(/^ {8}/gmu, "") ?? "";
}

it("waits for this attempt's artifact and fails immediately when its producer or API fails", () => {
	const root = mkdtempSync(join(tmpdir(), "platform-await-packages-"));
	const script = stepScript("Await this attempt's package artifact");
	assert.ok(script);
	const calls = join(root, "calls");
	const pending = join(root, "pending");
	const output = join(root, "output");
	writeFileSync(join(root, "sleep"), `#!/bin/bash\necho slept >> '${calls}'`, { mode: 0o755 });
	function awaitArtifact(artifact: string, conclusion: string, denied = false, delayed = false, reuse = false) {
		writeFileSync(calls, "");
		writeFileSync(output, "");
		rmSync(pending, { force: true });
		writeFileSync(
			join(root, "gh"),
			[
				"#!/bin/bash",
				`echo "$2" >> '${calls}'`,
				denied ? "exit 1" : "",
				`if [[ "$2" == *artifacts* && "$2" != *name=* ]]; then echo '${reuse ? "packages-current-sha-1" : ""}'; exit 0; fi`,
				`if [[ "$2" == *artifacts* ]]; then`,
				delayed ? `if [[ ! -e '${pending}' ]]; then touch '${pending}'; exit 0; fi` : "",
				`echo '${artifact}'; else echo '${conclusion}'; fi`,
			].join("\n"),
			{ mode: 0o755 },
		);
		const result = spawnSync("/bin/bash", ["-euo", "pipefail", "-c", script], {
			encoding: "utf8",
			env: {
				"ARTIFACT_NAME": "packages-current-sha-2",
				"ARTIFACT_PREFIX": "packages-current-sha-",
				"GITHUB_OUTPUT": output,
				"GITHUB_REPOSITORY": "owner/repo",
				"GITHUB_RUN_ATTEMPT": "2",
				"GITHUB_RUN_ID": "42",
				"PATH": `${root}:/usr/bin:/bin`,
			},
			timeout: 5000,
		});
		assert.equal(result.error, undefined);
		return result.status;
	}
	try {
		assert.equal(awaitArtifact("123", ""), 0);
		assert.match(readFileSync(calls, "utf8"), /runs\/42\/artifacts\?name=packages-current-sha-2/u);
		assert.equal(awaitArtifact("123", "completed:success", false, true), 0);
		assert.match(readFileSync(calls, "utf8"), /slept/u);
		for (const conclusion of ["failure", "cancelled", "timed_out"]) {
			assert.equal(awaitArtifact("", `completed:${conclusion}`), 1);
			assert.match(readFileSync(calls, "utf8"), /runs\/42\/attempts\/2\/jobs/u);
		}
		assert.equal(awaitArtifact("", "", true), 1);
		assert.equal(awaitArtifact("", "", false, false, true), 0);
		assert.equal(readFileSync(output, "utf8"), "name=packages-current-sha-1\n");
		assert.equal(awaitArtifact("", "completed:success", false, false, true), 0);
		assert.equal(readFileSync(output, "utf8"), "name=packages-current-sha-1\n");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

it("retries a download the artifact service is not ready for and starts each attempt from an empty folder", () => {
	const root = mkdtempSync(join(tmpdir(), "platform-download-packages-"));
	const script = stepScript("Download package archives");
	assert.ok(script);
	const calls = join(root, "calls");
	writeFileSync(join(root, "sleep"), `#!/bin/bash\necho "slept $1" >> '${calls}'`, { mode: 0o755 });
	function download(failures: number) {
		writeFileSync(calls, "");
		writeFileSync(
			join(root, "gh"),
			[
				"#!/bin/bash",
				`echo "$*" >> '${calls}'`,
				"[[ -e .ci/packages/partial.tgz ]] && exit 1",
				`if (( $(grep -c '^run download' '${calls}') <= ${failures} )); then mkdir -p .ci/packages; touch .ci/packages/partial.tgz; exit 1; fi`,
				"mkdir -p .ci/packages && touch .ci/packages/archive.tgz",
			].join("\n"),
			{ mode: 0o755 },
		);
		const result = spawnSync("/bin/bash", ["-eo", "pipefail", "-c", script], {
			cwd: root,
			encoding: "utf8",
			env: {
				"ARTIFACT_NAME": "packages-current-sha-1",
				"GITHUB_REPOSITORY": "owner/repo",
				"GITHUB_RUN_ID": "42",
				"PATH": `${root}:/usr/bin:/bin`,
			},
			timeout: 5000,
		});
		assert.equal(result.error, undefined);
		return result.status;
	}
	try {
		assert.equal(download(0), 0);
		assert.equal(readFileSync(calls, "utf8"), "run download 42 --repo owner/repo --name packages-current-sha-1 --dir .ci/packages\n");
		assert.equal(download(2), 0);
		assert.match(readFileSync(calls, "utf8"), /slept 3\n.*\nslept 6\n/u);
		assert.ok(existsSync(join(root, ".ci/packages/archive.tgz")));
		assert.equal(download(5), 1);
		assert.equal(readFileSync(calls, "utf8").match(/^run download/gmu)?.length, 5);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
