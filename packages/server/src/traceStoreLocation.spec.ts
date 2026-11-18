import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dependenciesInstalled, runsAsRoot, traceStoreLocation } from "#test/traceStoreLocation.ts";

const IN_ITS_TEMPORARY_FOLDER = expect.stringMatching(/^temporary\/shivaedev-server-\d+-[0-9a-f]{12}\/traces\.db$/u);
const IN_A_FRESH_FOLDER = expect.stringMatching(/^temporary\/shivaedev-server-[0-9A-Za-z]{6}\/traces\.db$/u);
const ITS_TEMPORARY_FOLDER = expect.stringMatching(/^temporary\/shivaedev-server-\d+-[0-9a-f]{12}$/u);
const PRIVATE = "this user's folder, mode 700";

traceStoreLocation.it(
	"a development application that chose no trace store records under its node_modules cache folder",
	[dependenciesInstalled()],
	function* ({ runsInDevelopment, traceStores }) {
		yield* runsInDevelopment();

		expect(yield* traceStores()).toEqual(["application/node_modules/.cache/@shivaedev/server/traces.db"]);
	},
);

traceStoreLocation.it(
	"without a node_modules folder, the application records in a temporary folder only its user can reach, says where and writes nothing to its own folder",
	[],
	function* ({ announcedStoreFolders, announcedStores, applicationFolder, refusedStoreFolders, runsInDevelopment, traceStores }) {
		yield* runsInDevelopment();

		yield* outcomes([
			["trace stores", () => traceStores(), [IN_ITS_TEMPORARY_FOLDER]],
			["announced stores", () => announcedStores(), [IN_ITS_TEMPORARY_FOLDER]],
			["announced store folders", () => announcedStoreFolders(), [PRIVATE]],
			["refused store folders", () => refusedStoreFolders(), []],
			["application folder", () => applicationFolder(), []],
		]);
	},
);

traceStoreLocation.it(
	"a second start from the same folder records to the same temporary store",
	[],
	function* ({ announcedStores, runsInDevelopment }) {
		yield* runsInDevelopment();
		const [first] = yield* announcedStores();

		yield* runsInDevelopment();

		expect(yield* announcedStores()).toEqual([first, first]);
	},
);

traceStoreLocation.it(
	"after its temporary folder is opened to other users, the next start records in a fresh private folder and names both folders",
	[],
	function* ({ announcedStoreFolders, announcedStores, othersGainStoreFolderAccess, refusedStoreFolders, runsInDevelopment }) {
		yield* runsInDevelopment();
		yield* othersGainStoreFolderAccess();

		yield* runsInDevelopment();

		yield* outcomes([
			["announced stores", () => announcedStores(), [IN_ITS_TEMPORARY_FOLDER, IN_A_FRESH_FOLDER]],
			["announced store folders", () => announcedStoreFolders(), ["this user's folder, mode 755", PRIVATE]],
			["refused store folders", () => refusedStoreFolders(), [ITS_TEMPORARY_FOLDER]],
		]);
	},
);

traceStoreLocation.it(
	"when a link to another folder holds its temporary folder's name, the next start records in a fresh private folder, names both folders and writes nothing behind the link",
	[],
	function* ({ announcedStoreFolders, folderBehindLink, linkTakesStoreFolderPlace, refusedStoreFolders, runsInDevelopment, traceStores }) {
		yield* runsInDevelopment();
		yield* linkTakesStoreFolderPlace();

		yield* runsInDevelopment();

		yield* outcomes([
			["trace stores", () => traceStores(), [IN_A_FRESH_FOLDER]],
			["announced store folders", () => announcedStoreFolders(), ["a link", PRIVATE]],
			["refused store folders", () => refusedStoreFolders(), [ITS_TEMPORARY_FOLDER]],
			["folder behind the link", () => folderBehindLink(), []],
		]);
	},
);

traceStoreLocation.it.runIf(runsAsRoot)(
	"after its temporary folder is handed to another user, the next start records in a fresh private folder and names both folders",
	[],
	function* ({ announcedStoreFolders, announcedStores, anotherUserTakesStoreFolder, refusedStoreFolders, runsInDevelopment }) {
		yield* runsInDevelopment();
		yield* anotherUserTakesStoreFolder();

		yield* runsInDevelopment();

		yield* outcomes([
			["announced stores", () => announcedStores(), [IN_ITS_TEMPORARY_FOLDER, IN_A_FRESH_FOLDER]],
			["announced store folders", () => announcedStoreFolders(), ["another user's folder, mode 700", PRIVATE]],
			["refused store folders", () => refusedStoreFolders(), [ITS_TEMPORARY_FOLDER]],
		]);
	},
);
