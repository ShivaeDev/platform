import { adapterImports } from "#rules/effect/adapterImports.ts";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { contextCapture } from "#rules/effect/contextCapture.ts";
import { failureHonesty } from "#rules/effect/failureHonesty.ts";
import { rpcBoundary } from "#rules/effect/rpcBoundary.ts";
import { serviceDefinitionAssembly } from "#rules/effect/serviceDefinitionAssembly.ts";
import { serviceFolders } from "#rules/effect/serviceFolders.ts";
import { serviceIds } from "#rules/effect/serviceIds.ts";
import { serviceModel } from "#rules/effect/serviceModel.ts";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { sharedErrorClasses } from "#rules/effect/sharedErrorClasses.ts";
import { sqlTransact } from "#rules/effect/sqlTransact.ts";

export const effectPolicy = [
	adapterImports,
	effectBoundary,
	contextCapture,
	failureHonesty,
	rpcBoundary,
	serviceDefinitionAssembly,
	serviceFolders,
	serviceIds,
	serviceModel,
	serviceParameters,
	sharedErrorClasses,
	sqlTransact,
] as const;
