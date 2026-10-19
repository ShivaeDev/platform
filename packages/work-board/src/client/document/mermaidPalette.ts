export type Token = `--${string}`;

export type Palette = ReadonlyArray<readonly [Token, readonly string[]]>;

// Mermaid derives every colour it is not given from its own palette, which brings yellow notes and amber-tinted fills, so each one is pinned to a neutral Board token.
export const mermaidPalette: Palette = [
	["--background", ["background", "edgeLabelBackground", "labelBackgroundColor", "relationLabelBackground", "sequenceNumberColor"]],
	[
		"--card",
		["tertiaryColor", "clusterBkg", "noteBkgColor", "compositeBackground", "errorBkgColor", "faceColor", "rowOdd", "attributeBackgroundColorOdd"],
	],
	[
		"--foreground",
		[
			"primaryTextColor",
			"secondaryTextColor",
			"tertiaryTextColor",
			"textColor",
			"titleColor",
			"nodeTextColor",
			"noteTextColor",
			"actorTextColor",
			"labelTextColor",
			"loopTextColor",
			"signalTextColor",
			"stateLabelColor",
			"transitionLabelColor",
			"classText",
			"relationLabelColor",
			"requirementTextColor",
			"errorTextColor",
		],
	],
	[
		"--input",
		[
			"primaryBorderColor",
			"secondaryBorderColor",
			"tertiaryBorderColor",
			"nodeBorder",
			"noteBorderColor",
			"actorBorder",
			"labelBoxBorderColor",
			"activationBorderColor",
			"compositeBorder",
			"personBorder",
			"requirementBorderColor",
		],
	],
	["--border", ["clusterBorder"]],
	["--muted", ["secondaryColor", "activationBkgColor", "altBackground", "rowEven", "attributeBackgroundColorEven"]],
	[
		"--muted-foreground",
		["lineColor", "arrowheadColor", "defaultLinkColor", "signalColor", "actorLineColor", "transitionColor", "specialStateColor", "relationColor"],
	],
	[
		"--secondary",
		[
			"primaryColor",
			"mainBkg",
			"nodeBkg",
			"actorBkg",
			"stateBkg",
			"labelBoxBkgColor",
			"compositeTitleBackground",
			"personBkg",
			"requirementBackground",
		],
	],
];
