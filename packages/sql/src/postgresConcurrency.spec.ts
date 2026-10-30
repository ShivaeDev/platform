import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { documentDeleted, documentSaved, versions } from "#test/versions.ts";

for (const write of ["insert", "insertVoid", "insertOrIgnore"] as const) {
	versions.it(`${write} saves a new document at version 0`, [], function* ({ document, insertDocument }) {
		yield* insertDocument("Draft", write);

		expect(yield* document()).toEqual({ lockVersion: 0, name: "Draft" });
	});
}

versions.it(
	"update from the current version saves the document at the next version and returns it",
	[documentSaved("Draft")],
	function* ({ document, endings, renameDocument }) {
		expect(yield* document()).toEqual({ lockVersion: 0, name: "Draft" });

		yield* renameDocument(0, "Published");

		yield* outcomes({
			"stored document": [document(), { lockVersion: 1, name: "Published" }],
			"update ending": [endings(), ["saved at version 1"]],
		});
	},
);

versions.it(
	"updateVoid from the current version saves the document at the next version",
	[documentSaved("Draft")],
	function* ({ document, renameDocument }) {
		yield* renameDocument(0, "Published", "updateVoid");

		expect(yield* document()).toEqual({ lockVersion: 1, name: "Published" });
	},
);

for (const write of ["update", "updateVoid"] as const) {
	versions.it(
		`${write} from a stale version fails with a stale conflict and keeps the newer document`,
		[documentSaved("Draft", ["Published"])],
		function* ({ document, endings, renameDocument }) {
			yield* renameDocument(0, "Stale", write);

			yield* outcomes({
				"stored document": [document(), { lockVersion: 1, name: "Published" }],
				[`${write} ending`]: [endings(), ["failed with a stale version conflict for 1 at version 0"]],
			});
		},
	);
}

versions.it(
	"delete at a stale version fails with a stale conflict and keeps the newer document",
	[documentSaved("Draft", ["Published"])],
	function* ({ deleteDocument, document, endings }) {
		yield* deleteDocument(0);

		yield* outcomes({
			"delete ending": [endings(), ["failed with a stale version conflict for 1 at version 0"]],
			"stored document": [document(), { lockVersion: 1, name: "Published" }],
		});
	},
);

versions.it("delete at the current version removes the document", [documentSaved("Draft", ["Published"])], function* ({ deleteDocument, document }) {
	yield* deleteDocument(1);

	expect(yield* document()).toBe("no such row");
});

for (const write of ["update", "updateVoid"] as const) {
	versions.it(
		`${write} of a deleted document fails with a missing conflict`,
		[documentSaved("Draft", ["Published"]), documentDeleted()],
		function* ({ renameDocument }) {
			expect(yield* renameDocument(1, "Late", write)).toBe("failed with a missing version conflict for 1 at version 1");
		},
	);
}

versions.it(
	"delete of a deleted document fails with a missing conflict",
	[documentSaved("Draft", ["Published"]), documentDeleted()],
	function* ({ deleteDocument }) {
		expect(yield* deleteDocument(1)).toBe("failed with a missing version conflict for 1 at version 1");
	},
);

versions.it(
	"two writers renaming the same version concurrently save once, fail once with a stale conflict, and the stored document is the winner's",
	[documentSaved("Draft")],
	function* ({ raceEndings, storedDocumentWriter, writersRace }) {
		yield* writersRace();

		yield* outcomes({
			"race endings": [raceEndings(), ["failed with a stale version conflict for 1 at version 0", "saved at version 1"]],
			"stored document": [storedDocumentWriter(), "the winning writer"],
		});
	},
);

versions.it(
	"versioned writes inside a failing transaction roll back and leave the document at its earlier version",
	[documentSaved("Draft")],
	function* ({ deleteDocument, document, documentNames, endings, inFailingTransaction, insertDocument, renameDocument }) {
		yield* inFailingTransaction(function* () {
			yield* renameDocument(0, "Published");
			yield* insertDocument("Temporary", "insertVoid");
			yield* deleteDocument(1);
		});

		yield* outcomes({
			"stored document": [document(), { lockVersion: 0, name: "Draft" }],
			"stored names": [documentNames(), ["Draft"]],
			"write endings": [endings(), ["saved at version 1", "inserted", "succeeded", "failed with cancelled"]],
		});
	},
);

versions.it(
	"insertOrIgnore of a document whose name is taken is ignored and keeps the stored version",
	[documentSaved("Draft", ["Published"])],
	function* ({ document, endings, insertDocument }) {
		yield* insertDocument("Published", "insertOrIgnore");

		yield* outcomes({
			"insertOrIgnore ending": [endings(), ["ignored"]],
			"stored document": [document(), { lockVersion: 1, name: "Published" }],
		});
	},
);
