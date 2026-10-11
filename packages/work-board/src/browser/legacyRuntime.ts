export interface RouterBridge {
	readonly navigate: (url: string) => Promise<void>;
	readonly subscribe: (listener: () => void) => void;
}
export async function legacyRuntime(): Promise<{ readonly connectRouter: (router: RouterBridge) => void }> {
	const client = "/_board/client.js";
	const navigation = "/_board/navigation.js";
	await import(client);
	return import(navigation);
}
