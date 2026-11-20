export {
  isSummarySettled,
  type NotificationChannel,
  NotificationChannelSchema,
  type NotificationEvent,
  NotificationEventSchema,
  type ReleaseEvent,
  releaseEventFor,
} from "./domain/events";
export {
  type PlannedNotification,
  planReleaseNotifications,
  type ReleaseCandidate,
} from "./domain/plan";
export {
  canSwitch,
  CHANNELS,
  enabledByDefault,
  EXTERNAL_CHANNELS,
  isEnabled,
  isExternal,
  LIVE_CHANNELS,
  LIVE_EVENTS,
  type Preference,
  wantsEvent,
} from "./domain/preferences";
export type { SaveVault, VaultSaved } from "./domain/saving";
