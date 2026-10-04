import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as it } from "node:test";

it("cached installs preserve every workspace install hook, including hooks added by new packages", () => {
	const action = readFileSync(".github/actions/setup/action.yml", "utf8");
	const script = action.split("        node --input-type=module <<'JS'\n")[1]?.split("        JS")[0]?.replace(/^ {8}/gmu, "") ?? "";
	assert.ok(script);
	const root = mkdtempSync(join(tmpdir(), "platform-install-hooks-"));
	const output = join(root, "output");
	const workspace = join(root, "packages", "future-package");
	mkdirSync(workspace, { recursive: true });
	function hooks(rootScripts: Record<string, string>, packageScripts: Record<string, string>) {
		writeFileSync(output, "");
		writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: rootScripts }));
		writeFileSync(join(workspace, "package.json"), JSON.stringify({ scripts: packageScripts }));
		const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
			cwd: root,
			encoding: "utf8",
			env: { "GITHUB_OUTPUT": output },
		});
		assert.equal(result.status, 0, result.stderr);
		return readFileSync(output, "utf8");
	}
	try {
		assert.equal(hooks({ build: "tsc" }, { "test:prepare": "prisma generate" }), "install-hooks=false\n");
		for (const hook of ["preinstall", "install", "postinstall", "prepare", "prepublish", "preprepare", "postprepare", "pnpm:devPreinstall"]) {
			assert.equal(hooks({ [hook]: "node setup.ts" }, {}), "install-hooks=true\n");
			assert.equal(hooks({}, { [hook]: "node setup.ts" }), "install-hooks=true\n");
		}
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
