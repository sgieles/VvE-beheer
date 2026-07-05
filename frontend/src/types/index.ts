export type Role = 'platform_admin' | 'beheerder' | 'eigenaar'
export type ContributionFrequency = 'monthly' | 'quarterly'

export interface VvE {
  id: number
  name: string
  address?: string
  kvk_number?: string
  contribution_frequency: ContributionFrequency
  share_denominator: number
  is_active: boolean
  created_at: string
}

export interface Appartement {
  id: number
  vve_id: number
  naam: string
  nummer?: string
  eigenaar_naam?: string
  aandeel: string
  is_active: boolean
  created_at: string
}

export interface User {
  id: number
  vve_id?: number
  username: string
  email: string
  full_name?: string
  role: Role
  aandeel?: string
  appartement_nummer?: string
  address?: string
  is_active: boolean
  created_at: string
  vve?: VvE
}

export interface MJOPUpload {
  id: number
  vve_id: number
  original_filename: string
  status: 'processing' | 'active' | 'archived'
  uploaded_at: string
}

export interface MJOPItem {
  id: number
  vve_id: number
  mjop_upload_id: number
  description: string
  category?: string
  planned_year: number
  planned_quarter?: number
  planned_amount: string
  actual_amount?: string
  status: 'planned' | 'quoted' | 'approved' | 'completed' | 'cancelled'
  manually_adjusted: boolean
  notes?: string
  quotes: Quote[]
}

export interface Quote {
  id: number
  vve_id: number
  mjop_item_id: number
  supplier_name: string
  quoted_amount: string
  document_path?: string
  notes?: string
  is_approved: boolean
  approved_at?: string
  final_amount?: string
  created_at: string
}

export interface ReserveFondsEntry {
  id: number
  vve_id: number
  entry_date: string
  amount: string
  description?: string
  created_at: string
}

export interface ContributionPlan {
  id: number
  vve_id: number
  amount_per_period: string
  effective_from: string
  effective_to?: string
  notes?: string
  created_at: string
}

export interface ScenarioDeferral {
  item_id: number
  description: string
  original_year: number
  proposed_year: number
  amount: number
}

export interface ScenarioContributionIncrease {
  scenario_type: 'contribution_increase'
  description: string
  new_contribution_per_period: number
  increase_per_period: number
  increase_per_period_per_unit_aandeel: number
  impact_per_period_per_aandeel: number
  total_shortfall: number
  coverage_start_year: number
}

export interface ScenarioDeferActivity {
  scenario_type: 'defer_activity'
  description: string
  suggested_deferrals: ScenarioDeferral[]
  impact_per_period_per_aandeel: number
  total_shortfall: number
  coverage_start_year: number
}

export interface ScenarioOneTimeLevy {
  scenario_type: 'one_time_levy'
  description: string
  total_levy: number
  levy_per_full_aandeel: number
  per_member_breakdown: { aandeel: number; levy: number }[]
  impact_per_period_per_aandeel: number
  total_shortfall: number
  coverage_start_year: number
}

export type ScenarioResult = ScenarioContributionIncrease | ScenarioDeferActivity | ScenarioOneTimeLevy

export interface BijdragePerAppartement {
  id: number
  naam: string
  nummer?: string
  eigenaar_naam?: string
  aandeel: number
  bijdrage_per_periode: number
}

export interface BalanceRow {
  year: number
  costs: number
  contributions: number
  balance: number
  shortfall: number
}

export interface QuarterRow extends BalanceRow {
  quarter: number
  label: string
}

export interface RisicoItem {
  id: number
  description: string
  planned_year: number
  planned_quarter: number | null
  planned_amount: number
  tekort_in_jaar: number
  is_hoofdoorzaak: boolean
}

export interface FinancialDashboard {
  current_reservefonds_balance: number
  contribution_frequency: ContributionFrequency
  current_contribution_per_period: number
  share_denominator: number
  bijdrage_per_eenheid: number | null
  total_planned_costs_next_5_years: number
  total_planned_costs_next_10_years: number
  projected_balance_by_year: BalanceRow[]
  projected_balance_by_quarter: QuarterRow[]
  shortfalls: Array<{ year: number; shortfall: number }>
  vroege_waarschuwing: { jaar: number; verwacht_tekort: number } | null
  scenarios: ScenarioResult[]
  risico_items: RisicoItem[]
  bijdrage_per_appartement: BijdragePerAppartement[]
}

export interface ProposedShift {
  item_id: number
  description: string
  original_year: number
  original_quarter: number | null
  proposed_year: number
  proposed_quarter: number | null
  amount: number
}

export interface SmartPlanResult {
  proposed_shifts: ProposedShift[]
  new_cashflow: BalanceRow[]
  original_cashflow: BalanceRow[]
  shortfalls_resolved: boolean
  shortfalls_remaining: Array<{ year: number; shortfall: number }>
}

export interface Meeting {
  id: number
  vve_id: number
  title: string
  meeting_date: string
  location?: string
  teams_url?: string
  status: 'planned' | 'in_progress' | 'completed'
  created_at: string
}

export interface AgendaItem {
  id: number
  vve_id: number
  meeting_id?: number
  submitted_by_id: number
  title: string
  description?: string
  submitted_at: string
  is_included: boolean
  order_index?: number
}

export interface MeetingMinutes {
  id: number
  vve_id: number
  meeting_id: number
  content?: string
  document_path?: string
  uploaded_at: string
  uploaded_by_id: number
  is_approved: boolean
  approved_at?: string
  approved_by_id?: number
}
