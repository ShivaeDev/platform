import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { fullAppToCompare } from "#test/traits.ts";

const REGISTRATIONS = ["src/admin/foundation.ts", "src/server/modules.ts", "src/client/modules.ts"];
const NOTES_REFERENCE = /notes(?:Registration|Worker|Migrations)|notesModule|noteQueue|#modules\/notes/u;

application.it(
	"a minimal app removes notes files, registrations, dependencies and the declared generated folder that only notes imports from, preserves the remaining full app files and records its variant",
	[fullAppToCompare],
	function* ({ createApp, dependsOn, file, filesDifferingFrom, filesMissingFrom, filesOnlyIn, generationRecord }) {
		for (const registration of REGISTRATIONS) {
			expect(yield* file(registration)).toMatch(NOTES_REFERENCE);
		}
		expect(yield* dependsOn("@tanstack/react-table")).toBe(true);
		expect(yield* file("quality.config.ts")).toContain('generated: ["src/generated"]');

		yield* createApp("my-app", "--minimal", "--no-git");

		yield* outcomes([
			["only in the full app", () => filesOnlyIn("full/my-app"), ["src/modules/notes/"]],
			["only in the minimal app", () => filesMissingFrom("full/my-app"), []],
			[
				"different files",
				() => filesDifferingFrom("full/my-app"),
				[
					".create-app.json",
					".env.local",
					"package.json",
					"quality.config.ts",
					"src/admin/foundation.ts",
					"src/client/modules.ts",
					"src/server/modules.ts",
				],
			],
			["notes dependency", () => dependsOn("@tanstack/react-table"), false],
			["generation record", () => generationRecord(), { minimal: true, name: "my-app" }],
		]);
		for (const registration of REGISTRATIONS) {
			expect(yield* file(registration)).not.toMatch(NOTES_REFERENCE);
		}
		expect(yield* file("quality.config.ts")).not.toContain("src/generated");
	},
);
