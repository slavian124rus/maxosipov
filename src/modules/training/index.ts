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
  createTemplate,
  getActiveProgram,
  getProgramTree,
  listTemplates,
} from './programs'
export type { ChangeActorKind } from './programs'

export {
  finishSession,
  getHistoryForExercise,
  getNextWeight,
  getRecommendations,
  getSessionDetail,
  getSessionSummary,
  listSessions,
  setExerciseFeeling,
  setNextWeight,
  startSession,
  syncSets,
} from './sessions'
export type {
  DayRecommendation,
  HistorySession,
  SessionDetail,
  SessionSummary,
  SyncSetItem,
} from './sessions'

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
  SetLog,
  WorkoutMode,
  WorkoutSession,
} from './schema'
