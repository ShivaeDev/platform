import { contrast, isAmber } from "./oklch.ts";
import type { DiagramDrawing } from "./screenDiagrams.ts";

const AA_TEXT = 4.5;

const NEUTRAL_TOKENS = [
	"--background",
	"--foreground",
	"--card",
	"--secondary",
	"--muted",
	"--muted-foreground",
	"--border",
	"--input",
	"--destructive",
];

const LABELS_ON_FILLS = [
	["nodeTextColor", "mainBkg"],
	["titleColor", "clusterBkg"],
	["textColor", "edgeLabelBackground"],
	["noteTextColor", "noteBkgColor"],
	["actorTextColor", "actorBkg"],
	["labelTextColor", "labelBoxBkgColor"],
	["signalTextColor", "background"],
	["stateLabelColor", "stateBkg"],
	["transitionLabelColor", "labelBackgroundColor"],
	["classText", "mainBkg"],
	["relationLabelColor", "relationLabelBackground"],
	["taskTextColor", "taskBkgColor"],
	["taskTextDarkColor", "doneTaskBkgColor"],
	["taskTextDarkColor", "activeTaskBkgColor"],
	["taskTextDarkColor", "critBkgColor"],
	["pieSectionTextColor", "pie1"],
	["pieSectionTextColor", "pie2"],
	["pieSectionTextColor", "pie3"],
	["pieSectionTextColor", "pie4"],
	["pieSectionTextColor", "pie5"],
	["cScaleLabel0", "cScale0"],
	["gitBranchLabel0", "git0"],
	["quadrant1TextFill", "quadrant1Fill"],
	["quadrant2TextFill", "quadrant2Fill"],
] as const;

const COLOR_KEYS = [
	...new Set([
		...LABELS_ON_FILLS.flat(),
		"lineColor",
		"clusterBorder",
		"nodeBorder",
		"noteBorderColor",
		"actorLineColor",
		"secondaryColor",
		"tertiaryColor",
	]),
];

function tokenValues(names: readonly string[]): ReadonlySet<string> {
	const style = getComputedStyle(document.documentElement);
	return new Set(names.map((name) => style.getPropertyValue(name).trim()).filter((value) => value !== ""));
}

export function diagramPalette({ colors, dark }: DiagramDrawing) {
	const board = tokenValues(NEUTRAL_TOKENS);
	return {
		amber: COLOR_KEYS.filter((key) => isAmber(colors[key])),
		dark,
		effects: { dropShadow: colors.dropShadow, useGradient: colors.useGradient },
		offBoard: COLOR_KEYS.filter((key) => !board.has(String(colors[key]))),
		unreadable: LABELS_ON_FILLS.filter(([label, fill]) => contrast(colors[label], colors[fill]) < AA_TEXT).map(
			([label, fill]) => `${label} on ${fill}`,
		),
	};
}
