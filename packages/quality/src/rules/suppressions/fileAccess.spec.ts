import { expect } from "vitest";
import { pendingRead, ruleFileAccess, suppliedConfig, unreadableConfig } from "#test/ruleFileAccess.ts";

ruleFileAccess.it("checks the configuration supplied by the file system service", [suppliedConfig], function* ({ check }) {
	const findings = yield* check();
	expect(findings.map((finding) => [finding.file, finding.subject])).toEqual([["tsconfig.json", "ignoreDeprecations"]]);
});

ruleFileAccess.it("reports an unreadable configuration as a failure", [unreadableConfig], function* ({ checkFailure }) {
	const failure = yield* checkFailure();
	expect(failure).toMatchObject({ message: expect.stringContaining("PermissionDenied"), path: expect.stringContaining("tsconfig.json") });
});

ruleFileAccess.it("interrupts a pending file system operation with its rule", [pendingRead], function* ({ interrupt }) {
	expect(yield* interrupt()).toBe(true);
});
