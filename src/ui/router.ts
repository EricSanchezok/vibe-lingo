export type DashboardView =
  | "overview"
  | "review"
  | "patterns"
  | "pattern"
  | "journey"
  | "record"
  | "translations"
  | "settings"

export type DashboardRoute = {
  view: DashboardView
  patternKey?: string
  eventId?: string
  reviewId?: string
}

const VIEWS = new Set<DashboardView>([
  "overview",
  "review",
  "patterns",
  "pattern",
  "journey",
  "record",
  "translations",
  "settings",
])
const PATTERN_KEY = /^[a-z][a-z0-9_]{2,63}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseDashboardRoute(search: string): DashboardRoute {
  const params = new URLSearchParams(search)
  const requested = params.get("view")
  const view = requested && VIEWS.has(requested as DashboardView)
    ? requested as DashboardView
    : "overview"
  if (view === "pattern") {
    const patternKey = params.get("pattern") ?? ""
    return PATTERN_KEY.test(patternKey)
      ? { view, patternKey }
      : { view: "patterns" }
  }
  if (view === "record") {
    const eventId = params.get("event") ?? ""
    return UUID.test(eventId)
      ? { view, eventId }
      : { view: "journey" }
  }
  if (view === "review") {
    const reviewId = params.get("review") ?? undefined
    return reviewId && UUID.test(reviewId) ? { view, reviewId } : { view }
  }
  return { view }
}

export function routeParams(route: DashboardRoute): Record<string, string> {
  const params: Record<string, string> = { view: route.view }
  if (route.patternKey) params.pattern = route.patternKey
  if (route.eventId) params.event = route.eventId
  if (route.reviewId) params.review = route.reviewId
  return params
}
