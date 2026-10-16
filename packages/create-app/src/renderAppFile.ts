export function appDatabase(name: string) {
	return name
		.replaceAll(/[.-]/gu, "_")
		.replace(/^[^a-z]/u, "app_$&")
		.slice(0, 58);
}

export function renderAppFile(content: string, name: string) {
	const database = appDatabase(name);
	const identifier = database.replaceAll("_", "").slice(0, 48);
	return content
		.replaceAll(/starter_|starter|Starter/gu, (token) => {
			if (token === "starter_") {
				return `${database.slice(0, 48)}_`;
			}
			return token === "Starter" ? identifier.charAt(0).toUpperCase() + identifier.slice(1) : identifier;
		})
		.replaceAll("__APP_NAME__", name)
		.replaceAll("__APP_DATABASE__", database);
}
