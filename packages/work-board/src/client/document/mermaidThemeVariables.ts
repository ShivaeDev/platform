import { mermaidChartPalette } from "./mermaidChartPalette.ts";
import { mermaidPalette, type Token } from "./mermaidPalette.ts";

const SLICE_TOKENS: readonly Token[] = ["--input", "--card", "--secondary", "--border", "--muted"];

const PIE_TOKENS: readonly Token[] = [...SLICE_TOKENS, ...SLICE_TOKENS, ...SLICE_TOKENS].slice(0, 12);

export function mermaidThemeVariables(dark: boolean, fontFamily: string, color: (token: Token) => string) {
	const resolved = new Map<Token, string>();
	function token(name: Token) {
		const value = resolved.get(name) ?? color(name);
		resolved.set(name, value);
		return value;
	}
	const colors = [...mermaidPalette, ...mermaidChartPalette].flatMap(([name, keys]) => keys.map((key) => [key, token(name)] as const));
	const pie = PIE_TOKENS.map((name, index) => [`pie${index + 1}`, token(name)] as const);
	return {
		...Object.fromEntries([...colors, ...pie]),
		darkMode: dark,
		dropShadow: "none",
		fontFamily,
		pieOpacity: "1",
		useGradient: false,
		xyChart: {
			backgroundColor: token("--background"),
			dataLabelColor: token("--foreground"),
			legendTextColor: token("--foreground"),
			plotColorPalette: [token("--muted-foreground"), token("--input")].join(","),
			titleColor: token("--foreground"),
			xAxisLabelColor: token("--foreground"),
			xAxisLineColor: token("--muted-foreground"),
			xAxisTickColor: token("--muted-foreground"),
			xAxisTitleColor: token("--foreground"),
			yAxisLabelColor: token("--foreground"),
			yAxisLineColor: token("--muted-foreground"),
			yAxisTickColor: token("--muted-foreground"),
			yAxisTitleColor: token("--foreground"),
		},
	};
}
