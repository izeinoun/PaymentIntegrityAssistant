// Turn a guidance next_action (or a cockpit action button) into an unambiguous
// natural-language instruction for the agent. Bare labels like "Start review"
// read as navigation ("show me the case"); these spell out the state change so
// the agent proposes the right confirm_action write instead of looping on
// present_view.
// A cockpit pill click, dispatched up to AssistantChat which executes it inline
// (collecting any needed amount/reason via the chat input).
export interface CockpitActionReq {
  kind: string
  caseId: number
  caseUuid?: string | null
  findingId?: string
  label: string
  claimTotal?: number | null
}

export function instructionForAction(kind: string, label: string): string {
  switch (kind) {
    case 'take_ownership':
      return 'Take ownership of this case — assign it to me.'
    case 'start_review':
      return 'Start the review on this case — change its status to in_review.'
    case 'submit_decision':
      return 'I want to submit a decision on this case (recoup or not-for-recoup).'
    case 'supervisor_decision':
      return 'I want to approve or reject the held decision on this case.'
    case 'record_recovery':
      return 'Record a recovery payment on this case.'
    case 'adjudicate_without_837':
      return 'Adjudicate this case without the 837 and move it forward.'
    case 'disposition_finding':
      return `${label} — then help me accept, reject, or adjust it.`
    default:
      return label
  }
}
