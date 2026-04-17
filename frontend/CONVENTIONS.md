# Фронтенд: соглашения по стилю и структуре

Гайд для React + Vite + TypeScript. Должен совпадать по духу с `backend/CONVENTIONS.md`.

## Структура `src/`

| Папка | Назначение |
|--------|------------|
| `api/` | Вызовы HTTP: маленькие функции (`fetchTasks`, `fetchHealth`), без UI-состояния. Общий префикс — `api/constants.ts`. |
| `types/` | Доменные типы, общие для UI и API (`Task`, ответы бэкенда). |
| `hooks/` | Переиспользуемая логика с `useState` / `useEffect` (например `useBackendDemo`). |
| `components/` | Компоненты и их CSS; по возможности одна ответственность на файл. |
| `collab/` | Типы и утилиты коллаборации (`collab.types.ts`, курсор Sandpack). |

Коллаб-типы именуем как на бэкенде: **`collab.types.ts`**, не `collabTypes.ts`.

## TypeScript

- **`strict: true`** (уже в `tsconfig.app.json`).
- **`import type`** для тип-only импортов; ESLint: `consistent-type-imports`.
- Граница с сетью: после `res.json()` — явное приведение к ожидаемому типу или (при росте проекта) схема Zod.

## Стили и ESLint

- **Prettier** — единый формат; настройки в `.prettierrc` (в т.ч. `semi: false` под текущий стиль проекта).
- **ESLint** + `typescript-eslint` **recommendedTypeChecked** + **react-hooks** + **react-refresh** + **prettier**.
- Асинхронные обработчики в JSX: оборачивать в `void fn()` или отдельную функцию, чтобы не нарушать `no-misused-promises` (для событий с `checksVoidReturn.attributes: false`).

## React

- Тяжёлые экраны — **`lazy` + `Suspense`** (как `Playground`).
- Состояние страницы и побочные эффекты для API — в **хуках**, UI-компонент остаётся «тонким».
- Стабильные объекты в пропсах провайдеров (Sandpack и т.д.) — **`useMemo`**, чтобы не сбрасывать внутреннее состояние при ре-рендере родителя.

## Именование

- Файлы: **`kebab-case`** для типов и API (`api.types.ts`); хуки — **`useThing.ts`** (`useBackendDemo.ts`); компоненты — см. ниже.
- Компоненты: **`PascalCase.tsx`**.

## Согласование с API

- Лимиты полей (например `maxLength` инпута) держать в соответствии с DTO на бэкенде.

---

При новой фиче: типы → функции в `api/` → хук при необходимости → компонент.
