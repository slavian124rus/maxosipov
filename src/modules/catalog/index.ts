export { MUSCLES, isMuscleCode, muscleName, muscleView, svgLayerId } from './muscles'
export type { MuscleCode, MuscleDefinition, MuscleView } from './muscles'

export { muscles, machines, machineZones, exercises, exerciseAlternatives } from './schema'
export type {
  Exercise,
  ExerciseStatus,
  Machine,
  MachineZone,
  Muscle,
  NewExercise,
  NewMachine,
  NewMachineZone,
  LoadType,
  OverlayProfile,
} from './schema'

export { slugify } from './slug'

export { listAlternatives, setAlternatives, suggestAlternatives } from './alternatives'
export type { AlternativeItem } from './alternatives'

export {
  exerciseInputSchema,
  machineInputSchema,
} from './validation'
export type { ExerciseInput, MachineInput } from './validation'

export {
  archiveExercise,
  countMachineExercises,
  createExercise,
  createMachine,
  deleteMachine,
  getExercise,
  listExercises,
  listMachines,
  listMachinesWithPhotos,
  publishExercise,
  unpublishExercise,
  updateExercise,
  updateMachine,
} from './service'
export type {
  ExerciseDetail,
  ExerciseFilter,
  ExerciseListItem,
  GetExerciseOptions,
  MachineExerciseCount,
  MachineListItem,
} from './service'

export {
  createZone,
  deleteZone,
  ensureZone,
  listZoneNames,
  listZones,
  renameZone,
  syncMachineZones,
} from './zones'
export type { MachineZoneItem } from './zones'


