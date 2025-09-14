import * as Database from "./database"

export interface Env {
	BOOT: DurableObjectNamespace<Database.Boot>
}

export interface Configuration {
	id: string
	distro: "almalinux10" | "oraclelinux10" | "rockylinux10" | "fedora"
	secure: boolean
	digest: boolean
	mode: "live" | "static"
	provider: "none" | "latitude"| "vultr"
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
	root_size: string
	raid: number
	ssh_keys: string
	disks?: string[]
	interfaces?: string[]
	long_url_key: boolean
}

export interface System {
	id: string
	disks: Disk[]
	interfaces: Interface[]
}

export interface Disk {
	name: string
	path: string
	size: number
	model: string
	serial: string
}

export interface Interface {
	mac: string
	ip: string
	gateway_ip: string
	model: string
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ValidationError"
	}
}
