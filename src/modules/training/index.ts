export {
  applyPatch,
  diffPrograms,
  formatScheme,
  PatchError,
  programPatchSchema,
} from './patch'
export type {
  ProgramDiffLine,
  ProgramPatch,
  ProgramPatchOp,
  ProgramTree,
  ProgramTreeDay,
  ProgramTreeExercise,
} from './patch'

export {
  applyProgramPatchAs,
  archiveProgram,
  copyTemplateToClient,
  getActiveProgram,
  getProgramAuthorKinds,
  getProgramTree,
  getClientEditStatus,
  listUnseenClientEdits,
  listProgramChanges,
  markClientEditSeen,
} from './programs'
export type { ChangeActorKind, ClientEditStatus, ProgramChangeView } from './programs'

export {
  applyProgramWeights,
  estimateWeightsForClient,
  fillProgramWeightsFromProfile,
  loadWeightHints,
  programExerciseHints,
  lastWorkingWeights,
  programWeightStats,
  resolvePlanWeights,
  toStartWeightProfile,
} from './weights'
export type { ProgramExerciseHint, WeightHint } from './weights'

export { estimateDayMinutes } from './duration'
export { adjustWarmupForPain, resolveDayFocus, warmupSeconds } from './warmup'
export {
  archiveWarmupTemplate,
  getWarmupFor,
  listWarmupTemplates,
  saveWarmupTemplate,
} from './warmups'
export type { WarmupTemplateInput } from './warmups'
export type { DayFocus, WarmupFocus, WarmupItem, WarmupStatus, WarmupTemplate } from './schema'
export type { DurationDay } from './duration'

export { pickWorkoutDay } from './day-choice'
export type { DayChoice } from './day-choice'

export {
  allocateTemplateNumber,
  archiveTemplate,
  AUDIENCE_LABELS,
  createTemplate,
  GOAL_LABELS,
  listTemplateItems,
  listTemplates,
  replaceTemplateDays,
  templateMeta,
  templateTitle,
  updateTemplateMeta,
} from './templates'
export type {
  CreateTemplateInput,
  ProgramAudience,
  ProgramGoal,
  TemplateDayInput,
  TemplateListItem,
} from './templates'

export {
  finishSession,
  countFinishedSessionsSince,
  getExerciseProgress,
  getHistoryForExercise,
  getLastFinishedDayId,
  getOngoingSession,
  getLastWorkoutDates,
  getNextWeight,
  getRecommendations,
  getSessionDetail,
  getSessionSummary,
  getTrainedExercises,
  getWeekWorkoutDays,
  getWeeklyVolume,
  listOngoingSessions,
  listSessions,
  setExerciseFeeling,
  setNextWeight,
  startSession,
  syncSets,
} from './sessions'
export type {
  DayRecommendation,
  ExerciseProgressPoint,
  HistorySession,
  OngoingSession,
  SessionDetail,
  SessionSummary,
  SyncSetItem,
} from './sessions'

export {
  assignTemplate,
  revertChange,
  REVERT_CONFLICT,
  saveAsTemplate,
} from './revert'

export {
  aiProposals,
  nextWeights,
  programChanges,
  programDays,
  programExercises,
  programs,
  setLogs,
  workoutSessions,
} from './schema'
export type {
  AuthorKind,
  Feeling,
  Program,
  ProgramChange,
  ProgramExerciseRow,
  ProgramStatus,
  ProposalKind,
  ProposalStatus,
  SetLog,
  WorkoutMode,
  WorkoutSession,
} from './schema'
