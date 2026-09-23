import { localPlanReconstruction } from './localPlanReconstruction';
import { remoteAIPlanReconstruction } from './remoteAIPlanReconstruction';
import type { PlanReconstructionService } from './types';

export * from './types';
export { localPlanReconstruction } from './localPlanReconstruction';
export { remoteAIPlanReconstruction, configureRemoteReconstruction, isRemoteReconstructionConfigured } from './remoteAIPlanReconstruction';

/** Service utilisé : distant uniquement s'il est explicitement configuré, sinon local. */
export function getReconstructionService(): PlanReconstructionService {
  return remoteAIPlanReconstruction.isAvailable() ? remoteAIPlanReconstruction : localPlanReconstruction;
}
