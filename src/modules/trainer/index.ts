export { getClientCard, listClients } from './clients'
export type { ClientCard, ClientFilter, ClientListItem, ClientSessionItem } from './clients'

export { addNote, listNotes, listVisibleNotes } from './notes'
export { trainerNotes } from './schema'
export type { TrainerNote } from './schema'

export { getTrainerFeed } from './feed'
export type { ClientRef, FlagItem, SubItem, TrainerFeed } from './feed'

export { getStats } from './stats'
export type { TrainerStats } from './stats'

// Лента и карточка клиента отмечают жалобы и предложения — через публичный API coach-ai.
export { markProposalSeen, resolveFlag } from '@/modules/coach-ai'
