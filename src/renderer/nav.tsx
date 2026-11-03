import { createContext, useContext, useMemo, useState } from 'react'

export type Screen = 'welcome' | 'signin' | 'review' | 'run' | 'choice' | 'history' | 'settings'

type Nav = { screen: Screen; go: (s: Screen) => void }

const NavContext = createContext<Nav | null>(null)

export function NavProvider(props: {
  initial: Screen
  children: React.ReactNode
}): React.JSX.Element {
  const [screen, go] = useState<Screen>(props.initial)
  const value = useMemo(() => ({ screen, go }), [screen])
  return <NavContext.Provider value={value}>{props.children}</NavContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNav(): Nav {
  const nav = useContext(NavContext)
  if (!nav) throw new Error('useNav must be used inside NavProvider')
  return nav
}
