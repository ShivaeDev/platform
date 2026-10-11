import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { it } from "@shivaedev/effect-test/it.ts";
import { reportDiffFiles } from "#host/reportDiff.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import { hostSymlinkAfterApply } from "#test/reportAttachmentSafety.ts";
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
	"diff --git a/link b/link\nnew file mode 100644\nnew file mode 120000\n--- /dev/null\n+++ b/link\n@@ -0,0 +1 @@\n+/synthetic-host-file\n",
	"diff --git a/../escape b/../escape\nnew file mode 100644\n--- /dev/null\n+++ b/../escape\n@@ -0,0 +1 @@\n+escaped\n",
	"diff --git a/.git/config b/.git/config\nnew file mode 100644\n--- /dev/null\n+++ b/.git/config\n@@ -0,0 +1 @@\n+config\n",
]) {
	it.live(`rejects unsafe or non-attachment diff: ${diff.split("\n")[0]}`, () =>
		Effect.gen(function* () {
			expect(yield* reportDiffFiles(diff).pipe(Effect.flip)).toMatchObject({ reason: "invalid" });
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

for (const mode of [
	"new file mode 100644",
	"old mode 100755",
	"new mode 120000",
	"deleted file mode 100644",
	"new file mode 160000",
	"index 0000000..1234567 120000",
]) {
	it.live(`rejects an extra mode line: ${mode}`, () =>
		Effect.gen(function* () {
			const diff = attachmentDiff({ "file.txt": new TextEncoder().encode("safe\n") }).replace(
				"new file mode 100644",
				`new file mode 100644\n${mode}`,
			);
			expect(yield* reportDiffFiles(diff).pipe(Effect.flip)).toMatchObject({
				message: "Report attachments must be newly created regular files",
				reason: "invalid",
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

it.live("caps UTF-8 diff bytes before parsing or applying the diff", () =>
	Effect.gen(function* () {
		expect(yield* reportDiffFiles("é".repeat(REPORT_LIMITS.diffBytes / 2 + 1)).pipe(Effect.flip)).toMatchObject({
			message: expect.stringContaining("Downloaded report diff size limit"),
		});
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.live("rejects a host-targeting symlink introduced after git apply", () =>
	Effect.gen(function* () {
		const spawner = yield* hostSymlinkAfterApply();
		const diff = attachmentDiff({ "file.txt": new TextEncoder().encode("safe\n") });
		expect(yield* reportDiffFiles(diff).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner), Effect.flip)).toMatchObject({
			message: "Cloud report attachments must be regular files inside the scratch folder",
		});
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.live("accepts executable regular attachments", () =>
	Effect.gen(function* () {
		const bytes = new TextEncoder().encode("executable\n");
		const diff = attachmentDiff({ "script": bytes }).replace("new file mode 100644", "new file mode 100755");
		const files = yield* reportDiffFiles(diff);
		expect(files.map((file) => ({ bytes: Uint8Array.from(file.bytes), path: file.path }))).toEqual([{ bytes, path: "script" }]);
	}).pipe(Effect.provide(NodeServices.layer)),
);
