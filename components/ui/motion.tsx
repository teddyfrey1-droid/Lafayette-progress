"use client"

import * as React from "react"

/**
 * Lightweight motion wrappers.
 *
 * The project previously used `MotionDiv` for subtle enter animations, but the
 * `framer-motion` dependency is not installed. To avoid breaking builds, we
 * provide no-op wrappers that accept the same props and render plain elements.
 */

type MotionLikeProps<T> = React.HTMLAttributes<T> & {
  // Compatibility props (ignored)
  initial?: unknown
  animate?: unknown
  exit?: unknown
  transition?: unknown
}

export const MotionDiv = React.forwardRef<HTMLDivElement, MotionLikeProps<HTMLDivElement>>(
  ({ initial, animate, exit, transition, ...props }, ref) => <div ref={ref} {...props} />
)
MotionDiv.displayName = "MotionDiv"
