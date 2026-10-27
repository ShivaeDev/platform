function channels(color: string) {
	return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
}

function lightness(color: string) {
	const rgb = channels(color);
	return (Math.max(...rgb) + Math.min(...rgb)) / 2;
}

export function nearestLightness(color: string, passes: (candidate: string) => boolean) {
	const rgb = channels(color);
	const low = Math.min(...rgb);
	const high = Math.max(...rgb);
	const current = (low + high) / 2;
	const chroma = high - low;
	const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * current - 1));
	let nearest: { color: string; lightness: number } | undefined;
	let distance = Number.POSITIVE_INFINITY;
	for (let step = 0; step <= 10_000; step += 1) {
		const target = step / 10_000;
		const nextChroma = (1 - Math.abs(2 * target - 1)) * saturation;
		const minimum = target - nextChroma / 2;
		const candidate = `#${rgb
			.map((channel) =>
				Math.round((chroma === 0 ? target : minimum + ((channel - low) / chroma) * nextChroma) * 255)
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")}`;
		const next = lightness(candidate);
		if (Math.abs(next - current) < distance && passes(candidate)) {
			nearest = { color: candidate, lightness: next * 100 };
			distance = Math.abs(next - current);
		}
	}
	return nearest;
}
