import type { Layer } from "effect";
import type { AnyModule } from "@shivaedev/contract/moduleHandlers.ts";
import type { AppModule } from "#AppModule.ts";
import type { hostHttpServices } from "#adapters/hostHttpServices.ts";
import type { appDatabase } from "#appDatabase.ts";

export interface OperationServicesNotProvided<TModule extends string, TOperation extends PropertyKey, TMissing> {
	readonly missingServices: TMissing;
	readonly module: TModule;
	readonly operation: TOperation;
	readonly problem: "run or readPolicy uses services that no registration's services, ports or requestServices provide and the host does not provide";
}

type HostServices = Layer.Success<ReturnType<typeof appDatabase<never, never>>> | Layer.Success<typeof hostHttpServices>;
type Field<TModule, TKey extends PropertyKey> = TModule extends unknown ? (TKey extends keyof TModule ? TModule[TKey] : never) : never;
type Provided<TModules extends readonly AppModule[]> =
	| Layer.Success<Extract<Field<TModules[number], "services" | "ports" | "requestServices">, Layer.Any>>
	| HostServices;
type Unprovided<TDefined extends AnyModule, TProvided> = {
	readonly [TOperation in keyof TDefined["~requires"]]: [Exclude<TDefined["~requires"][TOperation], TProvided>] extends [never]
		? never
		: OperationServicesNotProvided<TDefined["declaration"]["name"], TOperation, Exclude<TDefined["~requires"][TOperation], TProvided>>;
}[keyof TDefined["~requires"]];
// Rebuilding each problem drops the Unprovided alias, so the compiler's message shows the problem itself.
type Shown<TProblem> =
	TProblem extends OperationServicesNotProvided<infer TName, infer TOperation, infer TMissing>
		? OperationServicesNotProvided<TName, TOperation, TMissing>
		: never;
type ModuleProblems<TModule, TProvided> = TModule extends { readonly module: infer TDefined extends AnyModule }
	? Shown<Unprovided<TDefined, TProvided>>
	: never;

// Replacements stay out: they override ports, and a generic replacements Layer would defer the check until it refused every list.
export type ProvidedModules<TModules extends readonly AppModule[]> = number extends TModules["length"]
	? unknown
	: [ModuleProblems<TModules[number], Provided<TModules>>] extends [never]
		? unknown
		: ModuleProblems<TModules[number], Provided<TModules>>;
