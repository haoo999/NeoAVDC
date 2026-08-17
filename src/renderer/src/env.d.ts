/// <reference types="vite/client" />
import type { NeoApi } from '../../shared/types'

declare global {
  interface Window {
    neoavdc?: NeoApi
  }
}

export {}
