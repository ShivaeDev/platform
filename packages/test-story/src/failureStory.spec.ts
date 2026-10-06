import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { expect } from "@effect/vitest";
import { beforeEach } from "vitest";
import { bakery, hasBowls, hasDough, hasOrders, ovenIsLit } from "#test/bakery.ts";
import { mill, sailsAreTurning } from "#test/mill.ts";

const SPEC = relative(process.cwd(), import.meta.filename);

const reported: string[] = [];

const LARGE_BAKERY = "node_modules/.cache/test-story/failurestory.spec.ts--bakery-story-writes-a-bakery-too-large-to-print-to-a-file--bakery.json";

function guide(name: string): string[] {
	return [
		"╭─ test-story: how to read the story below",
		'│ "given" lines are the test\'s traits, the other lines were told by verbs and engine steps as they ran, and ✗ marks',
		`│ where the test stopped. The traits, verbs and steps live in the ${name} story kit that this test imports.`,
		"╰─",
		"",
	];
}

function rerun(test: string): string {
	const command = `Rerun: vitest run ${SPEC} -t "${test}"`;
	return command.length > 120 ? `Rerun: vitest run ${SPEC} \\\n  -t "${test}"` : command;
}

beforeEach(({ onTestFailed }) => {
	onTestFailed(({ task }) => {
		reported.push(...(task.result?.errors ?? []).map((error) => error.message));
	});
});

bakery.it("adds nothing when the story passes", [ovenIsLit(), hasDough(1)], function* ({ oven }) {
	expect((yield* oven.bakesEverything()).loaves).toBe(1);
});

bakery.it.fails("marks where an assertion stopped the story", [ovenIsLit(), hasDough(1)], function* ({ oven }) {
	expect((yield* oven.bakesEverything()).loaves, "loaves").toBe(2);
});

bakery.it.fails("marks the trait that refused", [ovenIsLit(), hasDough(4), hasBowls(1)]);

bakery.it.fails("prints the story when the bakery breaks", [hasDough(1)], function* ({ oven }) {
	yield* oven.bakesEverything();
});

mill.it.fails("prints what the kit's inspect shows", [sailsAreTurning()], ({ miller, story }) => {
	miller.grinds(2);

	expect(story.engine.wind, "wind").toBe(1);
});

mill.it.fails("marks a failure before the story told a line", [], ({ story }) => {
	expect(story.engine.sacks, "sacks").toBe(1);
});

bakery.it.fails("writes a bakery too large to print to a file", [hasOrders(60)], ({ story }) => {
	expect(story.engine.orders, "orders").toHaveLength(0);
});

mill.it.fails("splits the rerun command when a long test name would carry it past the width of a terminal", [], ({ story }) => {
	expect(story.engine.sacks, "sacks").toBe(1);
});

bakery.it("printed each story with its own failure only", [], () => {
	expect(reported).toEqual([
		[
			"loaves: expected 1 to be 2 // Object.is equality",
			"",
			...guide("bakery"),
			"  given  the oven is lit",
			"  given  the baker has 1 balls of dough",
			"         1m a loaf comes out of the oven",
			"✗        the test failed after the line above",
			`         at ${SPEC}:40:59`,
			"",
			"The bakery when the test failed:",
			'{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":1,"minute":1,"orders":[],"ovenLit":true,"overfired":false,',
			'"smoking":false,"starter":false}',
			"",
			rerun("Bakery Story: marks where an assertion stopped the story"),
		].join("\n"),
		[
			'the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3',
			"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait",
			"      in the bakery story kit if this bakery should be possible.",
			"",
			...guide("bakery"),
			"  given  the oven is lit",
			"✗ given  the baker has 4 balls of dough",
			`         refused at ${SPEC}:43:63`,
			"  given  the bakery has 1 bowls",
			"",
			"The bakery when the test failed:",
			'{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":true,"overfired":false,',
			'"smoking":false,"starter":false}',
			"",
			rerun("Bakery Story: marks the trait that refused"),
		].join("\n"),
		[
			"the bakery broke after 0 steps: the oven is cold with 1 balls of dough waiting",
			"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this",
			"      failure shows the setup and steps that led here.",
			"",
			...guide("bakery"),
			"  given  the baker has 1 balls of dough",
			"✗        the test failed after the line above",
			`         at ${SPEC}:46:14`,
			"",
			"The bakery when the test failed:",
			'{"bowls":1,"capacity":3,"dough":1,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":false,"overfired":false,',
			'"smoking":false,"starter":false}',
			"",
			rerun("Bakery Story: prints the story when the bakery breaks"),
		].join("\n"),
		[
			"wind: expected +0 to be 1 // Object.is equality",
			"",
			...guide("mill"),
			"  given  the sails are turning",
			"         the miller grinds 2 sacks",
			"✗        the test failed after the line above",
			`         at ${SPEC}:52:36`,
			"",
			'The mill when the test failed: {"sacks":2,"sails":"turning"}',
			"",
			rerun("Mill Story: prints what the kit's inspect shows"),
		].join("\n"),
		[
			"sacks: expected +0 to be 1 // Object.is equality",
			"",
			...guide("mill"),
			"✗        the test failed before the story told a line",
			`         at ${SPEC}:56:38`,
			"",
			'The mill when the test failed: {"sacks":0,"sails":"furled"}',
			"",
			rerun("Mill Story: marks a failure before the story told a line"),
		].join("\n"),
		[
			"orders: expected [ …(60) ] to have a length of +0 but got 60",
			"",
			...guide("bakery"),
			"  given  the bakery has 60 orders",
			"✗        the test failed after the line above",
			`         at ${SPEC}:60:40`,
			"",
			"The bakery when the test failed is 2954 characters of JSON, too long to print here. Read it in",
			LARGE_BAKERY,
			"",
			rerun("Bakery Story: writes a bakery too large to print to a file"),
		].join("\n"),
		[
			"sacks: expected +0 to be 1 // Object.is equality",
			"",
			...guide("mill"),
			"✗        the test failed before the story told a line",
			`         at ${SPEC}:64:38`,
			"",
			'The mill when the test failed: {"sacks":0,"sails":"furled"}',
			"",
			rerun("Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal"),
		].join("\n"),
	]);
});

bakery.it("wrote the bakery that was too large to print as JSON", [], () => {
	const written: unknown = JSON.parse(readFileSync(LARGE_BAKERY, "utf8"));

	expect(written).toEqual(expect.objectContaining({ orders: expect.arrayContaining(["order 60: a loaf of rye for the market stall"]) }));
});
