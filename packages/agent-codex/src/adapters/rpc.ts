export interface RpcNotification {
	readonly method: string;
	readonly params: unknown;
}

export interface RpcServerRequest extends RpcNotification {
	readonly id: number | string;
}
