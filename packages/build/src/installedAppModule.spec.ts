import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generatedOnce, generator, registrationsProject } from "#test/generator.ts";
import { noServerInstalled, serverInstalledWith } from "#test/installedServers.ts";

const LIST = "src/generated/server/modules.ts";
const QUEUES_REFUSED =
	"src/server/reminders.ts: reminders carries queues, a part of a registration, but is not written `satisfies AppModule`, so the server's module list leaves it out; write `satisfies AppModule` after its object, with AppModule imported from @shivaedev/server/AppModule.ts, or, when it is no registration, rename its queues key or stop exporting it";
const NOT_SATISFIED =
	"src/shared/labels.ts: labelsRegistration names what it serves but is not written `satisfies AppModule`, so the server's module list leaves it out; write `satisfies AppModule` after its object, with AppModule imported from @shivaedev/server/AppModule.ts";

generator.it(
	"with an installed @shivaedev/server that declares AppModule as an interface, an exported object in a server folder with only queues and no satisfies AppModule stops generate",
	[registrationsProject(), serverInstalledWith("an interface")],
	function* ({ addsPartsOnly, generates }) {
		yield* addsPartsOnly("src/server/reminders.ts", "reminders", ["queues"], "no mark");

		expect(yield* generates()).toEqual({ files: { [LIST]: "refused" }, problems: [QUEUES_REFUSED], programBuilt: false, result: "failed" });
	},
);

for (const declaration of ["no AppModule", "an AppModule whose forms share no property"] as const) {
	generator.it(
		`an installed @shivaedev/server whose AppModule.ts declares ${declaration} stops generate with a message naming that file and what the generator looked for`,
		[registrationsProject(), serverInstalledWith(declaration)],
		function* ({ generatedFile, generates }) {
			yield* outcomes([
				[
					"generate",
					() => generates(),
					{
						files: { [LIST]: "refused" },
						problems: [
							"node_modules/@shivaedev/server/src/AppModule.ts: declares no AppModule type alias or interface with a property every form of registration may carry, so the generator cannot refuse a registration written without `satisfies AppModule`; install @shivaedev/server and @shivaedev/build from the same Platform release",
						],
						result: "failed",
					},
				],
				["the list", () => generatedFile(LIST), "missing"],
			]);
		},
	);
}

generator.it(
	"a project without @shivaedev/server reads no registration parts, so an exported object in a server folder with only queues passes generate and stays off the list",
	[registrationsProject(), noServerInstalled(), generatedOnce()],
	function* ({ addsPartsOnly, generatedFile, generates }) {
		const before = yield* generatedFile(LIST);

		yield* addsPartsOnly("src/server/reminders.ts", "reminders", ["queues"], "no mark");

		yield* outcomes([
			["generate", () => generates(), { files: { [LIST]: "current" }, problems: [], result: "succeeded" }],
			["the list", () => generatedFile(LIST), before],
		]);
	},
);

generator.it(
	"a project without @shivaedev/server reads no registration parts, so an exported object outside a server folder that names its module and services passes generate",
	[registrationsProject(), noServerInstalled(), generatedOnce()],
	function* ({ addsRegistrationAt, generates }) {
		yield* addsRegistrationAt("src/shared/labels.ts", "Labels", "with no annotation");

		expect(yield* generates()).toEqual({ files: { [LIST]: "current" }, problems: [], programBuilt: false, result: "succeeded" });
	},
);

for (const [server, traits] of [
	["this repository's @shivaedev/server", [registrationsProject()]],
	["an installed @shivaedev/server that declares AppModule as an interface", [registrationsProject(), serverInstalledWith("an interface")]],
] as const) {
	generator.it(
		`with ${server}, an exported object outside a server folder that names its module and services without satisfies AppModule stops generate`,
		traits,
		function* ({ addsRegistrationAt, generates }) {
			yield* addsRegistrationAt("src/shared/labels.ts", "Labels", "with no annotation");

			expect(yield* generates()).toEqual({ files: { [LIST]: "refused" }, problems: [NOT_SATISFIED], programBuilt: false, result: "failed" });
		},
	);
}
