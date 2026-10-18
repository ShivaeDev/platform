import { Mermaid } from "#client/document/Mermaid.ts";
import { ThemeContext } from "#client/react/ThemeContext.ts";
import { useAppearance } from "#client/react/useAppearance.ts";
export function MermaidAppearance() {
	const appearance = useAppearance();
	return (
		<ThemeContext.Provider value={appearance.scheme}>
			<button onClick={() => appearance.change({ theme: "dark" })} type="button">
				Dark
			</button>
			<Mermaid source="graph TD; Theme-->Drawing" />
		</ThemeContext.Provider>
	);
}
