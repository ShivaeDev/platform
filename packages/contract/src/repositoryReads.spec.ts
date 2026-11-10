import { expect } from "vitest";
import { repositoryReadsStory, watching } from "#test/repositoryReadsStory.ts";

repositoryReadsStory.it(
	"a query reading a book by id, with no declared reads, reruns for a write to that book and not for a write to another book",
	[watching("book 1", "the catalog")],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(2, "Persuasion");

		expect(yield* untilDeliveries(3)).toEqual(["book 1: Dune", "the catalog: Dune | Emma | Ulysses", "the catalog: Dune | Persuasion | Ulysses"]);

		yield* retitle(1, "Dune Messiah");

		expect((yield* untilDeliveries(5)).slice(3)).toEqual(["book 1: Dune Messiah", "the catalog: Dune Messiah | Persuasion | Ulysses"]);
	},
);

repositoryReadsStory.it(
	"a query listing a shelf by its bucket, with no declared reads, reruns for a write on that shelf and not for a write on another shelf",
	[watching("shelf 1", "the catalog")],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(3, "Odyssey");

		expect(yield* untilDeliveries(3)).toEqual(["shelf 1: Dune | Emma", "the catalog: Dune | Emma | Ulysses", "the catalog: Dune | Emma | Odyssey"]);

		yield* retitle(2, "Persuasion");

		expect((yield* untilDeliveries(5)).slice(3)).toEqual(["shelf 1: Dune | Persuasion", "the catalog: Dune | Persuasion | Odyssey"]);
	},
);

repositoryReadsStory.it(
	"a query listing every book without a filter, with no declared reads, reruns for a write to any book",
	[watching("the catalog")],
	function* ({ retitle, untilDeliveries }) {
		yield* retitle(3, "Odyssey");

		expect(yield* untilDeliveries(2)).toEqual(["the catalog: Dune | Emma | Ulysses", "the catalog: Dune | Emma | Odyssey"]);
	},
);

repositoryReadsStory.it(
	"a write to the row a read policy reads does not rerun the query, while a query reading that row itself reruns",
	[watching("shelf 1 behind a policy reading alice's reader row", "alice's reader row")],
	function* ({ move, untilDeliveries }) {
		yield* move(2);

		expect(yield* untilDeliveries(3)).toEqual([
			"shelf 1 behind a policy reading alice's reader row: Dune | Emma",
			"alice's reader row: 1",
			"alice's reader row: 2",
		]);
	},
);

repositoryReadsStory.it(
	"a handler that reads the same book a hundred times registers its key once, and its rerun registers it no more",
	[watching("book 1 read 100 times")],
	function* ({ registrationsOfBook, retitle, untilDeliveries }) {
		expect(yield* registrationsOfBook(1)).toBe(1);

		yield* retitle(1, "Dune Messiah");

		expect(yield* untilDeliveries(2)).toEqual(["book 1 read 100 times: Dune", "book 1 read 100 times: Dune Messiah"]);
		expect(yield* registrationsOfBook(1)).toBe(1);
	},
);
