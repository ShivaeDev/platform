export function mermaidColor(name: string): string {
	const style = getComputedStyle(document.documentElement);
	const color = style.getPropertyValue(name).trim();
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext("2d");
	if (!context) {
		return color;
	}
	context.fillStyle = style.getPropertyValue("--bg").trim();
	context.fillRect(0, 0, 1, 1);
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	return `#${Array.from(context.getImageData(0, 0, 1, 1).data)
		.slice(0, 3)
		.map((channel) => channel.toString(16).padStart(2, "0"))
		.join("")}`;
}
