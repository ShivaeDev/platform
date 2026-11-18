import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dependenciesInstalled, traceStoreLocation } from "#test/traceStoreLocation.ts";

const IN_THE_TEMPORARY_FOLDER = expect.stringMatching(/^temporary\/shivaedev-server-[0-9a-f]{12}\/traces\.db$/u);

traceStoreLocation.it(
	"a development application that chose no trace store records under its node_modules cache folder",
	[dependenciesInstalled()],
	function* ({ runsInDevelopment, traceStores }) {
		yield* runsInDevelopment();

		expect(yield* traceStores()).toEqual(["application/node_modules/.cache/@shivaedev/server/traces.db"]);
	},
);

traceStoreLocation.it(
	"without a node_modules folder, the application records in the temporary folder, says where and writes nothing to its own folder",
	[],
	function* ({ announcedStores, applicationFolder, runsInDevelopment, traceStores }) {
		yield* runsInDevelopment();

		yield* outcomes([
			["trace stores", () => traceStores(), [IN_THE_TEMPORARY_FOLDER]],
			["announced stores", () => announcedStores(), [IN_THE_TEMPORARY_FOLDER]],
			["application folder", () => applicationFolder(), []],
		]);
	},
);
