import { useState, useEffect } from "react"
import logo from "./assets/logo.png"
import * as Router from "./router"
import {
	Box, Container,
	Heading, Flex,
	Text, TextArea,
	Button, TextField,
	AlertDialog,
} from "@radix-ui/themes"

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

function Manage() {
	const { params } = Router.useRouter()
	const bootId = params.bootId

	const [_disabled, _setDisabled] = useState(false)
	const [errorMsg, setErrorMsg] = useState("")
	const [ipxeConf, setIpxeConf] = useState("")
	const [_data, setData] = useState({} as Data)

	let baseUrl: string
	baseUrl = "https://boot.pritunl.com"

	useEffect(() => {
		fetch(`/${bootId}/data`)
			.then(async (res) => {
				const data = await res.json() as Data
				if (!res.ok) {
					setErrorMsg(data.error || "Unknown error")
				} else {
					setData(data)
					setIpxeConf(data.ipxe)
				}
			})
			.catch((error) => {
				setIpxeConf(`Error: ${error}`)
			})
	}, [bootId])

	return (
		<Box>
			<Container align="center" size="1">
				<Flex
					direction="column"
					gap="3"
					maxWidth="400px"
					style={{
						margin: "30px 0 30px 0",
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
