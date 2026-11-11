import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { repositoryReadsStory, watching } from "#test/repositoryReadsStory.ts";

repositoryReadsStory.it(
	"a query reading a book by id, without declared reads, reruns for a write to that book and not for a write to another book",
	[watching(["book 1", "the catalog"])],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(2, "Persuasion");

		expect(yield* untilDeliveries(3)).toEqual(["book 1: Dune", "the catalog: Dune | Emma | Ulysses", "the catalog: Dune | Persuasion | Ulysses"]);

		yield* retitle(1, "Dune Messiah");

		expect((yield* untilDeliveries(5)).slice(3)).toEqual(["book 1: Dune Messiah", "the catalog: Dune Messiah | Persuasion | Ulysses"]);
	},
);

repositoryReadsStory.it(
	"a query listing a shelf by its bucket, without declared reads, reruns for a write on that shelf and not for a write on another shelf",
	[watching(["shelf 1", "the catalog"])],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(3, "Odyssey");

		expect(yield* untilDeliveries(3)).toEqual(["shelf 1: Dune | Emma", "the catalog: Dune | Emma | Ulysses", "the catalog: Dune | Emma | Odyssey"]);

		yield* retitle(2, "Persuasion");

		expect((yield* untilDeliveries(5)).slice(3)).toEqual(["shelf 1: Dune | Persuasion", "the catalog: Dune | Persuasion | Odyssey"]);
	},
);

repositoryReadsStory.it(
	"a query listing every book without a filter, without declared reads, reruns for a write to any book",
	[watching(["the catalog"])],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(3, "Odyssey");

		expect(yield* untilDeliveries(2)).toEqual(["the catalog: Dune | Emma | Ulysses", "the catalog: Dune | Emma | Odyssey"]);
	},
);

repositoryReadsStory.it(
	"a query that declares its shelf's bucket listens only on that key, though its handler reads every book, so a write on another shelf does not rerun it",
	[watching(["shelf 1 declaring its bucket and filtering every book in code", "the catalog"])],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(3, "Odyssey");

		expect(yield* untilDeliveries(3)).toEqual([
			"shelf 1 declaring its bucket and filtering every book in code: Dune | Emma",
			"the catalog: Dune | Emma | Ulysses",
			"the catalog: Dune | Emma | Odyssey",
		]);

		yield* retitle(2, "Persuasion");

		expect((yield* untilDeliveries(5)).slice(3)).toEqual([
			"shelf 1 declaring its bucket and filtering every book in code: Dune | Persuasion",
			"the catalog: Dune | Persuasion | Odyssey",
		]);
	},
);

for (const style of ["module handlers", "hand-written handlers"] as const) {
	repositoryReadsStory.it(
		`with ${style}, a write to the row a read policy reads and records with recordRead does not rerun the query, while a query reading that row itself reruns`,
		[watching(["shelf 1 behind a policy that reads and records alice's reader row", "alice's reader row"], style)],
		function* ({ move, untilDeliveries }) {
			yield* move(2);

			expect(yield* untilDeliveries(3)).toEqual([
				"shelf 1 behind a policy that reads and records alice's reader row: Dune | Emma",
				"alice's reader row: 1",
				"alice's reader row: 2",
			]);
		},
	);
}

const BOOK_1_KEYS = ["library_books:1", "library_books:*"];

repositoryReadsStory.it(
	"a handler that reads the same book a hundred times registers its key once, and its rerun registers it no more",
	[watching(["book 1 read 100 times"])],
	function* ({ registrationsOfBook, retitle, untilDeliveries }) {
		expect(yield* registrationsOfBook(1)).toEqual([BOOK_1_KEYS]);

		yield* retitle(1, "Dune Messiah");

		yield* outcomes([
			["deliveries", () => untilDeliveries(2), ["book 1 read 100 times: Dune", "book 1 read 100 times: Dune Messiah"]],
			["registrations of book 1", () => registrationsOfBook(1), [BOOK_1_KEYS]],
		]);
	},
);
