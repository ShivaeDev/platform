import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { reportDiffFiles } from "#host/reportDiff.ts";
import { attachmentDiff, REPORT_FILES } from "#test/reportAttachments.ts";

it.live("reconstructs new text and Git binary files without a checkout", () =>
	Effect.gen(function* () {
		const files = yield* reportDiffFiles(attachmentDiff());
		expect(Object.fromEntries(files.map((file) => [file.path, Uint8Array.from(file.bytes)]))).toEqual(REPORT_FILES);
	}).pipe(Effect.provide(NodeServices.layer)),
);

for (const diff of [
	"diff --git a/notes b/notes\n--- a/notes\n+++ b/notes\n@@ -1 +1 @@\n-old\n+new\n",
	"diff --git a/link b/link\nnew file mode 120000\n--- /dev/null\n+++ b/link\n@@ -0,0 +1 @@\n+/etc/passwd\n",
	"diff --git a/../escape b/../escape\nnew file mode 100644\n--- /dev/null\n+++ b/../escape\n@@ -0,0 +1 @@\n+escaped\n",
	"diff --git a/.git/config b/.git/config\nnew file mode 100644\n--- /dev/null\n+++ b/.git/config\n@@ -0,0 +1 @@\n+config\n",
]) {
	it.live(`rejects unsafe or non-attachment diff: ${diff.split("\n")[0]}`, () =>
		Effect.gen(function* () {
			expect(yield* reportDiffFiles(diff).pipe(Effect.flip)).toMatchObject({ reason: "integration" });
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
