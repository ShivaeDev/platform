import { Context, Data } from "effect";

export class RuntimeValue extends Context.Service<RuntimeValue, string>()("@test/RuntimeValue") {}
export class RuntimeOnlyValue extends Context.Service<RuntimeOnlyValue, string>()("@test/RuntimeOnlyValue") {}
export class RequestValue extends Context.Service<RequestValue, string>()("@test/RequestValue") {}
export class ExtendedRequestValue extends Context.Service<ExtendedRequestValue, string>()("@test/ExtendedRequestValue") {}
export class AuthenticatedActor extends Context.Service<AuthenticatedActor, string>()("@test/AuthenticatedActor") {}
export class Dependency extends Context.Service<Dependency, string>()("@test/SubscriptionDependency") {}
export class DomainFailure extends Data.TaggedError("DomainFailure")<{ readonly message: string }> {}
