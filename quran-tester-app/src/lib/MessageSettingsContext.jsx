import { createContext, useContext, useMemo } from 'react'

const MessageSettingsContext = createContext({
  sheikhName: '',
  masjidName: '',
})

export function MessageSettingsProvider({ user, children }) {
  const value = useMemo(() => ({
    sheikhName: user?.sheikh_name || '',
    masjidName: user?.masjid_name || '',
  }), [user?.sheikh_name, user?.masjid_name])

  return (
    <MessageSettingsContext.Provider value={value}>
      {children}
    </MessageSettingsContext.Provider>
  )
}

export function useMessageSettings() {
  return useContext(MessageSettingsContext)
}
