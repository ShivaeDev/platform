import type { HttpStaticServer } from "effect/http";

export type AssetOptions = Omit<Parameters<typeof HttpStaticServer.layer>[0], "cacheControl"> & {
	readonly cacheControl?: string | ((pathname: string) => string | undefined) | undefined;
	readonly documentHeaders?: {
		readonly frameAncestors?: string | false;
		readonly xFrameOptions?: "DENY" | "SAMEORIGIN" | false;
	};
};
