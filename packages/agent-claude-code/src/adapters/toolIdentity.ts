import { TOOL_SERVER_NAME } from "#adapters/makeToolServer.ts";
export function toolIdentity(wireName: string): {
	name: string;
	providerName?: string;
} {
	const match = /^mcp__(?<server>.+?)__(?<tool>.+)$/u.exec(wireName);
	const server = match?.groups?.server;
	const tool = match?.groups?.tool;
	return server === undefined || tool === undefined
		? { name: wireName }
		: { name: server === TOOL_SERVER_NAME ? tool : `${server}: ${tool}`, providerName: wireName };
}
