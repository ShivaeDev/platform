import { empty, emptyApp, migrated, migratedApp, storyTable } from "#test/selectedApp.ts";

for (const [name, given] of [
	["empty selection", [storyTable, empty]],
	["default after empty selection", []],
] as const) {
	migratedApp.it(name, given, function* ({ observeStartup, tables, tablesThroughPg }, context) {
		const observation = yield* observeStartup();
		context.task.meta.selectedDatabase = observation;
		observation.clients = { pg: yield* tablesThroughPg(), sql: yield* tables() };
	});
}

for (const [name, given] of [
	["migrated selection", [migrated]],
	["empty default after migrated selection", []],
] as const) {
	emptyApp.it(name, given, function* ({ observeStartup }, context) {
		context.task.meta.selectedDatabase = yield* observeStartup();
	});
}

migratedApp.it("failed story", [empty], function* ({ observeStartup, stopWithFailure }, context) {
	context.task.meta.selectedDatabase = yield* observeStartup();
	yield* stopWithFailure();
});
