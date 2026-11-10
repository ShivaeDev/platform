export interface OpencodeRequest {
	readonly body: unknown;
	readonly path: string;
	readonly query: Readonly<Record<string, string>>;
}
