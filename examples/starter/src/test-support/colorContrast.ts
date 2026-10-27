import { themeColor } from "./themeColor.ts";

type Color = readonly [number, number, number];

function hex(value: string): Color {
	if (!/^#[0-9a-f]{6}$/iu.test(value)) {
		throw new Error(`Unsupported contrast color: ${value}`);
	}
	function channel(offset: number) {
		return Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
	}
	return [channel(1), channel(3), channel(5)];
}

function blend(top: Color, bottom: Color, alpha: number): Color {
	return [top[0] * alpha + bottom[0] * (1 - alpha), top[1] * alpha + bottom[1] * (1 - alpha), top[2] * alpha + bottom[2] * (1 - alpha)];
}

function luminance(color: Color) {
	function linear(channel: number) {
		return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	}
	return 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
}

export function colorContrast(css: string, theme: "light" | "dark", foreground: string, background: string) {
	function resolve(expression: string): Color {
		const [layer = "", underneath] = expression.split(" over ");
		const [name = "", opacity] = layer.split("/");
		const literal = name.startsWith("#") ? hex(name) : token(name);
		return opacity === undefined ? literal : blend(literal, underneath === undefined ? token("background") : resolve(underneath), Number(opacity));
	}
	function token(tokenName: string): Color {
		return hex(themeColor(css, theme, tokenName));
	}
	const surface = resolve(background);
	const [name = "", opacity] = foreground.split("/");
	const ink = opacity === undefined ? resolve(name) : blend(resolve(name), surface, Number(opacity));
	const first = luminance(ink);
	const second = luminance(surface);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
