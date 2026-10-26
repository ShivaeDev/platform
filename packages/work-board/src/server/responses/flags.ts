import { BadRequest } from "@shivaedev/effect-contract/errors/taxonomy.ts";
export function flags(args: readonly string[]) {
	const values = new Map<string, string>();
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index];
		const value = args[index + 1];
		if (!(name && value && ["--port", "--url", "--revision", "--after"].includes(name))) {
			throw new BadRequest({ message: "Use --port, --url, --revision or --after, each with a value." });
		}
		if (values.has(name)) {
			throw new BadRequest({ message: `Repeated option ${name}. Supply each option once.` });
		}
		values.set(name, value);
	}
	const port = values.get("--port") ?? "4747";
	if (/^\d{1,5}$/u.exec(port) === null || Number(port) > 65_535 || Number(port) < 1) {
		throw new BadRequest({ message: "Invalid port. Use an integer from 1 to 65535." });
	}
	if (values.has("--url") && values.has("--port")) {
		throw new BadRequest({ message: "Choose --url or --port." });
	}
	return { after: values.get("--after"), revision: values.get("--revision"), url: values.get("--url") ?? `http://127.0.0.1:${port}` };
}
