import * as Database from "./database"

export interface Env {
	BOOT: DurableObjectNamespace<Database.Boot>
}

export interface Register {
	id: string
	mode: "live" | "static"
	provider: "none" | "latitude"
	network_mode: "static" | "dhcp"
	bonded_network: boolean
	public_ip: string
	gateway_ip: string
	public_ip6: string
	gateway_ip6: string
	vlan: number
	vlan6: number
	mtu: number
	interface?: string
	interface1?: string
	interface2?: string
	raid: number
	ssh_keys: string
	long_url_key: boolean
}

export interface System {
	id: string
	disks: Disk[]
	interfaces: Interface[]
}

export interface Disk {
	path: string
	size: number
	model: string
	serial: string
}

export interface Interface {
	mac: string
	ip: string
	model: string
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ValidationError"
	}
}
