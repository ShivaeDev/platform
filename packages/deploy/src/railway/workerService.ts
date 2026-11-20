import { type ReferencableDatabaseNode, type ServiceConfigInput, service } from "railway/iac";

export function workerService(name: string, config: ServiceConfigInput, database?: ReferencableDatabaseNode<"postgres">) {
	return service(name, {
		...config,
		deploy: { drainingSeconds: 75, ...config.deploy },
		env: {
			...(database && { "DATABASE_URL": database.env.DATABASE_URL }),
			...config.variables,
			...config.env,
		},
	});
}
