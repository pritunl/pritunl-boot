import { useState, useEffect } from "react"
import * as React from "react"
import logo from "./assets/logo.png"
import * as Router from "./router"
import * as Utils from "./utils"
import {
	Box, Container,
	Heading, Flex,
	Text, TextArea,
	Button, TextField,
	Select, CheckboxCards,
	Switch, Callout,
	Spinner, Tabs,
	AlertDialog
} from "@radix-ui/themes"

export interface Error {
	error: string
}

export interface Data {
	id: string
	distro: string
	mode: "live" | "static"
	secure: boolean
	digest: boolean
	provider: "none" | "latitude" | "vultr"
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
	raid: number
	ssh_keys: string
	long_url_key: boolean
	ipxe_url: string
	ks_url: string
	ipxe: string
	error: string
}

export interface System {
	id: string
	disks: Disk[]
	interfaces: Interface[]
	ready: boolean
	error: string
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

var stageSync: Utils.SyncInterval
var systemSync: Utils.SyncInterval

function Manage() {
	const { params } = Router.useRouter()
	const bootId = params.bootId

	const [disabled, setDisabled] = useState<boolean>(false)
	const [errorMsg, setErrorMsg] = useState<string>("")
	const [ipxeConf, setIpxeConf] = useState<string>("")
	const [data, setData] = useState<Data>()
	const [system, setSystem] = useState<System>()
	const [stage, setStage] = useState("")

	const [networkMode, setNetworkMode] = useState("static")
	const [publicIp, setPublicIp] = useState("")
	const [gatewayIp, setGatewayIp] = useState("")
	const [publicIp6, setPublicIp6] = useState("")
	const [gatewayIp6, setGatewayIp6] = useState("")
	const [vlan, setVlan] = useState("")
	const [vlan6, setVlan6] = useState("")
	const [mtu, setMtu] = useState("")
	const [bondedNetwork, setBondedNetwork] = useState(false)
	const [selectedIfaces, setSelectedIfaces] = useState<string[]>([]);

	const [privateNetworkMode, setPrivateNetworkMode] = useState("none")
	const [privateIp, setPrivateIp] = useState("")
	const [privateGatewayIp, setPrivateGatewayIp] = useState("")
	const [privateIp6, setPrivateIp6] = useState("")
	const [privateGatewayIp6, setPrivateGatewayIp6] = useState("")
	const [privateVlan, setPrivateVlan] = useState("")
	const [privateVlan6, setPrivateVlan6] = useState("")
	const [privateMtu, setPrivateMtu] = useState("")
	const [privateBondedNetwork, setPrivateBondedNetwork] = useState(false)
	const [privateSelectedIfaces, setPrivateSelectedIfaces] = useState<string[]>([]);

	const [rootSize, setRootSize] = useState("")
	const [raidConfig, setRaidConfig] = useState("-1")

	const [selectedDisks, setSelectedDisks] = useState<string[]>([]);

	useEffect(() => {
		if (!bootId) {
			return
		}

		fetch(`/${bootId}/data`)
			.then(async (resp) => {
				if (!resp.ok) {
					if (resp.status === 400) {
						const errorData = await resp.json() as Error
						setErrorMsg(errorData.error || "Unknown error")
					} else if (resp.status === 404) {
							setErrorMsg("Token has expired")
					} else {
						try {
							const respText = await resp.text()
							setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
						} catch {
							setErrorMsg(`Unknown error: ${resp.status}`)
						}
					}
				} else {
					const bootData = await resp.json() as Data
					setData(bootData)
					setIpxeConf(bootData.ipxe)
				}
			})
			.catch((error) => {
				setErrorMsg(`Unknown error: ${error}`)
			})

		stageSync?.stop()
		stageSync = new Utils.SyncInterval(async () => {
			let resp = await fetch(`/${bootId}/stage`)
			if (!resp.ok) {
				if (resp.status === 400) {
					const errorData = await resp.json() as Error
					setErrorMsg(errorData.error || "Unknown error")
				} else if (resp.status === 404) {
						setErrorMsg("Token has expired")
				} else {
					try {
						const respText = await resp.text()
						setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
					} catch {
						setErrorMsg(`Unknown error: ${resp.status}`)
					}
				}
			} else {
				const stageData = await resp.json() as {
					stage: string
				}
				if (stageData.stage) {
					setStage(stageData.stage)
					if (stageData.stage === "complete") {
						stageSync?.stop()
					}
				}
			}
		}, 3000, true)

		systemSync?.stop()
		systemSync = new Utils.SyncInterval(async () => {
			let resp = await fetch(`/${bootId}/system`)
			if (!resp.ok) {
				if (resp.status === 400) {
					const errorData = await resp.json() as Error
					setErrorMsg(errorData.error || "Unknown error")
				} else if (resp.status === 404) {
						setErrorMsg("Token has expired")
				} else {
					try {
						const respText = await resp.text()
						setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
					} catch {
						setErrorMsg(`Unknown error: ${resp.status}`)
					}
				}
			} else {
				const systemData = await resp.json() as System
				if (systemData.ready) {
					setSystem(systemData)
					systemSync?.stop()
				}
			}
		}, 3000, true)
	}, [bootId])

	let diskElms: React.ReactNode[] = []
	system?.disks?.forEach((disk: Disk) => {
		diskElms.push(
			<CheckboxCards.Item
				value={disk.name}
			>
				<Flex direction="column" width="100%">
					<Text weight="bold">{disk.path}</Text>
					<Text>{disk.model}{disk.serial ? (" " + disk.serial) : ""}</Text>
					<Text>{Math.round(disk.size / 1024)}GB</Text>
				</Flex>
			</CheckboxCards.Item>
		)
	})

	let ifaceElms: React.ReactNode[] = []
	system?.interfaces?.forEach((iface: Interface) => {
		ifaceElms.push(
			<CheckboxCards.Item
				value={iface.mac}
			>
				<Flex direction="column" width="100%">
					<Text weight="bold">{iface.mac}</Text>
					<Text>{iface.model}</Text>
					<Text>
						{iface.ip || "-"}
						<Text color="gray">{" " + (iface.gateway_ip || "")}</Text>
					</Text>
				</Flex>
			</CheckboxCards.Item>
		)
	})

	let body: React.ReactNode
	if (!bootId || !stage) {
		body = <></>
	} else if (stage && stage != "wait") {
		let stageColor = ""
		let stageInfo = ""
		let spinner = false
		switch (stage) {
			case "ready":
				spinner = true
				stageColor = "yellow"
				stageInfo = "Waiting for installer to receive configuration..."
				break
			case "pre":
				spinner = true
				stageColor = "brown"
				stageInfo = "System in pre-installation..."
				break
			case "install":
				spinner = true
				stageColor = "sky"
				stageInfo = "System installation running..."
				break
			case "post":
				spinner = true
				stageColor = "mint"
				stageInfo = "System in post-installation..."
				break
			case "reboot":
				spinner = true
				stageColor = "teal"
				stageInfo = "Waiting for system reboot..."
				break
			case "complete":
				spinner = false
				stageColor = "green"
				stageInfo = `Installation complete: ssh cloud@${(publicIp ||
					data?.public_ip)?.split("/")[0] || "<public_ip>"}`
				break
			default:
				spinner = true
				stageColor = "gray"
				stageInfo = "Unknown install stage"
		}

		body = <>
			<Callout.Root variant="outline" color={stageColor as any}>
				{spinner ? <Callout.Icon><Spinner size="2"/></Callout.Icon> : <></>}
				<Callout.Text>
					<b>{stageInfo}</b>
				</Callout.Text>
			</Callout.Root>
		</>
	} else if (!data || !system) {
		body = <>
			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="ipxe-url">
					iPXE Chain URL
				</Text>
				<TextField.Root
					id="ipxe-url"
					readOnly={true}
					style={{
						fontSize: "14px",
						fontFamily: "Roboto Mono",
					}}
					value={data?.ipxe_url || ""}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="ipxe-conf">
					iPXE Configuration
				</Text>
				<TextArea
					id="ipxe-conf"
					rows={10}
					spellCheck={false}
					value={ipxeConf}
					onChange={(e) => setIpxeConf(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="ks-url">
					Kickstart URL
				</Text>
				<TextField.Root
					id="ks-url"
					readOnly={true}
					style={{
						fontSize: "14px",
						fontFamily: "Roboto Mono",
					}}
					value={data?.ks_url || ""}
				/>
			</Flex>

			<Callout.Root variant="outline">
				<Callout.Icon>
					<Spinner size="2"/>
				</Callout.Icon>
				<Callout.Text>
					<b>Waiting for installer to start...</b>
				</Callout.Text>
			</Callout.Root>
		</>
	} else {
		let publicNetConf = <Flex direction="column" gap="3">
			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="install-ifaces">
					Select Public Network Interfaces
				</Text>
				<CheckboxCards.Root
					id="install-ifaces"
					defaultValue={[]}
					columns="1"
					size="1"
					value={selectedIfaces}
					onValueChange={(selected: string[]) => {
						setSelectedIfaces(selected)
					}}
				>
					{ifaceElms}
				</CheckboxCards.Root>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="network-config">
					Public Network Configuration
				</Text>
				<Select.Root
					value={networkMode}
					onValueChange={setNetworkMode}
				>
					<Select.Trigger id="network-config"/>
					<Select.Content>
						<Select.Item value="static">Static</Select.Item>
						<Select.Item value="dhcp">DHCP</Select.Item>
					</Select.Content>
				</Select.Root>
			</Flex>

			<Flex gap="2">
				<Switch
					id="bonded-network"
					checked={networkMode !== "static" ? false : bondedNetwork}
					disabled={networkMode !== "static"}
					onCheckedChange={setBondedNetwork}
				/>
				<Text as="label" htmlFor="bonded-network">
					Bonded Network
				</Text>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="public-ip">
					Public IPv4
				</Text>
				<TextField.Root
					id="public-ip"
					placeholder="142.250.73.110/24"
					value={networkMode !== "static" ? "" : publicIp}
					disabled={networkMode !== "static"}
					onChange={(e) => setPublicIp(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="gateway-ip">
					Gateway IPv4
				</Text>
				<TextField.Root
					id="gateway-ip"
					placeholder="142.250.73.1"
					value={networkMode !== "static" ? "" : gatewayIp}
					disabled={networkMode !== "static"}
					onChange={(e) => setGatewayIp(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="vlan">
					VLAN ID IPv4
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="vlan"
					placeholder="0"
					value={networkMode !== "static" ? "" : vlan}
					disabled={networkMode !== "static"}
					onChange={(e) => setVlan(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="public-ip6">
					Public IPv6
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="public-ip6"
					placeholder="2607:f8b0:400a:800::200e/64"
					value={networkMode !== "static" ? "" : publicIp6}
					disabled={networkMode !== "static"}
					onChange={(e) => setPublicIp6(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="gateway-ip6">
					Gateway IPv6
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="gateway-ip6"
					placeholder="2607:f8b0:400a:800::1"
					value={networkMode !== "static" ? "" : gatewayIp6}
					disabled={networkMode !== "static"}
					onChange={(e) => setGatewayIp6(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="vlan6">
					VLAN ID IPv6
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="vlan6"
					placeholder="0"
					value={networkMode !== "static" ? "" : vlan6}
					disabled={networkMode !== "static"}
					onChange={(e) => setVlan6(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="mtu">
					Network MTU
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="mtu"
					placeholder="1500"
					value={networkMode !== "static" ? "" : mtu}
					disabled={networkMode !== "static"}
					onChange={(e) => setMtu(e.target.value)}
				/>
			</Flex>
		</Flex>

		let privateNetConf = <Flex direction="column" gap="3">
			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="install-ifaces">
					Select Private Network Interfaces
				</Text>
				<CheckboxCards.Root
					id="install-ifaces"
					defaultValue={[]}
					columns="1"
					size="1"
					value={privateSelectedIfaces}
					onValueChange={(selected: string[]) => {
						setPrivateSelectedIfaces(selected)
					}}
				>
					{ifaceElms}
				</CheckboxCards.Root>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="network-config">
					Private Network Configuration
				</Text>
				<Select.Root
					value={privateNetworkMode}
					onValueChange={setPrivateNetworkMode}
				>
					<Select.Trigger id="network-config"/>
					<Select.Content>
						<Select.Item value="none">Disabled</Select.Item>
						<Select.Item value="static">Static</Select.Item>
						<Select.Item value="dhcp">DHCP</Select.Item>
					</Select.Content>
				</Select.Root>
			</Flex>

			<Flex gap="2">
				<Switch
					id="bonded-network"
					checked={privateNetworkMode !== "static" ? false : privateBondedNetwork}
					disabled={privateNetworkMode !== "static"}
					onCheckedChange={setPrivateBondedNetwork}
				/>
				<Text as="label" htmlFor="bonded-network">
					Bonded Network
				</Text>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-ip">
					Private IPv4
				</Text>
				<TextField.Root
					id="private-ip"
					placeholder="192.168.1.100/24"
					value={privateNetworkMode !== "static" ? "" : privateIp}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateIp(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-gateway-ip">
					Gateway IPv4
				</Text>
				<TextField.Root
					id="private-gateway-ip"
					placeholder="192.168.1.1"
					value={privateNetworkMode !== "static" ? "" : privateGatewayIp}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateGatewayIp(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-vlan">
					VLAN ID IPv4
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="private-vlan"
					placeholder="0"
					value={privateNetworkMode !== "static" ? "" : privateVlan}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateVlan(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-ip6">
					Private IPv6
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="private-ip6"
					placeholder="fd00::100/64"
					value={privateNetworkMode !== "static" ? "" : privateIp6}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateIp6(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-gateway-ip6">
					Gateway IPv6
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="private-gateway-ip6"
					placeholder="fd00::1"
					value={privateNetworkMode !== "static" ? "" : privateGatewayIp6}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateGatewayIp6(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-vlan6">
					VLAN ID IPv6
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="private-vlan6"
					placeholder="0"
					value={privateNetworkMode !== "static" ? "" : privateVlan6}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateVlan6(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="private-mtu">
					Network MTU
					<Text color="gray"> (Optional)</Text>
				</Text>
				<TextField.Root
					id="private-mtu"
					placeholder="1500"
					value={privateNetworkMode !== "static" ? "" : privateMtu}
					disabled={privateNetworkMode !== "static"}
					onChange={(e) => setPrivateMtu(e.target.value)}
				/>
			</Flex>
		</Flex>

		body = <>
			<Callout.Root variant="outline">
				<Callout.Icon>
					<Spinner size="2"/>
				</Callout.Icon>
				<Callout.Text>
					<b>Installer waiting for configuration...</b>
				</Callout.Text>
			</Callout.Root>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="install-disks">
					Select Install Disks
				</Text>
				<CheckboxCards.Root
					id="install-disks"
					defaultValue={[]}
					columns="1"
					size="1"
					value={selectedDisks}
					onValueChange={(selected: string[]) => {
						setSelectedDisks(selected)
					}}
				>
					{diskElms}
				</CheckboxCards.Root>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="disk-size">
					Root Filesystem Size
					<Text color="gray"> (Leave Blank to Fill Disk)</Text>
				</Text>
				<TextField.Root
					id="disk-size"
					placeholder="50GB"
					value={rootSize}
					onChange={(e) => setRootSize(e.target.value)}
				/>
			</Flex>

			<Flex direction="column" gap="1">
				<Text as="label" htmlFor="raid-config">
					RAID Configuration
				</Text>
				<Select.Root
					value={raidConfig}
					onValueChange={setRaidConfig}
				>
					<Select.Trigger id="raid-config"/>
					<Select.Content>
						<Select.Item value="-1">No RAID</Select.Item>
						<Select.Item value="1">RAID 1</Select.Item>
						<Select.Item value="10">RAID 10</Select.Item>
					</Select.Content>
				</Select.Root>
			</Flex>

			<Tabs.Root defaultValue="public">
				<Tabs.List>
					<Tabs.Trigger value="public">Public Network</Tabs.Trigger>
					<Tabs.Trigger value="private">Private Network</Tabs.Trigger>
				</Tabs.List>

				<Box pt="3">
					<Tabs.Content value="public">
						{publicNetConf}
					</Tabs.Content>
					<Tabs.Content value="private">
						{privateNetConf}
					</Tabs.Content>
				</Box>
			</Tabs.Root>

			<Flex direction="column" pt="3">
				<Button
					disabled={disabled}
					onClick={() => {
						setDisabled(true)

						const payload = {
							network_mode: networkMode,
							bonded_network: bondedNetwork,
							public_ip: publicIp,
							gateway_ip: gatewayIp,
							public_ip6: publicIp6,
							gateway_ip6: gatewayIp6,
							vlan: vlan ? parseInt(vlan, 10) : 0,
							vlan6: vlan6 ? parseInt(vlan6, 10) : 0,
							mtu: mtu ? parseInt(mtu, 10) : 0,
							interfaces: selectedIfaces,
							private_network_mode: privateNetworkMode,
							private_bonded_network: privateBondedNetwork,
							private_ip: privateIp,
							private_gateway_ip: privateGatewayIp,
							private_ip6: privateIp6,
							private_gateway_ip6: privateGatewayIp6,
							private_vlan: privateVlan ? parseInt(privateVlan, 10) : 0,
							private_vlan6: privateVlan6 ? parseInt(privateVlan6, 10) : 0,
							private_mtu: privateMtu ? parseInt(privateMtu, 10) : 0,
							private_interfaces: privateSelectedIfaces,
							root_size: rootSize,
							raid: parseInt(raidConfig, 10),
							disks: selectedDisks,
						}

						fetch(`/${data.id}/install`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						}).then(async (resp) => {
							setDisabled(false)
							if (!resp.ok) {
								if (resp.status === 400) {
									const errorData = await resp.json() as {
										error: string
									}
									setErrorMsg(errorData.error || "Unknown error")
								} else if (resp.status === 404) {
										setErrorMsg("Token has expired")
								} else {
									try {
										const respText = await resp.text()
										setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
									} catch {
										setErrorMsg(`Unknown error: ${resp.status}`)
									}
								}
							} else {
								setStage("ready")
							}
						}).catch((error) => {
							setDisabled(false)
							setErrorMsg(`Unknown error: ${error}`)
						})
					}}
				>Start Install</Button>
			</Flex>
		</>
	}

	return (
		<Box>
			<Container align="center" maxWidth="480px">
				<Flex
					direction="column"
					gap="3"
					style={{
						margin: "30px 22px",
					}}
				>
					<img
						src={logo}
						alt="Pritunl"
						style={{
							width: "70%",
							margin: "0 auto",
						}}
					/>
					<Heading>Linux iPXE Boot Generator</Heading>
					{body}
				</Flex>
			</Container>
			<AlertDialog.Root open={!!errorMsg}>
				<AlertDialog.Content maxWidth="450px">
					<AlertDialog.Title color="red">Error</AlertDialog.Title>
					<AlertDialog.Description>
						{errorMsg}
					</AlertDialog.Description>
					<Flex gap="3" mt="4" justify="end">
						<AlertDialog.Cancel>
							<Button
								variant="soft"
								color="gray"
								onClick={() => {
									setErrorMsg("")
								}}
							>
								Close
							</Button>
						</AlertDialog.Cancel>
					</Flex>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Box>
	)
}

export default Manage
