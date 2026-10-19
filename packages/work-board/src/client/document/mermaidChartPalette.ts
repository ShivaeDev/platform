import type { Palette } from "./mermaidPalette.ts";

const COLOR_SLOTS = 12;
const GIT_SLOTS = 8;
const FILL_TYPES = 8;

function slots(prefix: string, count: number): readonly string[] {
	return Array.from({ length: count }, (_, index) => `${prefix}${index}`);
}

// Charts, timelines, mind maps and branch graphs would otherwise rotate hues off the primary colour, so they stay on the same neutral tokens.
export const mermaidChartPalette: Palette = [
	["--background", ["altSectionBkgColor", "pieStrokeColor", ...slots("gitInv", GIT_SLOTS), ...slots("gitBranchLabel", GIT_SLOTS)]],
	["--border", ["gridColor", "doneTaskBorderColor", "pieOuterStrokeColor", ...slots("cScalePeer", COLOR_SLOTS)]],
	["--card", ["activeTaskBkgColor", "sectionBkgColor2", "critBkgColor", "quadrant1Fill", "quadrant3Fill"]],
	["--destructive", ["critBorderColor"]],
	[
		"--foreground",
		[
			"taskTextColor",
			"taskTextLightColor",
			"taskTextDarkColor",
			"taskTextOutsideColor",
			"taskTextClickableColor",
			"todayLineColor",
			"pieTitleTextColor",
			"pieSectionTextColor",
			"pieLegendTextColor",
			"scaleLabelColor",
			"commitLabelColor",
			"tagLabelColor",
			"quadrant1TextFill",
			"quadrant2TextFill",
			"quadrant3TextFill",
			"quadrant4TextFill",
			"quadrantPointTextFill",
			"quadrantXAxisTextFill",
			"quadrantYAxisTextFill",
			"quadrantTitleFill",
			...slots("cScaleLabel", COLOR_SLOTS),
		],
	],
	[
		"--input",
		["taskBorderColor", "tagLabelBorder", "quadrantInternalBorderStrokeFill", "quadrantExternalBorderStrokeFill", ...slots("cScale", COLOR_SLOTS)],
	],
	["--muted", ["doneTaskBkgColor", "excludeBkgColor", "sectionBkgColor", "quadrant2Fill", "quadrant4Fill"]],
	[
		"--muted-foreground",
		["activeTaskBorderColor", "vertLineColor", "quadrantPointFill", ...slots("cScaleInv", COLOR_SLOTS), ...slots("git", GIT_SLOTS)],
	],
	["--secondary", ["taskBkgColor", "commitLabelBackground", "tagLabelBackground", ...slots("fillType", FILL_TYPES)]],
];
