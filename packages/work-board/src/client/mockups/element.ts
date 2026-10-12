export function element<E extends Element>(selector: string, kind: new () => E): E {
	const found = document.querySelector(selector);
	if (!(found instanceof kind)) {
		throw new Error(`Missing prototype element: ${selector}`);
	}
	return found;
}
