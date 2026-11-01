const SURFACES = ["background", "card", "popover", "muted", "secondary", "accent", "input/0.3"];

export function textPairs(theme: "light" | "dark"): readonly (readonly [string, string])[] {
	const destructive = theme === "dark" ? "destructive/0.6" : "destructive";
	return [
		["foreground", "background"],
		["card-foreground", "card"],
		["popover-foreground", "popover"],
		["primary-foreground", "primary"],
		["primary-foreground", "primary/0.9"],
		["secondary-foreground", "secondary"],
		["accent-foreground", "accent"],
		["background", "foreground"],
		["foreground/0.6", "muted"],
		["#ffffff", destructive],
		["#ffffff", "destructive/0.9"],
		["code-added", "code-added/0.1 over muted/0.3"],
		["destructive", "destructive/0.1 over muted/0.3"],
		...SURFACES.flatMap((surface): (readonly [string, string])[] => [
			["foreground", surface],
			["muted-foreground", surface],
			["destructive", surface],
			["code-added", surface],
			["primary-foreground", `primary/0.9 over ${surface}`],
			["#ffffff", `${destructive} over ${surface}`],
			["#ffffff", `destructive/0.9 over ${surface}`],
		]),
	];
}

export function focusPairs(): readonly (readonly [string, string])[] {
	return SURFACES.flatMap((surface): (readonly [string, string])[] => [
		["ring", surface],
		["ring/0.5", surface],
	]);
}
