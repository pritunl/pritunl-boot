import * as Types from "./types"
import * as Utils from "./utils"

export function validateConfiguration(
	data: Types.Configuration, install: boolean = false): Types.Configuration {

	if (!data.distro || !["almalinux10", "oraclelinux10",
			"rockylinux10", "fedora"].includes(data.distro)) {
		throw new Types.ValidationError("Invalid distro")
	}

	if (!data.mode || !["live", "static"].includes(data.mode)) {
		throw new Types.ValidationError("Invalid mode")
	}

	if (typeof data.secure !== "boolean") {
		throw new Types.ValidationError("Invalid secure format")
	}

	if (typeof data.digest !== "boolean") {
		throw new Types.ValidationError("Invalid digest format")
	}

	if (!data.provider ||
		!["none", "latitude", "vultr"].includes(data.provider)) {

		throw new Types.ValidationError("Invalid provider")
	}

	if (!data.network_mode || !["static", "dhcp"].includes(data.network_mode)) {
		throw new Types.ValidationError("Invalid network_mode")
	}

	if (typeof data.bonded_network !== "boolean") {
		throw new Types.ValidationError("Invalid bonded_network format")
	}
	if (data.interface && !isValidInterfaceName(data.interface)) {
		throw new Types.ValidationError("Invalid interface name format")
	}

	if (data.interfaces) {
		data.interfaces.forEach((iface: string) => {
			if (!isValidMAC(iface)) {
				throw new Types.ValidationError("Invalid interface in interfaces")
			}
		})
	} else {
		data.interfaces = []
	}
	if (install && data.interfaces.length < 1) {
		throw new Types.ValidationError("Missing required interfaces")
	}

	if (data.network_mode === "static") {
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
		if (data.mtu && !isValidMtu(data.mtu)) {
			throw new Types.ValidationError("Invalid network MTU")
		}
	} else {
		data.public_ip = ""
		data.gateway_ip = ""
		data.public_ip6 = ""
		data.gateway_ip6 = ""
		data.vlan = 0
		data.vlan6 = 0
		data.mtu = 0
	}

	if (data.root_size && data.root_size !== "") {
		data.root_size = data.root_size.toUpperCase()
		const rootSizeRegex = /^\d+GB$/
		if (!rootSizeRegex.test(data.root_size)) {
			throw new Types.ValidationError(
				"Invalid root_size format. Must be a number followed " +
				"by 'GB' (e.g., '50GB') or blank to fill disk"
			)
		}
	}

	if (data.disks) {
		data.disks.forEach((diskPath: string) => {
			if (!isValidDiskName(diskPath)) {
				throw new Types.ValidationError("Invalid disk name in disks")
			}
		})
	} else {
		data.disks = []
	}
	if (install && data.disks.length < 1) {
		throw new Types.ValidationError("Missing required disks")
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
		distro: data.distro,
		mode: data.mode,
		secure: data.secure,
		digest: data.digest,
		provider: data.provider,
		network_mode: data.network_mode,
		bonded_network: data.bonded_network,
		public_ip: data.public_ip,
		gateway_ip: data.gateway_ip,
		public_ip6: data.public_ip6,
		gateway_ip6: data.gateway_ip6,
		vlan: data.vlan,
		vlan6: data.vlan6,
		mtu: data.mtu,
		interface: data.interface,
		root_size: data.root_size,
		raid: data.raid,
		ssh_keys: data.ssh_keys,
		disks: data.disks,
		interfaces: data.interfaces,
		long_url_key: data.long_url_key,
	}
}

export function validateSystem(data: Types.System): Types.System {
	if (!data.disks || !Array.isArray(data.disks)) {
		throw new Types.ValidationError("Invalid disks format")
	}

	if (data.disks.length === 0) {
		throw new Types.ValidationError("At least one disk is required")
	}

	let disks: Types.Disk[] = []
	data.disks.slice(0, 32).forEach((disk, index) => {
		if (!disk.path || typeof disk.path !== "string") {
			throw new Types.ValidationError(`Invalid disk path at index ${index}`)
		}

		if (!isValidDiskPath(disk.path)) {
			throw new Types.ValidationError(
				`Invalid disk path format at index ${index}`)
		}

		if (typeof disk.size !== "number" || disk.size <= 0) {
			throw new Types.ValidationError(`Invalid disk size at index ${index}`)
		}

		if (typeof disk.model !== "string") {
			throw new Types.ValidationError(`Invalid disk model at index ${index}`)
		}

		if (typeof disk.serial !== "string") {
			throw new Types.ValidationError(`Invalid disk serial at index ${index}`)
		}

		disks.push({
			name: Utils.filterString(disk.name).substring(0, 128),
			path: Utils.filterString(disk.path).substring(0, 128),
			size: disk.size,
			model: Utils.filterString(disk.model).substring(0, 128),
			serial: Utils.filterString(disk.serial).substring(0, 128),
		})
	})

	if (!data.interfaces || !Array.isArray(data.interfaces)) {
		throw new Types.ValidationError("Invalid interfaces format")
	}

	if (data.interfaces.length === 0) {
		throw new Types.ValidationError("At least one interface is required")
	}

	let interfaces: Types.Interface[] = []
	data.interfaces.slice(0, 32).forEach((iface, index) => {
		if (!iface.mac || !isValidMAC(iface.mac)) {
			throw new Types.ValidationError(`Invalid MAC address at index ${index}`)
		}

		if (iface.ip && !isValidIPv4CIDR(iface.ip)) {
			throw new Types.ValidationError(`Invalid IP address at index ${index}`)
		}

		if (iface.gateway_ip && !isValidIPv4(iface.gateway_ip)) {
			throw new Types.ValidationError(
				`Invalid gateway IP address at index ${index}`)
		}

		if (!iface.model || typeof iface.model !== "string") {
			throw new Types.ValidationError(
				`Invalid interface model at index ${index}`)
		}

		interfaces.push({
			mac: iface.mac,
			ip: iface.ip,
			gateway_ip: iface.gateway_ip,
			model: Utils.filterString(iface.model).substring(0, 128),
		})
	})

	return {
		id: data.id,
		disks: disks,
		interfaces: interfaces,
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

export function isValidMtu(mtu: number): boolean {
	return !isNaN(mtu) && mtu >= 68 && mtu <= 65536
}

export function isValidInterfaceName(name: string): boolean {
	if (name.length > 15) {
		return false
	}
	const validCharsRegex = /^[a-z0-9]+$/
	return validCharsRegex.test(name)
}

export function isValidMAC(mac: string): boolean {
	const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
	return macRegex.test(mac)
}

export function isValidDiskName(name: string): boolean {
    const diskNameRegex = /^[a-z][a-z0-9]*$/
    return diskNameRegex.test(name) && name.length <= 20
}

export function isValidDiskPath(path: string): boolean {
    const diskPathRegex = /^\/dev\/[a-z][a-z0-9]*$/
    return diskPathRegex.test(path) && path.length <= 25
}
