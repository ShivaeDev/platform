import { type ServiceConfigInput, service } from "railway/iac";

export function workerService(name: string, config: ServiceConfigInput) {
	return service(name, {
		...config,
		deploy: { drainingSeconds: 75, ...config.deploy },
	});
}
