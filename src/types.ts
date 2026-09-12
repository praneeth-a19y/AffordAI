export interface RequestItem {
  request_id: string;
  user_id: string;
  request_date: string;
  request_type: string;
  requested_amount: string | number;
  desired_completion_date: string;
  allows_partial_payment: string | boolean;
  request_text: string;
}

export interface PredictionOutput {
  request_id: string;
  amount_safe_to_pay: string | number;
  affordability_status: 'affordable_now' | 'affordable_with_plan' | 'affordable_later' | 'not_affordable' | string;
  recommended_payment_method: 'full_payment' | 'partial_payment' | 'installments' | 'wait' | 'not_recommended' | string;
  payment_plan: string;
  earliest_date_for_full_payment: string;
  spending_changes_needed: string;
  decision_explanation: string;
}

export interface UserProfile {
  user_id: string;
  home_currency: string;
  available_balance: string | number;
  minimum_balance_to_keep: string | number;
  financial_priorities: string;
  spending_preferences: string;
  payment_methods_user_will_consider: string;
}

export interface FinancialEvent {
  event_id: string;
  user_id: string;
  event_type: 'income' | 'expense';
  is_recurring: string | boolean;
  recurrence_interval_days: string | number;
  is_flexible: string | boolean;
  is_essential: string | boolean;
  status: string;
  amount: string | number;
  currency: string;
  event_date: string;
  description: string;
}

export interface PaymentOption {
  payment_option_id: string;
  request_id: string;
  payment_type: string;
  number_of_payments: string | number;
  days_between_payments: string | number;
  first_payment_date: string;
  payment_amount: string | number;
  financing_fee: string | number;
  total_payable: string | number;
}

export interface SimulationDay {
  day: number;
  date: string;
  balance: number;
  minRequired: number;
}

export interface TimelineEventItem {
  day: number;
  date: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  isFlexible: boolean;
}

export interface SimulationResult {
  amountSafeToPay: number;
  earliestDateForFull: string;
  minHeadroom: number;
  baselineBalances: SimulationDay[];
  fullPaymentTrajectory: number[];
  installmentTrajectory: number[];
  timelineEvents: TimelineEventItem[];
  userProfile: UserProfile;
  allowedMethods: string[];
  options: PaymentOption[];
}

export interface AIAdvisorResponse {
  advice: string;
  riskLevel?: 'Low' | 'Moderate' | 'High';
  financialScore?: number;
  keyFactors?: string[];
  budgetingTips?: string[];
}
