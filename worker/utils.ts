const idChars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const idCharsLen = idChars.length
const safeCharsRe = /[A-Za-z0-9+/=\s\t@.#_-]/g;

export async function sha256(data: string): Promise<string> {
	const encoder = new TextEncoder()
	const data_bytes = encoder.encode(data)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data_bytes)
	const hashArray = new Uint8Array(hashBuffer)
	return Array.from(hashArray)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

export function encodeBase64(data: string): string {
	const encoder = new TextEncoder()
	const encoded = encoder.encode(data)
	return btoa(String.fromCharCode(...encoded))
}

export function decodeBase64(data: string): string {
	const decoded = atob(data)
	const decoder = new TextDecoder()
	const uint8Array = new Uint8Array([...decoded].map(x => x.charCodeAt(0)))
	return decoder.decode(uint8Array)
}

export function basename(path: string, ext?: string): string {
	const name = path.split('/').pop() || path
	if (ext && name.endsWith(ext)) {
		return name.slice(0, -ext.length)
	}
	return name
}

export function filterString(input: string): string {
	input = input.replace("SSH-EOF", "")
	return input.match(safeCharsRe)?.join("") || ""
}

export function generateId(length = 10): string {
	const array = new Uint8Array(length)
	crypto.getRandomValues(array)
	return Array.from(array, byte => idChars[byte % idCharsLen]).join("")
}

export function cidrToNetmask(cidr: string): string {
	const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
	if (!cidrRegex.test(cidr)) {
		throw new Error('Invalid CIDR format. Expected format: x.x.x.x/y')
	}

	const prefixLength = parseInt(cidr.split('/')[1])
	if (prefixLength < 0 || prefixLength > 32) {
		throw new Error('Invalid prefix length. Must be between 0 and 32')
	}

	const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0

	const octet1 = (mask >>> 24) & 0xFF
	const octet2 = (mask >>> 16) & 0xFF
	const octet3 = (mask >>> 8) & 0xFF
	const octet4 = mask & 0xFF

	return `${octet1}.${octet2}.${octet3}.${octet4}`
}

export function parseRootSize(size: string): number {
	const match = size.match(/^(\d+)GB$/i)
	if (match) {
		let gb = parseInt(match[1])
		if (gb < 2) {
			gb = 2
		}
		return gb * 1024
	} else {
		return 0
	}
}

export function cidrToIp(cidr: string): string {
	return cidr.split('/')[0]
}
