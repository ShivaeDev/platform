const AMBER_HUES = { from: 45, to: 100 };
const NEUTRAL_CHROMA = 0.02;

function parse(color: unknown) {
	const match = typeof color === "string" ? /^oklch\((?<lightness>[\d.]+) (?<chroma>[\d.]+) (?<hue>[\d.]+)\)$/u.exec(color) : null;
	return match?.groups
		? { chroma: Number(match.groups.chroma), hue: Number(match.groups.hue), lightness: Number(match.groups.lightness) }
		: undefined;
}

function clamp(channel: number) {
	return Math.min(1, Math.max(0, channel));
}

function luminance(color: unknown) {
	const parsed = parse(color);
	if (!parsed) {
		return undefined;
	}
	const a = parsed.chroma * Math.cos((parsed.hue * Math.PI) / 180);
	const b = parsed.chroma * Math.sin((parsed.hue * Math.PI) / 180);
	const l = (parsed.lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
	const m = (parsed.lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
	const s = (parsed.lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
	const red = clamp(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s);
	const green = clamp(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s);
	const blue = clamp(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrast(text: unknown, fill: unknown) {
	const [first, second] = [luminance(text), luminance(fill)];
	if (first === undefined || second === undefined) {
		return 0;
	}
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function isAmber(color: unknown) {
	const parsed = parse(color);
	return parsed !== undefined && parsed.chroma > NEUTRAL_CHROMA && parsed.hue >= AMBER_HUES.from && parsed.hue <= AMBER_HUES.to;
}
