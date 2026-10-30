import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { groupedBuild, groupedMerge, longTitle } from "#test/flightItems.ts";
import { goalAnswer, goalsAnswered, onTerminal, paneColumns, pluginPane, workAnswered } from "#test/pluginPane.ts";

const shipTheBoard = goalAnswer("Ship the Board", { running: 2 });

for (const [name, surface] of [
	["desktop", []],
	["terminal", [onTerminal]],
] as const) {
	pluginPane.it(
		`on ${name}, one goal groups two tasks, each with its title and one shared worker/reviewer line`,
		[goalsAnswered(shipTheBoard), workAnswered(groupedBuild, groupedMerge), ...surface],
		function* ({ flightLines }) {
			expect(yield* flightLines()).toEqual([
				{
					goal: "Ship the Board",
					tasks: [
						["Build the pane", "worker · coding 2m   reviewer · not started yet"],
						["Merge the pane   #42", "worker · waiting for merge 24m   reviewer · approved 3m"],
					],
				},
			]);
		},
	);
}

pluginPane.it(
	"coding and waiting for merge use the existing Running and Scheduled colors while not started yet is muted",
	[goalsAnswered(shipTheBoard), workAnswered(groupedBuild, groupedMerge)],
	function* ({ lookOf }) {
		yield* outcomes({
			coding: [lookOf("coding"), "#2879da"],
			"not started yet": [lookOf("not started yet"), "dimmed"],
			"waiting for merge": [lookOf("waiting for merge"), "#ad7400"],
		});
	},
);

pluginPane.it(
	"a long title truncates to its indented task width and keeps both agents on the next line",
	[goalsAnswered(shipTheBoard), workAnswered(longTitle), paneColumns(40)],
	function* ({ flightLines }) {
		expect(yield* flightLines()).toEqual([
			{
				goal: "Ship the Board",
				tasks: [["Build the pane with a title that is l…", "worker · coding 2m   reviewer · not started yet"]],
			},
		]);
	},
);
