import * as React from "react"

interface RouterContextType {
	path: string
	navigate: (path: string) => void
	params: Record<string, string>
	setParams?: (params: Record<string, string>) => void
}

const RouterContext = React.createContext<RouterContextType | null>(null)

export const useRouter = () => {
	const context = React.useContext(RouterContext)
	if (!context) {
		throw new Error("useRouter must be used within RouterProvider")
	}
	return context
}

interface RouterProviderProps {
	children: React.ReactNode
}

export const RouterProvider = ({children}: RouterProviderProps) => {
	const [path, setPath] = React.useState(window.location.pathname)
	const [params, setParams] = React.useState<Record<string, string>>({})

	const navigate = (newPath: string) => {
		window.history.pushState(null, "", newPath)
		setPath(newPath)
		setParams({})
	}

	React.useEffect(() => {
		const handlePopState = () => {
			setPath(window.location.pathname)
			setParams({})
		}

		window.addEventListener("popstate", handlePopState)
		return () => window.removeEventListener("popstate", handlePopState)
	}, [])

	return (
		<RouterContext.Provider value={{path, navigate, params, setParams}}>
			{children}
		</RouterContext.Provider>
	)
}

interface RouteProps {
	path: string
	children: React.ReactNode
	exact?: boolean
}

const matchPath = (pattern: string, currentPath: string, exact: boolean): {
	match: boolean, params: Record<string, string>} => {

	const params: Record<string, string> = {}

	const patternParts = pattern.split('/').filter(p => p)
	const currentParts = currentPath.split('/').filter(p => p)

	if (exact && patternParts.length !== currentParts.length) {
		return {match: false, params: {}}
	}

	if (!exact && currentParts.length < patternParts.length) {
		return {match: false, params: {}}
	}

	for (let i = 0; i < patternParts.length; i++) {
		const patternPart = patternParts[i]
		const currentPart = currentParts[i]

		if (patternPart.startsWith('<') && patternPart.endsWith('>')) {
			const paramName = patternPart.slice(1, -1)
			params[paramName] = currentPart
		} else if (patternPart !== currentPart) {
			return {match: false, params: {}}
		}
	}

	return {match: true, params}
}

export const Route = ({path, children, exact = false}: RouteProps) => {
	const context = React.useContext(RouterContext)

	if (!context) {
		throw new Error("Route must be used within RouterProvider")
	}

	const {match, params} = matchPath(path, context.path, exact)

	React.useEffect(() => {
		if (match && context.setParams) {
			context.setParams(params)
		}
	}, [match, JSON.stringify(params)])

	return match ? <>{children}</> : null
}

interface LinkProps {
	to: string
	children: React.ReactNode
	className?: string
	style?: React.CSSProperties
}

export const Link = ({to, children, className, style}: LinkProps) => {
	const { navigate } = useRouter()

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault()
		navigate(to)
	}

	return (
		<a href={to} onClick={handleClick} className={className} style={style}>
			{children}
		</a>
	)
}
