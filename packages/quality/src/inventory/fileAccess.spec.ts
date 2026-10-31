import { expect } from "vitest";
import { inventoryStory, repositoryHas, repositoryHasFolder } from "#test/inventoryStory.ts";

inventoryStory.it("quality saves a baseline into folders that do not exist yet", [], function* ({ onDisk, saves }) {
	expect(yield* onDisk("quality/nested/baseline.jsonl")).toBe("absent");

	yield* saves("quality/nested/baseline.jsonl", "entry\n");

	expect(yield* onDisk("quality/nested/baseline.jsonl")).toBe("entry\n");
});

inventoryStory.it(
	"quality fails to save a baseline whose parent folder is a file and names the baseline",
	[repositoryHas({ content: "occupied", path: "quality" })],
	function* ({ failure, saves }) {
		yield* saves("quality/baseline.jsonl", "entry\n");

		expect(yield* failure()).toMatch(/^cannot write quality\/baseline\.jsonl: /u);
	},
);

inventoryStory.it("quality reads an optional file that does not exist as absent", [], function* ({ readsOptional }) {
	expect(yield* readsOptional(".gitignore")).toBe("absent");
});

inventoryStory.it(
	"quality fails to read an optional manifest whose parent folder is a file and names the manifest",
	[repositoryHas({ content: "file", path: "occupied" })],
	function* ({ failure, readsOptional }) {
		yield* readsOptional("occupied/package.json");

		expect(yield* failure()).toMatch(/^cannot read occupied\/package\.json: /u);
	},
);

inventoryStory.it("quality fails to read a required file that does not exist and says it is missing", [], function* ({ failure, readsRequired }) {
	yield* readsRequired("pnpm-workspace.yaml");

	expect(yield* failure()).toBe("required input is missing: pnpm-workspace.yaml");
});

inventoryStory.it(
	"quality fails to read a required file that is a folder and names the file",
	[repositoryHasFolder("package.json")],
	function* ({ failure, readsRequired }) {
		yield* readsRequired("package.json");

		expect(yield* failure()).toMatch(/^cannot read package\.json: /u);
	},
);
