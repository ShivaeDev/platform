import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { productionServices } from "#test/productionServices.ts";

productionServices.it(
	"preparation, shared and isolated fixtures provide the three native SQL services on one configured pool",
	[],
	function* ({ connections, preparationConnections }) {
		const configuredSession = { backends: 1, names: ["production-fixture", "production-fixture", "production-fixture"] };
		yield* outcomes([
			["template preparation", () => preparationConnections(), [configuredSession]],
			["shared database", () => connections("the shared database"), configuredSession],
			["isolated database", () => connections("a new clone"), configuredSession],
		]);
	},
);

productionServices.it(
	"a committed write refreshes its clone's reader without refreshing another clone's reader",
	[],
	function* ({ openClone, watchItems, readItems, writeItem, refreshes }) {
		yield* openClone("first clone");
		yield* openClone("second clone");
		yield* watchItems("first clone");
		yield* watchItems("second clone");
		yield* outcomes([
			["first reader's initial items", () => readItems("first clone"), [{ value: "seed" }]],
			["second reader's initial items", () => readItems("second clone"), [{ value: "seed" }]],
		]);

		yield* writeItem("first clone", "first");

		yield* outcomes([
			["first reader's items", () => readItems("first clone"), [{ value: "first" }]],
			["first reader's refreshes", () => refreshes("first clone"), 1],
			["second reader's refreshes", () => refreshes("second clone"), 0],
		]);

		yield* writeItem("second clone", "second");

		yield* outcomes([
			["second reader's items", () => readItems("second clone"), [{ value: "second" }]],
			["first reader's refreshes", () => refreshes("first clone"), 1],
			["second reader's refreshes", () => refreshes("second clone"), 1],
		]);
	},
);
