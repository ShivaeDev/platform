import { expect } from "vitest";
import { repositoryReadsStory, watching } from "#test/repositoryReadsStory.ts";

const LOANS = "alice's loans on shelf 1 through raw SQL marking both buckets";

repositoryReadsStory.it(
	"a raw joined read marking a bucket on each table reruns for a write in either bucket and not for a write in another",
	[watching([LOANS, "the catalog", "every loan"])],
	function* ({ lend, retitle, untilDeliveries }) {
		yield* retitle(3, "Odyssey");

		expect(yield* untilDeliveries(4)).toEqual([
			`${LOANS}: Dune`,
			"the catalog: Dune | Emma | Ulysses",
			"every loan: alice has book 1 | alice has book 3",
			"the catalog: Dune | Emma | Odyssey",
		]);

		yield* retitle(2, "Persuasion");

		expect((yield* untilDeliveries(6)).slice(4)).toEqual([`${LOANS} unchanged`, "the catalog: Dune | Persuasion | Odyssey"]);

		yield* lend(2, "bob");

		expect((yield* untilDeliveries(7)).slice(6)).toEqual(["every loan: alice has book 1 | alice has book 3 | bob has book 2"]);

		yield* lend(2, "alice");

		expect((yield* untilDeliveries(9)).slice(7)).toEqual([
			`${LOANS}: Dune | Persuasion`,
			"every loan: alice has book 1 | alice has book 3 | bob has book 2 | alice has book 2",
		]);
	},
);

repositoryReadsStory.it(
	"the host warns once, naming the query, about a query without declared reads whose raw SQL recorded no key, and not about one declaring that it reads nothing",
	[watching(["every title through unmarked raw SQL", "every title through unmarked raw SQL, declaring it reads nothing"])],
	function* ({ loggedWarnings }) {
		expect(yield* loggedWarnings()).toEqual([
			"Live query unmarkedTitles declares no reads and recorded no key, so no write reruns it. Mark its raw SQL reads with their keys or declare reads; reads: () => [] states that it reads nothing.",
		]);
	},
);
