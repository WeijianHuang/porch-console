/**
 * Recommended 8-step decision-chain template (ADR-0012 / design/12 §3).
 *
 * This is a pure frontend default: it is copied into the editable draft only
 * when the operator explicitly clicks "load defaults", then published through
 * the normal `PUT /scheduling/rules` endpoint. It never writes to the server
 * on its own and carries no site/executor/queue-specific ID, so it is safe for
 * any site (DA-01: no entity graph, no network in pure helpers).
 *
 * Field values follow the engine's step semantics:
 *   - order 1..8, site scope, on_hit=hold (8 steps: first hit stops the chain).
 *   - assignment_method_allows_rotation maps only `rotational` to rotation.
 *   - overtime_no_rotation / the two cross-group steps set no_rotation=true,
 *     which is required for those steps to ever hit.
 *   - time_window stays null: per C-12/F-12 the product has no fixed time
 *     default; a window is optional and configured by the operator.
 */
import type { RuleInput, RuleType } from '../api/types'

export const DEFAULT_CHAIN_ORDER: RuleType[] = [
  'executor_stopped_rotation',
  'rotation_master_switch',
  'assignment_method_allows_rotation',
  'task_type_no_rotation',
  'overtime_no_rotation',
  'time_reserved',
  'group_a_to_b',
  'group_b_to_a',
]

/**
 * Return a fresh default chain. A new array of new objects is produced on
 * every call so callers can edit the draft without mutating a shared template.
 */
export function defaultRules(): RuleInput[] {
  return DEFAULT_CHAIN_ORDER.map((type, index) => ({
    type,
    order: index + 1,
    enabled: true,
    scope: 'site',
    scope_id: '',
    on_hit: 'hold',
    time_window: null,
    assignment_methods:
      type === 'assignment_method_allows_rotation' ? ['rotational'] : [],
    from_group: '',
    to_group: '',
    no_rotation:
      type === 'overtime_no_rotation' ||
      type === 'group_a_to_b' ||
      type === 'group_b_to_a',
  }))
}
