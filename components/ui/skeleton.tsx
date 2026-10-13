import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      style={style}
      aria-hidden
      {...props}
    />
  )
}

export { Skeleton }
