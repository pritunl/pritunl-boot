import * as Types from "./types"
import * as Validation from "./validation"
import * as Utils from "./utils"
export { Boot } from "./database"

export default {
	async fetch(request: Request, env: Types.Env): Promise<Response> {
		const url = new URL(request.url)

		switch (url.pathname) {
			case "/register":
				return postRegister(request, env)
			default:
				if (url.pathname.endsWith(".ipxe")) {
					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\.ipxe$/)
					if (match && match[1]) {
						return getIpxe(request, env, match[1])
					}
				} else if (url.pathname.endsWith(".ks")) {
					const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\.ks$/)
					if (match && match[1]) {
						return getKs(request, env, match[1])
					}
				} else if (url.pathname.endsWith("/system")) {
						const match = url.pathname.match(/^\/([a-zA-Z0-9]+)\/system$/)
						if (match && match[1]) {
								return postSystem(request, env, match[1])
						}
				}

				return new Response(null, {status: 404})
		}
	},
} satisfies ExportedHandler<Types.Env>

async function postRegister(request: Request,
	env: Types.Env): Promise<Response> {

	let payload = await request.json() as Types.Register
	let data: Types.Register

	try {
		data = Validation.validatePayload(payload)
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

	const db = env.BOOT.getByName(data.id)
	await db.ttl()
	await db.set("data", data)

	return Response.json({
		id: data.id,
	})
}

async function getIpxe(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const db = env.BOOT.getByName(id)
	const data = await db.get("data") as Types.Register

	if (!data) {
		return new Response(null, {status: 404})
	}

	const ksConfig = Utils.generateIpxe(data)
	return new Response(
		ksConfig,
		{headers: {"Content-Type": "text/plain"},
	})
}

async function getKs(_request: Request, env: Types.Env,
	id: string): Promise<Response> {

	const db = env.BOOT.getByName(id)
	const data = await db.get("data") as Types.Register

	if (!data) {
		return new Response(null, {status: 404})
	}

	const ksConfig = Utils.generateKickstart(data)
	return new Response(
		ksConfig,
		{headers: {"Content-Type": "text/plain"},
	})
}
