export function routeKey(method: string, path: string) {
	const parts = path.split("?")[0]?.split("/") ?? [];
	let major = "";
	if (parts[1] === "channels" || parts[1] === "guilds") {
		major = parts[2] ?? "";
	}
	if (parts[1] === "webhooks") {
		major = `${parts[2]}/${parts[3]}`;
	}
	const normalized = parts.map((part, index) => (/^\d+$/u.test(part) && index !== 2 ? ":id" : part));
	if (parts[1] === "channels" || parts[1] === "guilds" || parts[1] === "webhooks") {
		normalized[2] = ":major";
	}
	return { major, route: `${method} ${normalized.join("/")}` };
}
