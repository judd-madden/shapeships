export function clearAncientBlackHoleTargetSelection<
  TWorkflow extends {
    key: string;
    stage: string;
    selectorMode: string | null;
    blackHoleSelectedTargetInstanceIds: string[];
  }
>(workflow: TWorkflow | null, workflowKey: string): TWorkflow | null {
  if (
    workflow?.key !== workflowKey ||
    workflow.selectorMode !== 'blackHole' ||
    workflow.stage !== 'powers' ||
    workflow.blackHoleSelectedTargetInstanceIds.length === 0
  ) {
    return workflow;
  }
  return {
    ...workflow,
    blackHoleSelectedTargetInstanceIds: [],
  };
}
