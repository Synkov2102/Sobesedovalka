import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { fetchHealth } from '../api/health'
import { createTask, deleteTask, fetchTasks } from '../api/tasks'
import type { HealthPayload, Task } from '../types/api.types'

export function useBackendDemo() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshHealth = useCallback(async () => {
    setHealthError(null)
    try {
      setHealth(await fetchHealth())
    } catch {
      setHealth(null)
      setHealthError('API unreachable — start the backend (port 3000).')
    }
  }, [])

  const refreshTasks = useCallback(async () => {
    setTasksError(null)
    try {
      setTasks(await fetchTasks())
    } catch {
      setTasks([])
      setTasksError('Failed to load tasks.')
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
    void refreshTasks()
  }, [refreshHealth, refreshTasks])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t || busy) {
      return
    }
    setBusy(true)
    setTasksError(null)
    try {
      await createTask(t)
      setTitle('')
      await refreshTasks()
    } catch {
      setTasksError('Failed to save task.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (busy) {
      return
    }
    setBusy(true)
    setTasksError(null)
    try {
      await deleteTask(id)
      await refreshTasks()
    } catch {
      setTasksError('Failed to delete.')
    } finally {
      setBusy(false)
    }
  }

  return {
    health,
    healthError,
    tasks,
    tasksError,
    title,
    setTitle,
    busy,
    refreshHealth,
    refreshTasks,
    handleAdd,
    handleDelete,
  }
}
