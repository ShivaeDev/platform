import { RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";
import { FleetContract } from "#operations.ts";

export const DaemonContract = FleetContract.middleware(RequestTracing);
export const RPC_PATH = "/_fleet/rpc";
