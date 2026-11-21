import type { Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { RpcClient } from "effect/rpc";
import type * as Socket from "effect/socket/Socket";
import type { ResumeSource, ResumeWindow } from "#resume.ts";

export interface ClientOptions {
	readonly bearerToken?: string;
	readonly headers?: Readonly<Record<string, string>>;
	readonly protocol?: Layer.Layer<RpcClient.Protocol> | ((identity: string | undefined) => Layer.Layer<RpcClient.Protocol>);
	readonly registry?: AtomRegistry.AtomRegistry;
	readonly resume?: ResumeSource;
	readonly resumeWindow?: ResumeWindow;
	readonly runtime?: Atom.RuntimeFactory;
	readonly url?: string;
	readonly webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>;
}
