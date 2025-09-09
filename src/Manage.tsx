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
	AlertDialog,
} from "@radix-ui/themes"

export interface Error {
	error: string
}

export interface Data {
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

var curSync: Utils.SyncInterval

function Manage() {
	const { params } = Router.useRouter()
	const bootId = params.bootId
	if (!bootId) {
		return
	}

	const [_disabled, _setDisabled] = useState<boolean>(false)
	const [errorMsg, setErrorMsg] = useState<string>("")
	const [ipxeConf, setIpxeConf] = useState<string>("")
	const [_data, setData] = useState<Data>()
	const [system, setSystem] = useState<System>()

	const [selectedDisks, setSelectedDisks] = useState<string[]>([]);
	const [raidConfig, setRaidConfig] = useState("-1")

	let baseUrl: string
	baseUrl = "https://boot.pritunl.com"

	useEffect(() => {
		fetch(`/${bootId}/data`)
			.then(async (resp) => {
				if (!resp.ok) {
					if (resp.status === 400) {
						const errorData = await resp.json() as Error
						setErrorMsg(errorData.error || "Unknown error")
					}
					try {
						const respText = await resp.text()
						setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
					} catch {
						setErrorMsg(`Unknown error: ${resp.status}`)
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

		curSync?.stop()
		curSync = new Utils.SyncInterval(async () => {
			let resp = await fetch(`/${bootId}/system`)
			if (!resp.ok) {
				if (resp.status === 400) {
					const errorData = await resp.json() as Error
					setErrorMsg(errorData.error || "Unknown error")
				}
				try {
					const respText = await resp.text()
					setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
				} catch {
					setErrorMsg(`Unknown error: ${resp.status}`)
				}
			} else {
				const systemData = await resp.json() as System
				if (systemData.ready) {
					curSync.stop()
					setSystem(systemData)
				}
			}
		}, 1000)
	}, [bootId])

	let diskElms: React.ReactNode[] = []
	system?.disks?.forEach((disk: Disk) => {
		diskElms.push(
			<CheckboxCards.Item
				value={disk.path}
			>
				<Flex direction="column" width="100%">
					<Text weight="bold">{disk.path}</Text>
					<Text>{disk.model}{disk.serial ? (" " + disk.serial) : ""}</Text>
					<Text>{Math.round(disk.size / 1024)}GB</Text>
				</Flex>
			</CheckboxCards.Item>
		)
	})

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
					<Heading>Linux Boot Generator</Heading>

					{system && (<>
						<Flex direction="column" gap="1">
							<Text as="label" htmlFor="ipxe-url">
								Select Install Disks
							</Text>
							<CheckboxCards.Root
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
					</>)}

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
							value={
								`${baseUrl}/${bootId}.ipxe`
							}
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
							value={
								`${baseUrl}/${bootId}.ks`
							}
						/>
					</Flex>
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
