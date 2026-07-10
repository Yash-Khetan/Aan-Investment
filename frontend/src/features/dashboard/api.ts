import { apiRequest } from "../../lib/api";
import type { DashboardSummary } from "./types";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary");
}
