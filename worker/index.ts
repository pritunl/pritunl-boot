import * as Types from "./types"
import * as Validation from "./validation"
import * as Utils from "./utils"
import * as System from "./system"
export { Boot } from "./database"

export default {
	async fetch(request: Request, env: Types.Env): Promise<Response> {
		const url = new URL(request.url)

		switch (url.pathname) {
			case "/register":
				return postRegister(request, env)
			default:
				if (url.pathname.endsWith(".ipxe") &&
						request.method == "GET") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\.ipxe$/)
					if (match && match[1]) {
						return getIpxe(request, env, match[1])
					}
				} else if (url.pathname.endsWith(".ks") &&
						request.method == "GET") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\.ks$/)
					if (match && match[1]) {
						return getKs(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/system") &&
					request.method == "POST") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/system$/)
					if (match && match[1]) {
						return postSystem(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/system") &&
					request.method == "GET") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/system$/)
					if (match && match[1]) {
						return getSystem(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/install") &&
					request.method == "POST") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/install$/)
					if (match && match[1]) {
						return postInstall(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/data") &&
					request.method == "GET") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/data$/)
					if (match && match[1]) {
						return getData(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/disks") &&
					request.method == "GET") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/disks$/)
					if (match && match[1]) {
						return getDisks(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/network") &&
					request.method == "GET") {

					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/network$/)
					if (match && match[1]) {
						return getNetwork(request, env, match[1])
					}
				}

				return new Response(null, {status: 404})
		}
	},
} satisfies ExportedHandler<Types.Env>

async function postRegister(request: Request,
	env: Types.Env): Promise<Response> {

	let payload = await request.json() as Types.Configuration
	let data: Types.Configuration

	try {
		data = Validation.validateConfiguration(payload)
	} catch (error) {
		if (error instanceof Types.ValidationError) {
			return Response.json({error: error.message}, {status: 400})
		} else {
			throw error
		}
	}

	if (data.long_url_key) {
		data.id = Utils.generateId(20)
	} else {
		data.id = Utils.generateId(10)
	}

	const objId = env.BOOT.idFromName(data.id)
	const db = env.BOOT.get(objId)
	await db.ttl()
	await db.set("data", data)

	return Response.json({
		id: data.id,
	})
}

async function getData(_request: Request,
	env: Types.Env, id: string): Promise<Response> {

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const data = await db.get("data") as Types.Configuration
	if (!data) {
		return new Response(null, {status: 404})
	}

	const ipxeConf = System.generateIpxe(data)
	return Response.json({
		...data,
		ipxe: ipxeConf,
	})
}

async function getDisks(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const data = await db.get("data") as Types.Configuration
	if (!data || !data.disks?.length) {
		return new Response(null, {status: 202})
	}

	const rootSize = Utils.parseRootSize(data.root_size)

	return new Response(
		 `${data.raid}:${rootSize}:` + data.disks.join(","),
		{headers: {"Content-Type": "text/plain"},
	})
}

async function getNetwork(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const data = await db.get("data") as Types.Configuration
	if (!data || !data.interfaces?.length) {
		return new Response(null, {status: 202})
	}

	const networkConf = System.generateKickstartNetwork(data, false)

	let networkData = Utils.encodeBase64(networkConf)
	return new Response(
		networkData,
		{headers: {"Content-Type": "text/plain"},
	})
}

async function getIpxe(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const data = await db.get("data") as Types.Configuration
	if (!data) {
		return new Response(null, {status: 404})
	}

	const ksConfig = System.generateIpxe(data)
	return new Response(
		ksConfig,
		{headers: {"Content-Type": "text/plain"},
	})
}

async function getKs(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const data = await db.get("data") as Types.Configuration
	if (!data) {
		return new Response(null, {status: 404})
	}

	let ksConfig: string
	if (data.mode === "live") {
		ksConfig = System.generateKickstartLive(data)
	} else {
		ksConfig = System.generateKickstart(data)
	}

	return new Response(
		ksConfig,
		{headers: {"Content-Type": "text/plain"},
	})
}

async function getSystem(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const data = await db.get("system") as Types.System
	if (!data) {
		return Response.json({
			ready: false,
		})
	}

	return Response.json({
		...data,
		ready: true,
	})
}

async function postInstall(request: Request,
	env: Types.Env, id: string): Promise<Response> {

	let payload = await request.json() as Types.Configuration
	let data: Types.Configuration

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const register = await db.get("data") as Types.Configuration
	if (!register) {
		return new Response(null, {status: 404})
	}

	register.network_mode = payload.network_mode
	register.bonded_network = payload.bonded_network
	register.public_ip = payload.public_ip
	register.gateway_ip = payload.gateway_ip
	register.public_ip6 = payload.public_ip6
	register.gateway_ip6 = payload.gateway_ip6
	register.vlan = payload.vlan
	register.vlan6 = payload.vlan6
	register.mtu = payload.mtu
	register.root_size = payload.root_size
	register.raid = payload.raid
	register.disks = payload.disks
	register.interfaces = payload.interfaces

	try {
		data = Validation.validateConfiguration(register, true)
	} catch (error) {
		if (error instanceof Types.ValidationError) {
			return Response.json({error: error.message}, {status: 400})
		} else {
			throw error
		}
	}

	data.id = register.id
	await db.set("data", data)

	return Response.json({
		id: data.id,
	})
}

async function postSystem(request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const formData = await request.formData()

	const data: Record<string, string> = {}
	for (const [key, value] of formData.entries()) {
		data[key] = value.toString()
	}

	const disks: Types.Disk[] = []
	const diskIndices = new Set<number>()

	Object.keys(data).forEach(key => {
		const diskMatch = key.match(/^disk(\d+)\./)
		if (diskMatch) {
			diskIndices.add(parseInt(diskMatch[1]))
		}
	})

	for (const index of Array.from(diskIndices).sort((a, b) => a - b)) {
		const disk: Types.Disk = {
			name: Utils.basename(data[`disk${index}.path`] || ""),
			path: data[`disk${index}.path`] || "",
			size: parseInt(data[`disk${index}.size`] || "0"),
			model: data[`disk${index}.model`] || "",
			serial: data[`disk${index}.serial`] || "",
		}
		disks.push(disk)
	}

	const interfaces: Types.Interface[] = []
	const netIndices = new Set<number>()

	Object.keys(data).forEach(key => {
		const netMatch = key.match(/^net(\d+)\./)
		if (netMatch) {
			netIndices.add(parseInt(netMatch[1]))
		}
	})

	for (const index of Array.from(netIndices).sort((a, b) => a - b)) {
		const iface: Types.Interface = {
			mac: data[`net${index}.mac`] || "",
			ip: data[`net${index}.ip`] || "",
			model: data[`net${index}.model`] || "",
		}
		interfaces.push(iface)
	}

	let system: Types.System = {
		id: id,
		disks: disks,
		interfaces: interfaces,
	}

	try {
		system = Validation.validateSystem(system)
	} catch (error) {
		if (error instanceof Types.ValidationError) {
			return Response.json({error: error.message}, {status: 400})
		} else {
			throw error
		}
	}

	const objId = env.BOOT.idFromName(id)
	const db = env.BOOT.get(objId)
	const register = await db.get("data") as Types.Configuration
	if (!register) {
		return new Response(null, {status: 404})
	}

	await db.set("system", system)

	return new Response(null, {status: 200})
}
