import { colorContrast } from "./colorContrast.ts";
import { nearestLightness } from "./nearestLightness.ts";
import { themeColor, withThemeColor } from "./themeColor.ts";

export function contrastGuidance(css: string, theme: "light" | "dark", foreground: string, background: string, minimum: number) {
	const ratio = colorContrast(css, theme, foreground, background);
	const pair = `${theme}: ${foreground} on ${background}: ${ratio.toFixed(2)}:1 (requires ${minimum}:1)`;
	if (ratio >= minimum) {
		return { message: pair, ratio, suggestion: undefined };
	}
	const [name = "", opacity] = foreground.split("/");
	const color = themeColor(css, theme, name);
	const suggestion = nearestLightness(
		color,
		(candidate) =>
			(name.startsWith("#")
				? colorContrast(css, theme, opacity === undefined ? candidate : `${candidate}/${opacity}`, background)
				: colorContrast(withThemeColor(css, theme, name, candidate), theme, foreground, background)) >= minimum,
	);
	const advice =
		suggestion === undefined
			? `no lightness of ${name} can pass with this opacity and background`
			: `nearest passing HSL lightness for ${name}: ${suggestion.lightness.toFixed(2)}% (${suggestion.color}), preserving hue and saturation (0.01% search steps)`;
	return { message: `${pair}; ${advice}`, ratio, suggestion };
}
