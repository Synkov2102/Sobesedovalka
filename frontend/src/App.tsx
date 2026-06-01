import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Box,
  Button,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useAuth } from './auth/useAuth'
import { AuthScreen } from './auth/AuthScreen'
import { AppBrandWordmark } from './components/AppBrandWordmark'
import { RoomsPanel } from './components/RoomsPanel'
import { PresetCreatePage } from './components/presets/PresetCreatePage'
import { PresetEditPage } from './components/presets/PresetEditPage'
import { PresetListPanel } from './components/presets/PresetListPanel'
import { appShellPageSx, editorFullScreenShellSx } from './theme/layout'
import type { AuthUser, MainTab } from './types/api.types'

const Playground = lazy(async () => {
  const m = await import('./components/Playground')
  return { default: m.Playground }
})

function readRoomIdFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('room')?.trim()
  return raw ? raw : null
}

function readMainTabFromUrl(): MainTab {
  const raw = new URLSearchParams(window.location.search).get('tab')
  if (raw === 'presets') {
    return 'presets'
  }
  return 'rooms'
}

function migratePresetFocusToCreateUrl(): void {
  const url = new URL(window.location.href)
  if (url.searchParams.get('presetFocus') !== 'create') {
    return
  }
  url.searchParams.delete('presetFocus')
  url.searchParams.set('tab', 'presets')
  url.searchParams.set('preset', 'new')
  window.history.replaceState({}, '', url.pathname + url.search)
}

type PresetEditorRoute = 'list' | 'create' | { mode: 'edit'; id: string }

function parsePresetEditorRoute(search: string): PresetEditorRoute {
  const raw = new URLSearchParams(search).get('preset')?.trim()
  if (!raw) {
    return 'list'
  }
  if (raw === 'new') {
    return 'create'
  }
  return { mode: 'edit', id: raw }
}

function normalizeLegacyUrlTabs(): void {
  const url = new URL(window.location.href)
  let changed = false
  if (url.searchParams.get('tab') === 'api') {
    url.searchParams.set('tab', 'rooms')
    changed = true
  }
  if (url.searchParams.get('tab') === 'playground') {
    url.searchParams.delete('tab')
    changed = true
  }
  if (changed) {
    window.history.replaceState({}, '', url.pathname + url.search)
  }
}

function replaceUrlForInvalidRoom() {
  const url = new URL(window.location.href)
  url.searchParams.delete('room')
  url.searchParams.set('tab', 'rooms')
  url.searchParams.delete('presetFocus')
  url.searchParams.delete('preset')
  window.history.replaceState({}, '', url.pathname + url.search)
}

type AppMainProps = {
  user: AuthUser
  logout: () => void
}

function AppMain({ user, logout }: AppMainProps) {
  const [navRevision, setNavRevision] = useState(() => {
    migratePresetFocusToCreateUrl()
    normalizeLegacyUrlTabs()
    return 0
  })

  const bumpNav = useCallback(() => {
    setNavRevision((n) => n + 1)
  }, [])

  useEffect(() => {
    const onPop = () => bumpNav()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [bumpNav])

  const mainTab = useMemo(() => {
    void navRevision
    return readMainTabFromUrl()
  }, [navRevision])

  const roomId = useMemo(() => {
    void navRevision
    return readRoomIdFromSearch(window.location.search)
  }, [navRevision])
  const isSandbox = Boolean(roomId)
  const presetEditorRoute = useMemo(() => {
    if (mainTab !== 'presets') {
      return 'list' as const
    }
    void navRevision
    return parsePresetEditorRoute(window.location.search)
  }, [mainTab, navRevision])
  const isPresetEditor = mainTab === 'presets' && presetEditorRoute !== 'list'
  const isFullScreenEditor = isSandbox || isPresetEditor

  const accountLabel =
    user.displayName ?? user.email ?? user.phone ?? user.id.slice(0, 8)

  const commitTab = useCallback(
    (next: MainTab) => {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', next)
      url.searchParams.delete('room')
      url.searchParams.delete('preset')
      window.history.pushState({}, '', url.pathname + url.search)
      bumpNav()
    },
    [bumpNav],
  )

  const navigateToPlaygroundRoom = useCallback(
    (id: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set('room', id)
      url.searchParams.delete('preset')
      window.history.pushState({}, '', url.pathname + url.search)
      bumpNav()
    },
    [bumpNav],
  )

  const exitSandboxToRooms = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.searchParams.set('tab', 'rooms')
    url.searchParams.delete('preset')
    window.history.pushState({}, '', url.pathname + url.search)
    bumpNav()
  }, [bumpNav])

  const onInvalidRoom = useCallback(() => {
    replaceUrlForInvalidRoom()
    bumpNav()
  }, [bumpNav])

  const openPresetCreate = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'presets')
    url.searchParams.set('preset', 'new')
    url.searchParams.delete('room')
    window.history.pushState({}, '', url.pathname + url.search)
    bumpNav()
  }, [bumpNav])

  const openPresetEdit = useCallback(
    (presetId: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', 'presets')
      url.searchParams.set('preset', presetId)
      url.searchParams.delete('room')
      window.history.pushState({}, '', url.pathname + url.search)
      bumpNav()
    },
    [bumpNav],
  )

  const openPresetList = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'presets')
    url.searchParams.delete('preset')
    url.searchParams.delete('room')
    window.history.pushState({}, '', url.pathname + url.search)
    bumpNav()
  }, [bumpNav])

  const goBrandHome = useCallback(() => {
    if (isSandbox) {
      exitSandboxToRooms()
      return
    }
    if (isPresetEditor) {
      openPresetList()
      return
    }
    if (mainTab !== 'rooms') {
      commitTab('rooms')
    }
  }, [
    isSandbox,
    isPresetEditor,
    exitSandboxToRooms,
    mainTab,
    commitTab,
    openPresetList,
  ])

  return (
    <Box
      className={
        isSandbox
          ? 'app--sandbox'
          : isPresetEditor
            ? 'app--preset-editor'
            : undefined
      }
      sx={{
        ...(isFullScreenEditor ? editorFullScreenShellSx : appShellPageSx),
      }}
    >
      <Box
        component="header"
        sx={{
          mb: isFullScreenEditor ? 1 : 2.5,
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 1,
          }}
        >
          <Stack
            component="nav"
            aria-label="Основная навигация"
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              minWidth: 0,
              rowGap: 1,
            }}
          >
            <AppBrandWordmark onNavigateHome={goBrandHome} />
            {isSandbox ? (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={exitSandboxToRooms}
              >
                К комнатам
              </Button>
            ) : isPresetEditor ? (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={openPresetList}
              >
                К списку пресетов
              </Button>
            ) : (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={mainTab}
                onChange={(_, value: MainTab | null) => {
                  if (value) {
                    commitTab(value)
                  }
                }}
                aria-label="Раздел приложения"
                sx={{
                  '& .MuiToggleButton-root': {
                    color: 'text.primary',
                    borderColor: 'divider',
                    px: 1.5,
                    '&:not(.Mui-selected):hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.06)',
                    },
                  },
                }}
              >
                <ToggleButton value="rooms">Комнаты</ToggleButton>
                <ToggleButton value="presets">Пресеты</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Stack>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              ml: { xs: 0, sm: 'auto' },
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {accountLabel}
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={() => logout()}
            >
              Выйти
            </Button>
          </Stack>
        </Stack>
      </Box>

      {isSandbox ? (
        <Paper
          component="section"
          aria-label="Редактор комнаты"
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            p: 0,
            bgcolor: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Suspense
              fallback={
                <Typography color="text.secondary">
                  Загрузка редактора…
                </Typography>
              }
            >
              <Playground
                key={roomId ?? 'none'}
                onInvalidExplicitRoom={onInvalidRoom}
              />
            </Suspense>
          </Box>
        </Paper>
      ) : mainTab === 'presets' ? (
        isPresetEditor ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {presetEditorRoute === 'create' ? (
              <PresetCreatePage onBackToList={openPresetList} />
            ) : (
              <PresetEditPage
                key={presetEditorRoute.id}
                presetId={presetEditorRoute.id}
                onBackToList={openPresetList}
              />
            )}
          </Box>
        ) : (
          <PresetListPanel
            onOpenCreate={openPresetCreate}
            onOpenEdit={openPresetEdit}
          />
        )
      ) : (
        <RoomsPanel onOpenRoom={navigateToPlaygroundRoom} />
      )}
    </Box>
  )
}

function App() {
  const { user, ready, logout } = useAuth()

  if (!ready) {
    return (
      <Box sx={appShellPageSx}>
        <Box component="header" sx={{ mb: 2 }}>
          <AppBrandWordmark />
        </Box>
        <Typography color="text.secondary">Загрузка сессии…</Typography>
      </Box>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <AppMain user={user} logout={logout} />
}

export default App
