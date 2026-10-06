import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runStories } from "#test/runStories.ts";

const STORIES = relative(process.cwd(), fileURLToPath(new URL("test-support/failingStories.ts", import.meta.url)));

const LARGE_BAKERY = "node_modules/.cache/test-story/failingstories.ts--bakery-story-writes-a-bakery-too-large-to-print-to-a-file--bakery.json";

const SLOW = 30_000;

async function story(name: string) {
	const { stories } = await runStories({ include: "src/test-support/failingStories.ts", testNamePattern: name });
	const [result] = stories.filter((candidate) => candidate.name === name);
	return { errors: result?.errors, state: result?.state };
}

function guide(name: string): string[] {
	return [
		"╭─ test-story: how to read the story below",
		'│ "given" lines are the test\'s traits, the other lines were told by verbs and engine steps as they ran, and ✗ marks',
		`│ where the test stopped. The traits, verbs and steps live in the ${name} story kit that this test imports.`,
		"╰─",
		"",
	];
}

function failed(...lines: string[]) {
	return { errors: [lines.join("\n")], state: "failed" };
}

function rerun(test: string): string {
	const command = `Rerun: vitest run ${STORIES} -t "${test}"`;
	return command.length > 120 ? `Rerun: vitest run ${STORIES} \\\n  -t "${test}"` : command;
}

it(
	"adds nothing when the story passes",
	async () => {
		expect(await story("Bakery Story: adds nothing when the story passes")).toEqual({ errors: [], state: "passed" });
	},
	SLOW,
);

it(
	"prints the story under the assertion that stopped it, with the spec line under the ✗",
	async () => {
		expect(await story("Bakery Story: marks where an assertion stopped the story")).toEqual(
			failed(
				"loaves: expected 1 to be 2 // Object.is equality",
				"",
				...guide("bakery"),
				"  given  the oven is lit",
				"  given  the baker has 1 balls of dough",
				"         1m a loaf comes out of the oven",
				"✗        the test failed after the line above",
				`         at ${STORIES}:10:59`,
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

it(
	"marks the trait that refused, with the spec line that named it",
	async () => {
		expect(await story("Bakery Story: marks the trait that refused")).toEqual(
			failed(
				'the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3',
				"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait",
				"      in the bakery story kit if this bakery should be possible.",
				"",
				...guide("bakery"),
				"  given  the oven is lit",
				"✗ given  the baker has 4 balls of dough",
				`         refused at ${STORIES}:13:57`,
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

it(
	"prints the story when the engine breaks",
	async () => {
		expect(await story("Bakery Story: prints the story when the bakery breaks")).toEqual(
			failed(
				"the bakery broke after 0 steps: the oven is cold with 1 balls of dough waiting",
				"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this",
				"      failure shows the setup and steps that led here.",
				"",
				...guide("bakery"),
				"  given  the baker has 1 balls of dough",
				"✗        the test failed after the line above",
				`         at ${STORIES}:16:14`,
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

it(
	"prints what the kit's inspect shows",
	async () => {
		expect(await story("Mill Story: prints what the kit's inspect shows")).toEqual(
			failed(
				"wind: expected +0 to be 1 // Object.is equality",
				"",
				...guide("mill"),
				"  given  the sails are turning",
				"         the miller grinds 2 sacks",
				"✗        the test failed after the line above",
				`         at ${STORIES}:22:36`,
				"",
				'The mill when the test failed: {"sacks":2,"sails":"turning"}',
				"",
				rerun("Mill Story: prints what the kit's inspect shows"),
			),
		);
	},
	SLOW,
);

it(
	"marks a failure before the story told a line",
	async () => {
		expect(await story("Mill Story: marks a failure before the story told a line")).toEqual(
			failed(
				"sacks: expected +0 to be 1 // Object.is equality",
				"",
				...guide("mill"),
				"✗        the test failed before the story told a line",
				`         at ${STORIES}:26:38`,
				"",
				'The mill when the test failed: {"sacks":0,"sails":"furled"}',
				"",
				rerun("Mill Story: marks a failure before the story told a line"),
			),
		);
	},
	SLOW,
);

it(
	"writes an engine too large to print to a file and names the file",
	async () => {
		expect(await story("Bakery Story: writes a bakery too large to print to a file")).toEqual(
			failed(
				"orders: expected [ …(60) ] to have a length of +0 but got 60",
				"",
				...guide("bakery"),
				"  given  the bakery has 60 orders",
				"✗        the test failed after the line above",
				`         at ${STORIES}:30:40`,
				"",
				"The bakery when the test failed is 2954 characters of JSON, too long to print here. Read it in",
				LARGE_BAKERY,
				"",
				rerun("Bakery Story: writes a bakery too large to print to a file"),
			),
		);
		const written: unknown = JSON.parse(readFileSync(LARGE_BAKERY, "utf8"));
		expect(written).toEqual(expect.objectContaining({ orders: expect.arrayContaining(["order 60: a loaf of rye for the market stall"]) }));
	},
	SLOW,
);

it(
	"splits the rerun command when a long test name would carry it past the width of a terminal",
	async () => {
		expect(await story("Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal")).toEqual(
			failed(
				"sacks: expected +0 to be 1 // Object.is equality",
				"",
				...guide("mill"),
				"✗        the test failed before the story told a line",
				`         at ${STORIES}:34:38`,
				"",
				'The mill when the test failed: {"sacks":0,"sails":"furled"}',
				"",
				rerun("Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal"),
			),
		);
	},
	SLOW,
);
