"use client"

import * as React from "react"
import { ToastActionElement } from "@/components/ui/toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  DELETE_TOAST: "DELETE_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type BaseAction = {
  type: (typeof actionTypes)[keyof typeof actionTypes]
}

type AddToastAction = BaseAction & {
  type: typeof actionTypes.ADD_TOAST
  toast: ToasterToast
}

type DeleteToastAction = BaseAction & {
  type: typeof actionTypes.DELETE_TOAST
  toastId?: string
}

type UpdateToastAction = BaseAction & {
  type: typeof actionTypes.UPDATE_TOAST
  toast: Partial<ToasterToast>
}

type DismissToastAction = BaseAction & {
  type: typeof actionTypes.DISMISS_TOAST
  toastId?: string
}

type RemoveToastAction = BaseAction & {
  type: typeof actionTypes.REMOVE_TOAST
  toastId?: string
}

type Action =
  | AddToastAction
  | DeleteToastAction
  | UpdateToastAction
  | DismissToastAction
  | RemoveToastAction

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
let currentDispatch: ((action: Action) => void) | null = null
const pendingActions: Action[] = []

function setDispatch(dispatch: (action: Action) => void) {
  currentDispatch = dispatch
  if (pendingActions.length) {
    const queued = pendingActions.splice(0, pendingActions.length)
    queued.forEach((action) => dispatch(action))
  }
}

function dispatchAction(action: Action) {
  if (currentDispatch) {
    currentDispatch(action)
  } else {
    pendingActions.push(action)
  }
}

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatchAction({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "DELETE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || !toastId
            ? { ...t, open: false }
            : t
        ),
      }
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

type ToastInput = Omit<ToasterToast, "id"> & {
  message?: string
}

function toast({ ...props }: ToastInput) {
  const id = genId()

  const update = (props: Partial<ToasterToast>) =>
    dispatchAction({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatchAction({ type: "DISMISS_TOAST", toastId: id })

  dispatchAction({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] })

  React.useEffect(() => {
    setDispatch(dispatch)
  }, [dispatch])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
