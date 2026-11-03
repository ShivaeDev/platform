import { Config } from "effect";

export type DockerEnvironment = Readonly<{ "DOCKER_CONTEXT"?: string | undefined; "DOCKER_HOST"?: string | undefined }>;

export const dockerEnvironment = Config.all({
	"DOCKER_CONTEXT": Config.String("DOCKER_CONTEXT").pipe(Config.withDefault("")),
	"DOCKER_HOST": Config.String("DOCKER_HOST").pipe(Config.withDefault("")),
});
