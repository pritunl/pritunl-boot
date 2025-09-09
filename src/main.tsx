import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Theme } from "@radix-ui/themes"
import "@radix-ui/themes/styles.css"
import "./index.css"
import Register from "./Register.tsx"
import Manage from "./Manage.tsx"
import * as Router from "./router"

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Theme accentColor="yellow" grayColor="sand" appearance="dark">
			<Router.RouterProvider>
				<Router.Route path="/" exact>
					<Register/>
				</Router.Route>
				<Router.Route path="/<bootId>/manage">
					<Manage/>
				</Router.Route>
			</Router.RouterProvider>
		</Theme>
	</StrictMode>,
)
