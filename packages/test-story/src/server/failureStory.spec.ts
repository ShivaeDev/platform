import { expect } from "vitest";
import { failed, guide, LARGE_BAKERY, rerun, STORIES } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

const SLOW = 30_000;

storyRunner.it(
	"adds nothing when the story passes",
	[],
	function* ({ failure }) {
		expect(yield* failure("Bakery Story: adds nothing when the story passes")).toEqual({ errors: [], state: "passed" });
	},
	SLOW,
);

storyRunner.it(
	"prints the story under the assertion that stopped it, with the spec line under the ✗",
	[],
	function* ({ failure }) {
		expect(yield* failure("Bakery Story: marks where an assertion stopped the story")).toEqual(
			failed(
				"loaves: expected 1 to be 2 // Object.is equality",
				"",
				...guide("bakery"),
				"  given  the oven is lit",
				"  given  the baker has 1 balls of dough",
				"         1m a loaf comes out of the oven",
				"✗        the test failed after the line above",
				`         at ${STORIES}:12:34`,
				"",
				"The bakery when the test failed:",
				'{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":1,"minute":1,"orders":[],"ovenLit":true,"overfired":false,',
				'"smoking":false,"starter":false}',
				"",
				rerun("Bakery Story: marks where an assertion stopped the story"),
			),
		);
	},
	SLOW,
);

storyRunner.it(
	"marks the trait that refused, with the spec line that named it",
	[],
	function* ({ failure }) {
		expect(yield* failure("Bakery Story: marks the trait that refused")).toEqual(
			failed(
				'the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3',
				"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait",
				"      in the bakery story kit if this bakery should be possible.",
				"",
				...guide("bakery"),
				"  given  the oven is lit",
				"✗ given  the baker has 4 balls of dough",
				`         refused at ${STORIES}:15:57`,
				"  given  the bakery has 1 bowls",
				"",
				"The bakery when the test failed:",
				'{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":true,"overfired":false,',
				'"smoking":false,"starter":false}',
				"",
				rerun("Bakery Story: marks the trait that refused"),
			),
		);
	},
	SLOW,
);

storyRunner.it(
	"prints the story when the engine breaks",
	[],
	function* ({ failure }) {
		expect(yield* failure("Bakery Story: prints the story when the bakery breaks")).toEqual(
			failed(
				"the bakery broke after 0 steps: the oven is cold with 1 balls of dough waiting",
				"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this",
				"      failure shows the setup and steps that led here.",
				"",
				...guide("bakery"),
				"  given  the baker has 1 balls of dough",
				"✗        the test failed after the line above",
				`         at ${STORIES}:18:14`,
				"",
				"The bakery when the test failed:",
				'{"bowls":1,"capacity":3,"dough":1,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":false,"overfired":false,',
				'"smoking":false,"starter":false}',
				"",
				rerun("Bakery Story: prints the story when the bakery breaks"),
			),
		);
	},
	SLOW,
);

storyRunner.it(
	"prints what the kit's inspect shows",
	[],
	function* ({ failure }) {
		expect(yield* failure("Mill Story: prints what the kit's inspect shows")).toEqual(
			failed(
				"wind: expected +0 to be 1 // Object.is equality",
				"",
				...guide("mill"),
				"  given  the sails are turning",
				"         the miller grinds 2 sacks",
				"✗        the test failed after the line above",
				`         at ${STORIES}:24:36`,
				"",
				'The mill when the test failed: {"sacks":2,"sails":"turning"}',
				"",
				rerun("Mill Story: prints what the kit's inspect shows"),
			),
		);
	},
	SLOW,
);

storyRunner.it(
	"marks a failure before the story told a line",
	[],
	function* ({ failure }) {
		expect(yield* failure("Mill Story: marks a failure before the story told a line")).toEqual(
			failed(
				"sacks: expected +0 to be 1 // Object.is equality",
				"",
				...guide("mill"),
				"✗        the test failed before the story told a line",
				`         at ${STORIES}:28:38`,
				"",
				'The mill when the test failed: {"sacks":0,"sails":"furled"}',
				"",
				rerun("Mill Story: marks a failure before the story told a line"),
			),
		);
	},
	SLOW,
);

storyRunner.it(
	"writes an engine too large to print to a file and names the file",
	[],
	function* ({ failure, writtenBakery }) {
		expect(yield* failure("Bakery Story: writes a bakery too large to print to a file")).toEqual(
			failed(
				"orders: expected [ …(60) ] to have a length of +0 but got 60",
				"",
				...guide("bakery"),
				"  given  the bakery has 60 orders",
				"✗        the test failed after the line above",
				`         at ${STORIES}:32:40`,
				"",
				"The bakery when the test failed is 2954 characters of JSON, too long to print here. Read it in",
				LARGE_BAKERY,
				"",
				rerun("Bakery Story: writes a bakery too large to print to a file"),
			),
		);
		const written = writtenBakery();
		expect(written).toEqual(expect.objectContaining({ orders: expect.arrayContaining(["order 60: a loaf of rye for the market stall"]) }));
	},
	SLOW,
);

storyRunner.it(
	"splits the rerun command when a long test name would carry it past the width of a terminal",
	[],
	function* ({ failure }) {
		expect(yield* failure("Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal")).toEqual(
			failed(
				"sacks: expected +0 to be 1 // Object.is equality",
				"",
				...guide("mill"),
				"✗        the test failed before the story told a line",
				`         at ${STORIES}:36:38`,
				"",
				'The mill when the test failed: {"sacks":0,"sails":"furled"}',
				"",
				rerun("Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal"),
			),
		);
	},
	SLOW,
);
