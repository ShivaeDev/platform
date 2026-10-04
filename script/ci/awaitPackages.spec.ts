import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as it } from "node:test";

it("waits for this attempt's artifact and fails immediately when its producer or API fails", () => {
	const root = mkdtempSync(join(tmpdir(), "platform-await-packages-"));
	const action = readFileSync(".github/actions/await-packages/action.yml", "utf8");
	const script = action.split("      run: |\n")[1]?.split("    - uses:")[0]?.replace(/^ {8}/gmu, "") ?? "";
	assert.ok(script);
	const calls = join(root, "calls");
	const pending = join(root, "pending");
	writeFileSync(join(root, "sleep"), `#!/bin/bash\necho slept >> '${calls}'`, { mode: 0o755 });
	function awaitArtifact(artifact: string, conclusion: string, denied = false, delayed = false) {
		writeFileSync(calls, "");
		rmSync(pending, { force: true });
		writeFileSync(
			join(root, "gh"),
			[
				"#!/bin/bash",
				`echo "$2" >> '${calls}'`,
				denied ? "exit 1" : "",
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
		assert.equal(awaitArtifact("123", "success", false, true), 0);
		assert.match(readFileSync(calls, "utf8"), /slept/u);
		for (const conclusion of ["failure", "cancelled", "timed_out"]) {
			assert.equal(awaitArtifact("", conclusion), 1);
			assert.match(readFileSync(calls, "utf8"), /runs\/42\/attempts\/2\/jobs/u);
		}
		assert.equal(awaitArtifact("", "", true), 1);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
