import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { updates } from "#test/updates.ts";
import { appCommits, createdWith010, published010, starterAt020, trustDowngrade } from "#test/updateTraits.ts";

updates.it(
	"update refuses success for committed markers outside the starter diff and lists every affected file",
	[
		createdWith010(),
		published010,
		appCommits("adds unresolved application files", {
			"another file.txt": "<<<<<<< app\nours\n=======\ntheirs\n>>>>>>> starter\n",
			"app-only.txt": "<<<<<<< app\nours\n=======\ntheirs\n>>>>>>> starter\n",
			"partly-resolved.txt": "ours\n=======\ntheirs\n",
		}),
		starterAt020("is unchanged"),
	],
	function* ({ answer, exitCode, generationRecord, update }) {
		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.2.0" }],
			answer: [
				answer(),
				"create-app: Recorded create-app 0.2.0. Finish the update before committing:\nFiles with conflict markers:\nanother file.txt\napp-only.txt\npartly-resolved.txt",
			],
			"exit code": [exitCode(), 1],
		});
	},
);

updates.it(
	"update reports the compiler error when a clean merge combines the starter's renamed address with the app's old reference, and records the version",
	[
		createdWith010(),
		published010,
		appCommits("uses the starter address in its own URL", {
			"update-check.ts": (source) => `${source}\nexport const appUrl = address;\n`,
		}),
		starterAt020("renames its address", { "update-check.ts": (source) => source.replace("address", "serverAddress") }),
	],
	function* ({ answer, conflictedFiles, exitCode, generationRecord, update }) {
		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.2.0" }],
			"compiler error": [answer(), expect.stringContaining("Cannot find name 'address'.")],
			"conflicted files": [conflictedFiles(), []],
			"exit code": [exitCode(), 1],
			"failed typecheck": [answer(), expect.stringContaining("pnpm run typecheck failed (exit ")],
		});
	},
);

updates.it(
	"update names the rejected transitive version and its trust-policy fix, still runs typecheck and exits nonzero",
	[createdWith010(), published010, starterAt020("is unchanged"), trustDowngrade],
	function* ({ answer, exitCode, printedMentions, update }) {
		yield* update();

		yield* outcomes({
			"exit code": [exitCode(), 1],
			"rejected version": [answer(), expect.stringContaining('ERR_PNPM_TRUST_DOWNGRADE High-risk trust downgrade for "transitive-package@1.2.3"')],
			"trust-policy fix": [answer(), expect.stringContaining("run pnpm update --depth Infinity, then pnpm run typecheck")],
			"typecheck ran": [printedMentions("Running pnpm run typecheck..."), true],
		});
	},
);
