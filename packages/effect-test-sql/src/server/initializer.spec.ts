import { Result } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";
import { emptyInitializer, failingInitializer } from "#test/databaseTraits.ts";
import { clientInitializer, firstDeployment, urlInitializer } from "#test/initializerStories.ts";

urlInitializer.it(
	"the production initializer finishes and releases its resources before an ordinary story",
	[],
	function* ({ readState, readPreparation, changeState }) {
		const [state] = yield* readState();
		expect(state?.value).toBe("ready");
		expect(state?.initialized_in).toMatch(/^effect_test_/u);
		expect(state?.database).not.toBe(state?.initialized_in);
		expect(yield* readPreparation()).toEqual({ completed: 1, fixtures: 1, released: 1, started: 1 });
		yield* changeState("committed");
		expect((yield* readState()).map(({ value }) => value)).toEqual(["committed"]);
	},
);

urlInitializer.it(
	"another story clones the initialized schema without running the initializer again",
	[],
	function* ({ readState, readPreparation }) {
		expect((yield* readState()).map(({ value }) => value)).toEqual(["ready"]);
		expect(yield* readPreparation()).toEqual({ completed: 1, fixtures: 1, released: 1, started: 1 });
	},
);

urlInitializer.it("a deployment story still receives an empty database", [firstDeployment], function* ({ readSchema, readPreparation }) {
	expect(yield* readSchema()).toEqual([]);
	expect(yield* readPreparation()).toEqual({ completed: 1, fixtures: 1, released: 1, started: 1 });
});

clientInitializer.it("an initializer Effect can use the supplied native SQL client", [], function* ({ readState, readSchema, readPreparation }) {
	expect(yield* readSchema()).toEqual([{ name: "app_state" }]);
	expect((yield* readState()).map(({ value }) => value)).toEqual(["ready"]);
	expect(yield* readPreparation()).toEqual({ completed: 1, fixtures: 1, released: 1, started: 1 });
});

database.it("disabled preparation skips the initializer and fixtures", [emptyInitializer], function* ({ readSharedSchema, readCloneSchema }) {
	expect(yield* readSharedSchema()).toEqual([{ name: null }]);
	expect(yield* readCloneSchema()).toEqual([{ name: null }]);
});

database.it(
	"a failed initializer retains its failure and releases the template",
	[failingInitializer],
	function* ({ readAcquisition, closeWorker, readTemplate, readDatabases }) {
		expect(yield* readAcquisition()).toEqual(Result.fail("initializer failed"));
		yield* closeWorker();
		const template = yield* readTemplate();
		expect(template).not.toBe("");
		expect(yield* readDatabases([template])).toEqual([]);
	},
);
