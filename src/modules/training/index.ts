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
  getExerciseProgress,
  getHistoryForExercise,
  getLastFinishedDayId,
  getNextWeight,
  getRecommendations,
  getSessionDetail,
  getSessionSummary,
  getTrainedExercises,
  getWeekWorkoutDays,
  getWeeklyVolume,
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
