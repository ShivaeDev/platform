import { Effect } from "effect";

export function statusChipVerbs(tell: (line: string) => void) {
	function reads<T>(line: string, read: () => T) {
		return Effect.sync(() => {
			tell(line);
			return read();
		});
	}
	return {
		indexingBar: () =>
			reads("the reader reads the indexing progress bar", () => {
				const bar = document.querySelector<HTMLElement>('[data-indexing][role="progressbar"]');
				if (!bar) {
					return "none";
				}
				const value = bar.getAttribute("aria-valuenow");
				return {
					label: bar.querySelector('[data-slot="progress-label"]')?.textContent,
					value: value === null ? "unknown" : Number(value),
				};
			}),
		statusChips: () =>
			reads("the reader reads each status chip", () =>
				[...document.querySelectorAll<HTMLElement>("[data-status-token]")].map((chip) => ({
					icon: [...(chip.querySelector("svg[aria-hidden='true']")?.classList ?? [])]
						.filter((name) => name.startsWith("lucide-"))
						.map((name) => name.slice("lucide-".length)),
					label: chip.textContent,
					token: chip.dataset.statusToken,
					variant: chip.dataset.variant,
				})),
			),
	};
}
