import { expect } from "vitest";
import { columns, SourceRow } from "#test/insertSelect.ts";
import { hasInsertSelectRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { tupleIn } from "#tupleIn.ts";

postgres.it("findMany with an empty tuple list matches nothing", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source } = insertSelect();
	expect(yield* source.findMany({ where: tupleIn(SourceRow, ["sourceKey", "amount"], []) })).toEqual([]);
});

postgres.it("select with an empty tuple list copies nothing", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source, target } = insertSelect();
	expect(yield* target.insertFromSelect(source.select({ where: tupleIn(SourceRow, ["sourceKey", "amount"], []) }), columns)).toEqual([]);
	expect(yield* target.findMany()).toEqual([]);
});

postgres.it("delete with an empty tuple list leaves rows intact", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source } = insertSelect();
	const before = yield* source.findMany({ orderBy: { direction: "asc", field: "sourceKey" } });
	yield* source.delete(tupleIn(SourceRow, ["sourceKey", "amount"], []));
	expect(yield* source.findMany({ orderBy: { direction: "asc", field: "sourceKey" } })).toEqual(before);
});
