import assert from "node:assert/strict";
import { test as it } from "node:test";
import { failedFiles } from "./freshReports.ts";

it("selects only failed files, including collection failures, and deduplicates shared project paths", () => {
	assert.deepEqual(
		failedFiles({
			testResults: [
				{ name: "/passing.spec.ts", status: "passed" },
				{ name: "/failed.spec.ts", status: "failed" },
				{ name: "/collection.spec.ts", status: "failed" },
				{ name: "/failed.spec.ts", status: "failed" },
			],
		}),
		["/failed.spec.ts", "/collection.spec.ts"],
	);
	assert.deepEqual(failedFiles({ testResults: [] }), []);
	assert.throws(() => failedFiles({ testResults: [{ name: "file", status: "unknown" }] }));
	assert.throws(() => failedFiles({}));
});
