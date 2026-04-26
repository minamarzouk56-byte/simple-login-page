"use client"

import * as React from "react"
import { Direction } from "radix-ui"

interface DirectionProviderProps {
  direction: "ltr" | "rtl"
  children: React.ReactNode
}

function DirectionProvider({ direction, children }: DirectionProviderProps) {
  // هنا بنعطي الـ Radix Provider الـ dir الصح
  return (
    <Direction.DirectionProvider dir={direction}>
      {children}
    </Direction.DirectionProvider>
  )
}

const useDirection = Direction.useDirection

export { DirectionProvider, useDirection }