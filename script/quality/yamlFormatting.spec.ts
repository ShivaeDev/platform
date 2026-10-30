import { expect } from "vitest";
import { qualityKit } from "#quality/test-support/kit.ts";
import { misformattedYaml, PNPM_LOCKFILE, pnpmLockfile } from "#quality/test-support/yamlFiles.ts";

qualityKit.it("accepts a lockfile in pnpm's format", [pnpmLockfile], function* (repo) {
	const result = yield* repo.lint();

	expect(result).toMatchObject({ status: 0, stderr: "", stdout: expect.stringContaining("quality: passed.") });
});

qualityKit.it("rejects misformatted hand-written YAML beside pnpm's lockfile", [pnpmLockfile, misformattedYaml], function* (repo) {
	const result = yield* repo.lint();
	const exitCode = result.status;

	expect(exitCode).toBe(1);
	expect(result.stdout).toContain("error biome/format (1)\n  pnpm-workspace.yaml  Is not formatted.");
});

qualityKit.it("formats hand-written YAML while preserving pnpm's lockfile", [pnpmLockfile, misformattedYaml], function* (repo) {
	expect(repo.read("pnpm-workspace.yaml")).toBe("catalog:\n    vite: 8.3.5\n");

	const result = yield* repo.fix();

	expect(result.status).toBe(0);
	expect(repo.read("pnpm-workspace.yaml")).toBe("catalog:\n  vite: 8.3.5\n");
	expect(repo.read("pnpm-lock.yaml")).toBe(PNPM_LOCKFILE);
});
