import { expect } from "vitest";
import { repositoryReadsStory, watching } from "#test/repositoryReadsStory.ts";

repositoryReadsStory.it(
	"a diary read filtered by owner and day, without declared reads, reruns for a write in that owner and day and not for another day of that owner or the same day of another owner",
	[watching(["alice's diary for day 1", "every diary entry"])],
	function* ({ untilDeliveries, writesInDiary }) {
		yield* writesInDiary("alice", 2, "wind");

		expect(yield* untilDeliveries(3)).toEqual([
			"alice's diary for day 1: rain",
			"every diary entry: rain | sun | fog",
			"every diary entry: rain | sun | fog | wind",
		]);

		yield* writesInDiary("bob", 1, "hail");

		expect((yield* untilDeliveries(4)).slice(3)).toEqual(["every diary entry: rain | sun | fog | wind | hail"]);

		yield* writesInDiary("alice", 1, "snow");

		expect((yield* untilDeliveries(6)).slice(4)).toEqual([
			"alice's diary for day 1: rain | snow",
			"every diary entry: rain | sun | fog | wind | hail | snow",
		]);
	},
);
