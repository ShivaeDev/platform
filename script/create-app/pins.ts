export function expectedVersion(local: string, published: string) {
	const left = local.split(".").map(Number);
	const right = published.split(".").map(Number);
	for (const index of [0, 1, 2]) {
		if (left[index] !== right[index]) {
			return (left[index] ?? 0) > (right[index] ?? 0) ? local : published;
		}
	}
	return published;
}

export async function checkPins(
	pins: Readonly<Record<string, string>>,
	local: Readonly<Record<string, string>>,
	latest: (name: string) => Promise<string>,
) {
	const stale = await Promise.all(
		Object.entries(pins).map(async ([name, pin]) => {
			const published = await latest(name);
			const expected = expectedVersion(local[name] ?? published, published);
			return pin === expected ? [] : [`${name}: pinned ${pin}, expected ${expected} (npm latest ${published})`];
		}),
	);
	const failures = stale.flat();
	if (failures.length > 0) {
		throw new Error(`Refresh examples/starter/published-versions.json before releasing create-app:\n${failures.join("\n")}`);
	}
}
