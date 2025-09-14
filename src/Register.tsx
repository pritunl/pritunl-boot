import { useState } from "react"
import logo from "./assets/logo.png"
import * as Router from "./router"
import {
	Box, Container,
	Heading, Flex,
	Text, TextArea,
	Button, Select,
	Switch, TextField,
	Link, AlertDialog,
} from "@radix-ui/themes"

function Register() {
	const { navigate } = Router.useRouter()
	const [disabled, setDisabled] = useState(false)
	const [errorMsg, setErrorMsg] = useState("")
	const [distro, setDistro] = useState("almalinux10")
	const [setupMode, setSetupMode] = useState("live")
	const [secure, setSecure] = useState(false)
	const [provider, setProvider] = useState("none")
	const [networkMode, setNetworkMode] = useState("dhcp")
	const [publicIp, setPublicIp] = useState("")
	const [gatewayIp, setGatewayIp] = useState("")
	const [publicIp6, setPublicIp6] = useState("")
	const [gatewayIp6, setGatewayIp6] = useState("")
	const [interfaceName, setInterfaceName] = useState("")
	const [vlan, setVlan] = useState("")
	const [vlan6, setVlan6] = useState("")
	const [mtu, setMtu] = useState("")
	const [bondedNetwork, setBondedNetwork] = useState(false)
	const [rootSize, setRootSize] = useState("")
	const [raidConfig, setRaidConfig] = useState("-1")
	const [sshKeys, setSshKeys] = useState("")
	const [longUrlKey, setLongUrlKey] = useState(false)

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

					<Flex direction="column" gap="1">
						<Text as="label" htmlFor="distro">
							Linux Distribution
						</Text>
						<Select.Root
							value={distro}
							onValueChange={setDistro}
						>
							<Select.Trigger id="distro"/>
							<Select.Content>
								<Select.Item value="almalinux10">
									<Flex as="span" align="center" gap="2">
										<span style={css.logo} className="almalinux-logo"/>
										<span>AlmaLinux 10</span>
									</Flex>
								</Select.Item>
								<Select.Item value="oraclelinux10">
									<Flex as="span" align="center" gap="2">
										<span style={css.logo} className="oraclelinux-logo"/>
										<span>Oracle Linux 10</span>
									</Flex>
								</Select.Item>
								<Select.Item value="rockylinux10">
									<Flex as="span" align="center" gap="2">
										<span style={css.logo} className="rockylinux-logo"/>
										<span>Rocky Linux 10</span>
									</Flex>
								</Select.Item>
								<Select.Item value="fedora">
									<Flex as="span" align="center" gap="2">
										<span style={css.logo} className="fedora-logo"/>
										<span>Fedora Server 42</span>
									</Flex>
								</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>

					<Flex direction="column" gap="1">
						<Text as="label" htmlFor="setup-mode">
							Configuration Mode
						</Text>
						<Select.Root
							value={setupMode}
							onValueChange={setSetupMode}
						>
							<Select.Trigger id="setup-mode"/>
							<Select.Content>
								<Select.Item value="live">Interactive</Select.Item>
								<Select.Item value="static">Preconfigured</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>

					<Flex gap="2">
						<Switch
							id="ipxe-secure"
							checked={secure}
							onCheckedChange={setSecure}
						/>
						<Text as="label" htmlFor="ipxe-secure">
							iPXE HTTPS Support
						</Text>
					</Flex>

					<Flex direction="column" gap="1">
						<Text as="label" htmlFor="provider">
							Bare Metal Provider
						</Text>
						<Select.Root
							value={provider}
							onValueChange={setProvider}
						>
							<Select.Trigger id="provider"/>
							<Select.Content>
								<Select.Item value="none">None</Select.Item>
								<Select.Item value="latitude">Latitude.sh</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>

					{!["latitude", "vultr"].includes(provider) && (<>
						<Flex direction="column" gap="1">
							<Text as="label" htmlFor="network-config">
								Network Configuration
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
					</>)}

					{!["latitude", "vultr"].includes(provider) &&
							setupMode === "static" && (<>
						<Flex gap="2">
							<Switch
								id="bonded-network"
								checked={bondedNetwork}
								onCheckedChange={setBondedNetwork}
							/>
							<Text as="label" htmlFor="bonded-network">
								Bonded Network
							</Text>
						</Flex>
					</>)}

					{networkMode === "static" && !["latitude", "vultr"].includes(provider) && (<>
						<Flex direction="column" gap="1">
							<Text as="label" htmlFor="public-ip">
								Public IPv4
							</Text>
							<TextField.Root
								id="public-ip"
								placeholder="142.250.73.110/24"
								value={publicIp}
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
								value={gatewayIp}
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
								value={vlan}
								onChange={(e) => setVlan(e.target.value)}
							/>
						</Flex>
					</>)}

					{setupMode === "static" && networkMode === "static" &&
							!["latitude", "vultr"].includes(provider) && (<>
						<Flex direction="column" gap="1">
							<Text as="label" htmlFor="public-ip6">
								Public IPv6
								<Text color="gray"> (Optional)</Text>
							</Text>
							<TextField.Root
								id="public-ip6"
								placeholder="2607:f8b0:400a:800::200e/64"
								value={publicIp6}
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
								value={gatewayIp6}
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
								value={vlan6}
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
								value={mtu}
								onChange={(e) => setMtu(e.target.value)}
							/>
						</Flex>
					</>)}

					{(setupMode === "live" || !bondedNetwork) &&
							!["latitude", "vultr"].includes(provider) && (<>
						<Flex direction="column" gap="1">
							<Text as="label" htmlFor="interface">
								Interface Name
								<Text color="gray"> (Leave Blank to Auto Detect)</Text>
							</Text>
							<TextField.Root
								id="interface"
								placeholder="eth0"
								value={interfaceName}
								onChange={(e) => setInterfaceName(e.target.value)}
							/>
						</Flex>
					</>)}

					{setupMode === "static" && (<>
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
					</>)}

					<Flex direction="column" gap="1">
						<Text as="label" htmlFor="ssh-keys">
							SSH Keys
						</Text>
						<TextArea
							id="ssh-keys"
							rows={10}
							spellCheck={false}
							placeholder="Paste ~/.ssh/authorized_keys"
							value={sshKeys}
							onChange={(e) => setSshKeys(e.target.value)}
						/>
					</Flex>

					<Flex gap="2">
						<Switch
							id="long-url-key"
							checked={longUrlKey}
							onCheckedChange={setLongUrlKey}
						/>
						<Text as="label" htmlFor="long-url-key" size="2">
							Long URL Key
						</Text>
					</Flex>

					<Button
						disabled={disabled}
						onClick={() => {
							setDisabled(true)

							const payload = {
								distro: distro,
								mode: setupMode,
								secure: secure,
								provider: provider,
								network_mode: networkMode,
								bonded_network: bondedNetwork,
								public_ip: publicIp,
								gateway_ip: gatewayIp,
								public_ip6: publicIp6,
								gateway_ip6: gatewayIp6,
								vlan: vlan ? parseInt(vlan, 10) : 0,
								vlan6: vlan6 ? parseInt(vlan6, 10) : 0,
								mtu: mtu ? parseInt(mtu, 10) : 0,
								interface: bondedNetwork ? undefined : interfaceName,
								root_size: rootSize,
								raid: parseInt(raidConfig, 10),
								ssh_keys: sshKeys,
								long_url_key: longUrlKey,
							}

							fetch("/register", {
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
									} else {
										try {
											const respText = await resp.text()
											setErrorMsg(`Unknown error: ${resp.status} ${respText}`)
										} catch {
											setErrorMsg(`Unknown error: ${resp.status}`)
										}
									}
								} else {
									const data = await resp.json() as {
										id?: string
									}
									navigate(`/${data.id}/manage`)
								}
							}).catch((error) => {
								setDisabled(false)
								setErrorMsg(`Unknown error: ${error}`)
							})
						}}
					>Generate iPXE Install</Button>

					<Flex gap="2" direction={{initial: "column", xs: "row"}} wrap="wrap">
						<Button
							asChild
							variant="outline"
							style={{flexGrow: 1, flexBasis: "auto"}}
						>
							<Link href="https://pxe.pritunl.com/ipxe.iso">
								Download iPXE
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							style={{flexGrow: 1, flexBasis: "auto"}}
						>
							<Link href="https://github.com/pritunl/pritunl-boot">
								GitHub
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							style={{flexGrow: 1, flexBasis: "auto"}}
						>
							<Link href="https://forum.pritunl.com">
								Forum
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							style={{flexGrow: 1, flexBasis: "auto"}}
						>
							<Link href="https://docs.pritunl.com/boot">
								Documentation
							</Link>
						</Button>
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

export default Register
