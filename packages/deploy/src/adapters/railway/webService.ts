import { type ServiceConfigInput, service } from "railway/iac";

export function webService(name: string, config: ServiceConfigInput) {
	return service(name, {
		...config,
		deploy: { preDeployCommand: ["pnpm migrate"], ...config.deploy },
		env: {
			"AUTH_CLIENT_IP_HEADER": "x-real-ip",
			"TRUSTED_PROXY": "100.64.0.0/10",
			...config.variables,
			...config.env,
		},
	});
}
