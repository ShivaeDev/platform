import { model } from "#test/model.ts";

model.it("the model assertion reports every mismatch independently of column order", [], function* ({ allMismatchesAreReported }) {
	yield* allMismatchesAreReported();
});

model.it("the type map cannot silently drift from the model at runtime", [], function* ({ typeMapDriftIsReported }) {
	yield* typeMapDriftIsReported();
});
