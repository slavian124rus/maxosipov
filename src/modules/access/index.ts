export { addDays, addMonthsClamped } from './dates'

export { computeAccess } from './compute'
export type { AccessState, SubscriptionRow } from './compute'

export {
  disable,
  expireSubscriptions,
  freeze,
  getAccessForUser,
  grant,
  startTrialIfEligible,
  unfreeze,
} from './service'
export type { GrantInput } from './service'

export { subscriptionEvents, subscriptions, trialRegistry } from './schema'
export type {
  SubscriptionEvent,
  SubscriptionEventType,
  SubscriptionStatus,
  TrialRegistryRow,
} from './schema'

export { accessSettingsSchema, updateAccessSettings } from './settings'
export type { AccessSettingsInput } from './settings'



export { assertClientAccess, NO_ACCESS_MESSAGE } from './client-access'
