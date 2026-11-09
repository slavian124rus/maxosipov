export { aiConversations, aiMessages, aiUsageDaily } from './schema'
export type { AiConversation, AiFlag, AiMessage, AiRole, AiUsageDailyRow } from './schema'

export { COACH_CONVERSATION_HEADER, getChatHistory, handleChatMessage, LIMIT_REPLY, UNAVAILABLE_REPLY } from './chat'
export type { ChatDeps, ChatHistory } from './chat'

export { acceptProposal, listProposalCards, listProposals, rejectProposal } from './proposals'
export type { DraftProgramPayload, ProposalCard, ProposalLine, ProposalView } from './proposals'

export { detectFlag, PAIN_REPLY } from './flags'
export type { PainFlag } from './flags'

export { buildContextBlock, loadContextData } from './context'
export type { CatalogEntry, ContextData } from './context'

export { buildSystemPrompt, SYSTEM_PROMPT_TEMPLATE } from './prompt'

export { createCoachTools } from './tools'
export type { CoachToolContext } from './tools'

export { AiUnavailableError, getModel, getModelName, withFallback } from './provider'
export type { ModelKind } from './provider'

export { costRubFor, getTodayUsage, isOverLimit, recordUsage } from './usage'
export type { UsageDeps, UsageInput } from './usage'

export {
  buildSummaryInput,
  getSessionAiSummary,
  SUMMARY_LIMIT,
  summarizeSession,
  trimToWord,
} from './summary'
export type { SummaryExercise, SummarySession } from './summary'

export { parseVoiceLog } from './voice'
export type { VoiceDeps, VoiceParseResult, VoiceRow } from './voice'

export { getSpeechToText } from './stt'
export type { AudioFile, SpeechToText } from './stt'

export { draftExerciseText } from './exercise-draft'
export type { ExerciseDraft, ExerciseDraftInput } from './exercise-draft'
