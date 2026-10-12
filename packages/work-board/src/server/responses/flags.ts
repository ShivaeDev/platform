export function flags(args: readonly string[]) {
	const values = new Map<string, string>();
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index];
		const value = args[index + 1];
		if (!(name && value && ["--port", "--url", "--revision", "--after"].includes(name))) {
			throw new Error("Use --port, --url, --revision or --after, each with a value.");
		}
		if (values.has(name)) {
			throw new Error(`Repeated option ${name}`);
		}
		values.set(name, value);
	}
	const port = values.get("--port") ?? "4747";
	if (/^\d{1,5}$/u.exec(port) === null || Number(port) > 65_535 || Number(port) < 1) {
		throw new Error("Invalid port.");
	}
	if (values.has("--url") && values.has("--port")) {
		throw new Error("Choose --url or --port.");
	}
	return { after: values.get("--after"), revision: values.get("--revision"), url: values.get("--url") ?? `http://127.0.0.1:${port}` };
}
