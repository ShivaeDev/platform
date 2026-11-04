export const CALLER_SESSION = "callerSession";
export const CALLER_CALL = "callerCall";
export const CONSTRAINED_AGENT = "platform";
export const TOOL_SERVER_NAME = "platform";
export function wireName(name: string): string {
	return `${TOOL_SERVER_NAME}_${name}`;
}
