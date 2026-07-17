import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LightbulbOutlineRoundedIcon from '@mui/icons-material/LightbulbOutlineRounded'
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { fetchRoomSolution } from '../api/taskPresets'
import type { RoomSolutionResponse } from '../types/api.types'

type PlaygroundSolutionPanelProps = {
  roomId: string
}

export function PlaygroundSolutionPanel({
  roomId,
}: PlaygroundSolutionPanelProps) {
  const theme = useTheme()
  const [solution, setSolution] = useState<RoomSolutionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [activePath, setActivePath] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchRoomSolution(roomId)
        if (!alive) {
          return
        }
        const paths = Object.keys(data?.solutionFiles ?? {})
        if (!data || paths.length === 0) {
          setSolution(null)
          return
        }
        setSolution(data)
        setActivePath(paths.sort((a, b) => a.localeCompare(b))[0] ?? null)
      } catch {
        if (alive) {
          setSolution(null)
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [roomId])

  const paths = useMemo(() => {
    if (!solution) {
      return []
    }
    return Object.keys(solution.solutionFiles).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [solution])

  if (loading || !solution || paths.length === 0) {
    return null
  }

  const activeContent =
    activePath && solution.solutionFiles[activePath] !== undefined
      ? solution.solutionFiles[activePath]
      : ''

  return (
    <>
      <Button
        variant="outlined"
        color="secondary"
        size="small"
        onClick={() => setOpen(true)}
        startIcon={<LightbulbOutlineRoundedIcon />}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 5,
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.background.paper, 0.92),
        }}
      >
        Решение
      </Button>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 420, md: 520 },
              maxWidth: '100%',
              bgcolor: 'background.paper',
            },
          },
        }}
      >
        <Stack sx={{ height: '100%', minHeight: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Решение
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {solution.title}
              </Typography>
            </Box>
            <IconButton
              aria-label="Закрыть"
              onClick={() => setOpen(false)}
              size="small"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ flex: 1, minHeight: 0 }}
          >
            <List
              dense
              sx={{
                width: { xs: '100%', sm: 180 },
                flexShrink: 0,
                borderRight: {
                  sm: `1px solid ${theme.palette.divider}`,
                },
                borderBottom: {
                  xs: `1px solid ${theme.palette.divider}`,
                  sm: 0,
                },
                maxHeight: { xs: 160, sm: 'none' },
                overflow: 'auto',
                py: 0.5,
              }}
            >
              {paths.map((path) => (
                <ListItemButton
                  key={path}
                  selected={path === activePath}
                  onClick={() => setActivePath(path)}
                >
                  <ListItemText
                    primary={path}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Consolas, monospace',
                        fontSize: '0.75rem',
                        wordBreak: 'break-all',
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
            <Box
              component="pre"
              sx={{
                flex: 1,
                m: 0,
                p: 2,
                overflow: 'auto',
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                bgcolor: alpha(theme.palette.common.black, 0.2),
              }}
            >
              {activeContent}
            </Box>
          </Stack>
        </Stack>
      </Drawer>
    </>
  )
}
