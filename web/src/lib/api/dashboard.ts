import { apiFetch } from "@/lib/api-client"
import type { DashboardStats } from "./types"

export function getDashboardStats() {
  return apiFetch<DashboardStats>("/dashboard/stats")
}
