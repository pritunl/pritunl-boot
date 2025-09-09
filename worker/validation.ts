import * as Types from "./types"
import * as Utils from "./utils"

export function validatePayload(data: Types.Payload): Types.Payload {
	if (!data.network_mode || !["static", "dhcp"].includes(data.network_mode)) {
		throw new Types.ValidationError("Invalid network_mode")
	}

	if (data.network_mode === "static") {
		if (typeof data.bonded_network !== "boolean") {
			throw new Types.ValidationError("Invalid bonded_network format")
		}

		if (data.public_ip && !isValidIPv4CIDR(data.public_ip)) {
			throw new Types.ValidationError("Invalid public_ip format")
		}
		if (data.gateway_ip && !isValidIPv4(data.gateway_ip)) {
			throw new Types.ValidationError("Invalid gateway_ip format")
		}

		if (data.public_ip6 && !isValidIPv6CIDR(data.public_ip6)) {
			throw new Types.ValidationError("Invalid public_ip6 format")
		}
		if (data.gateway_ip6 && !isValidIPv6(data.gateway_ip6)) {
			throw new Types.ValidationError("Invalid gateway_ip6 format")
		}

		if (data.vlan && !isValidVLAN(data.vlan)) {
			throw new Types.ValidationError("Invalid VLAN ID for IPv4")
		}
		if (data.vlan6 && !isValidVLAN(data.vlan6)) {
			throw new Types.ValidationError("Invalid VLAN ID for IPv6")
		}

		if (data.interface && !isValidInterfaceName(data.interface)) {
			throw new Types.ValidationError("Invalid interface name format")
		}
		if (data.interface1 && !isValidInterfaceName(data.interface1)) {
			throw new Types.ValidationError("Invalid interface1 name format")
		}
		if (data.interface2 && !isValidInterfaceName(data.interface2)) {
			throw new Types.ValidationError("Invalid interface2 name format")
		}
	} else {
		data.bonded_network = false
		data.public_ip = ""
		data.gateway_ip = ""
		data.public_ip6 = ""
		data.gateway_ip6 = ""
		data.vlan = 0
		data.vlan6 = 0
		data.interface = ""
		data.interface1 = ""
		data.interface2 = ""
	}

	if (data.raid && ![-1, 1, 10].includes(data.raid)) {
		throw new Types.ValidationError("Invalid RAID configuration")
	}

	if (data.ssh_keys) {
		if (data.ssh_keys.length > 5000) {
			throw new Types.ValidationError(
				"SSH keys too long, maximum 5000 characters allowed")
		}

		if (data.ssh_keys.includes("PRIVATE KEY")) {
			throw new Types.ValidationError("Invalid SSH keys")
		}

		try {
			data.ssh_keys = Utils.encodeBase64(Utils.filterString(data.ssh_keys))
		} catch (error) {
			throw new Types.ValidationError("Failed to encode SSH keys")
		}
	}

	if (typeof data.long_url_key !== "boolean") {
		throw new Types.ValidationError("Invalid long_url_key format")
	}

	return {
		id: "",
		network_mode: data.network_mode,
		bonded_network: data.bonded_network,
		public_ip: data.public_ip,
		gateway_ip: data.gateway_ip,
		public_ip6: data.public_ip6,
		gateway_ip6: data.gateway_ip6,
		vlan: data.vlan,
		vlan6: data.vlan6,
		mtu: 0,
		interface: data.interface,
		interface1: data.interface1,
		interface2: data.interface2,
		raid: data.raid,
		ssh_keys: data.ssh_keys,
		long_url_key: data.long_url_key,
	}
}

export function isValidIPv4(ip: string): boolean {
	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
	if (!ipv4Regex.test(ip)) return false

	const parts = ip.split(".")
	return parts.every(part => {
		const num = parseInt(part, 10)
		return num >= 0 && num <= 255
	})
}

export function isValidIPv4CIDR(ip: string): boolean {
	const parts = ip.split("/")
	if (parts.length !== 2) return false

	const mask = parseInt(parts[1], 10)
	if (isNaN(mask) || mask < 0 || mask > 32) return false

	return isValidIPv4(parts[0])
}

export function isValidIPv6(ip: string): boolean {
	const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/
	return ipv6Regex.test(ip)
}

export function isValidIPv6CIDR(ip: string): boolean {
	const parts = ip.split("/")
	if (parts.length !== 2) return false

	const mask = parseInt(parts[1], 10)
	if (isNaN(mask) || mask < 0 || mask > 128) return false

	return isValidIPv6(parts[0])
}

export function isValidVLAN(vlanId: number): boolean {
	return !isNaN(vlanId) && vlanId >= 1 && vlanId <= 4094
}

export function isValidInterfaceName(name: string): boolean {
	if (name.length > 15) {
		return false
	}
	const validCharsRegex = /^[a-z0-9]+$/
	return validCharsRegex.test(name)
}
