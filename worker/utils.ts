const idChars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const idCharsLen = idChars.length
const safeCharsRe = /[A-Za-z0-9+/=\s\t@.#_-]/g;
const cryptChars =
	"./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const cryptB64Order = [
	[0, 21, 42], [22, 43, 1], [44, 2, 23], [3, 24, 45],
	[25, 46, 4], [47, 5, 26], [6, 27, 48], [28, 49, 7],
	[50, 8, 29], [9, 30, 51], [31, 52, 10], [53, 11, 32],
	[12, 33, 54], [34, 55, 13], [56, 14, 35], [15, 36, 57],
	[37, 58, 16], [59, 17, 38], [18, 39, 60], [40, 61, 19],
	[62, 20, 41],
]

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

async function sha512Digest(data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest("SHA-512", data))
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
	let length = 0
	for (const part of parts) {
		length += part.length
	}
	const data = new Uint8Array(length)

	let offset = 0
	for (const part of parts) {
		data.set(part, offset)
		offset += part.length
	}

	return data
}

export async function sha512Crypt(password: string): Promise<string> {
	const rounds = 5000
	const salt = generateId(16)
	const encoder = new TextEncoder()
	const pw = encoder.encode(password)
	const slt = encoder.encode(salt)

	const digB = await sha512Digest(concatBytes([pw, slt, pw]))

	const aParts = [pw, slt]
	let cnt = pw.length
	while (cnt > 64) {
		aParts.push(digB)
		cnt -= 64
	}
	aParts.push(digB.slice(0, cnt))
	for (cnt = pw.length; cnt > 0; cnt >>= 1) {
		aParts.push(cnt & 1 ? digB : pw)
	}
	const digA = await sha512Digest(concatBytes(aParts))

	const dpParts: Uint8Array[] = []
	for (let i = 0; i < pw.length; i++) {
		dpParts.push(pw)
	}
	const digP = await sha512Digest(concatBytes(dpParts))
	const p = new Uint8Array(pw.length)
	for (let i = 0; i < pw.length; i++) {
		p[i] = digP[i % 64]
	}

	const dsParts: Uint8Array[] = []
	for (let i = 0; i < 16 + digA[0]; i++) {
		dsParts.push(slt)
	}
	const digS = await sha512Digest(concatBytes(dsParts))
	const s = new Uint8Array(slt.length)
	for (let i = 0; i < slt.length; i++) {
		s[i] = digS[i % 64]
	}

	let digC = digA
	for (let round = 0; round < rounds; round++) {
		const parts: Uint8Array[] = []
		parts.push(round % 2 ? p : digC)
		if (round % 3) {
			parts.push(s)
		}
		if (round % 7) {
			parts.push(p)
		}
		parts.push(round % 2 ? digC : p)
		digC = await sha512Digest(concatBytes(parts))
	}

	let hash = ""
	for (const [x, y, z] of cryptB64Order) {
		let word = (digC[x] << 16) | (digC[y] << 8) | digC[z]
		for (let i = 0; i < 4; i++) {
			hash += cryptChars[word & 0x3f]
			word >>>= 6
		}
	}
	let word = digC[63]
	for (let i = 0; i < 2; i++) {
		hash += cryptChars[word & 0x3f]
		word >>>= 6
	}

	return `$6$${salt}$${hash}`
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

export function arrayMatch(x?: string[], y?: string[]): boolean {
	if (!x || !y) {
		return false
	}

	if (x.length !== y.length) {
		return false;
	}

	const xMap = new Map<string, number>();
	const yMap = new Map<string, number>();

	for (const item of x) {
		xMap.set(item, (xMap.get(item) || 0) + 1);
	}

	for (const item of y) {
		yMap.set(item, (yMap.get(item) || 0) + 1);
	}

	if (xMap.size !== yMap.size) {
		return false;
	}

	for (const [key, count] of xMap) {
		if (yMap.get(key) !== count) {
			return false;
		}
	}

	return true;
}
