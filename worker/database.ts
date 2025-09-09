import { DurableObject } from "cloudflare:workers"
import * as Types from "./types"

export class Boot extends DurableObject<Types.Env> {
	constructor(ctx: DurableObjectState, env: Types.Env) {
		super(ctx, env)
	}

	async get(key: string) {
		return await this.ctx.storage.get(key)
	}

	async set(key: string, value: any) {
		await this.ctx.storage.put(key, value)
		return true
	}

	async ttl(hours = 2) {
		const expirationTime = Date.now() + (hours * 60 * 60 * 1000)
		await this.ctx.storage.setAlarm(expirationTime)
		return true
	}

	async ttlSec(seconds = 30) {
		const expirationTime = Date.now() + (seconds * 1000)
		await this.ctx.storage.setAlarm(expirationTime)
		return true
	}

	async alarm() {
		await this.ctx.storage.deleteAll()
	}
}
