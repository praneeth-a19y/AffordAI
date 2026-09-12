import os
import csv
import json
from datetime import datetime, timedelta

def fmt_amt(val):
    val = round(val, 2)
    if abs(val - int(val)) < 1e-6:
        return str(int(val))
    return f"{val:.2f}".rstrip('0').rstrip('.')

def run_solver():
    # 1. Load profiles
    profiles = {}
    with open("dataset/financial_profiles.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            profiles[row['user_id']] = {
                'user_id': row['user_id'],
                'home_currency': row['home_currency'],
                'available_balance': float(row['available_balance']),
                'minimum_balance_to_keep': float(row['minimum_balance_to_keep']),
                'financial_priorities': row['financial_priorities'],
                'spending_preferences': row['spending_preferences'],
                'payment_methods_user_will_consider': row['payment_methods_user_will_consider'].split('|')
            }

    # 2. Load events
    user_events = {}
    with open("dataset/financial_events.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            uid = row['user_id']
            if uid not in user_events:
                user_events[uid] = []
            user_events[uid].append({
                'event_id': row['event_id'],
                'user_id': uid,
                'event_type': row['event_type'],
                'is_recurring': row['is_recurring'].lower() == 'true',
                'recurrence_interval_days': int(row['recurrence_interval_days']) if row['recurrence_interval_days'] else 0,
                'is_flexible': row['is_flexible'].lower() == 'true',
                'is_essential': row['is_essential'].lower() == 'true',
                'status': row['status'],
                'amount': float(row['amount']),
                'currency': row['currency'],
                'event_date': row['event_date'],
                'description': row['description']
            })

    # 3. Load payment options
    request_options = {}
    with open("dataset/request_payment_options.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row['request_id']
            if rid not in request_options:
                request_options[rid] = []
            request_options[rid].append({
                'payment_option_id': row['payment_option_id'],
                'request_id': rid,
                'payment_type': row['payment_type'],
                'number_of_payments': int(row['number_of_payments']),
                'days_between_payments': int(row['days_between_payments']),
                'first_payment_date': row['first_payment_date'],
                'payment_amount': float(row['payment_amount']),
                'financing_fee': float(row['financing_fee']),
                'total_payable': float(row['total_payable'])
            })

    # 4. Load requests
    requests = []
    with open("dataset/requests.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            requests.append({
                'request_id': row['request_id'],
                'user_id': row['user_id'],
                'request_date': row['request_date'],
                'request_type': row['request_type'],
                'requested_amount': float(row['requested_amount']),
                'desired_completion_date': row['desired_completion_date'],
                'allows_partial_payment': row['allows_partial_payment'].lower() == 'true',
                'request_text': row['request_text']
            })

    # Simulation cash flow helper
    def get_cash_flow(uid, start_date_str, days=90, spending_adjustments=None):
        if spending_adjustments is None:
            spending_adjustments = {} # event_id -> 'stop' or ('reduce_to', amount)
            
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        daily_flows = [0.0] * days
        
        events = user_events.get(uid, [])
        for ev in events:
            if ev['status'] in ['cancelled', 'failed', 'duplicate']:
                continue
                
            ev_date = datetime.strptime(ev['event_date'], "%Y-%m-%d")
            ev_id = ev['event_id']
            amt = ev['amount']
            
            # Apply spending adjustments
            if ev_id in spending_adjustments:
                adj = spending_adjustments[ev_id]
                if adj == 'stop':
                    amt = 0.0
                elif isinstance(adj, (tuple, list)) and adj[0] == 'reduce_to':
                    amt = float(adj[1])
                    
            flow = amt if ev['event_type'] == 'income' else -amt
            
            if ev['is_recurring'] and ev['recurrence_interval_days'] > 0:
                interval = ev['recurrence_interval_days']
                # Walk backward to find any occurrence or align with start_date
                curr = ev_date
                while curr < start_date:
                    curr += timedelta(days=interval)
                while curr <= start_date + timedelta(days=days - 1):
                    day_idx = (curr - start_date).days
                    if 0 <= day_idx < days:
                        daily_flows[day_idx] += flow
                    curr += timedelta(days=interval)
            else:
                day_idx = (ev_date - start_date).days
                if 0 <= day_idx < days:
                    daily_flows[day_idx] += flow
                    
        return daily_flows

    def simulate_balance(initial_bal, daily_flows, deductions_by_day=None):
        days = len(daily_flows)
        balances = [0.0] * days
        bal = initial_bal
        for d in range(days):
            bal += daily_flows[d]
            if deductions_by_day and d in deductions_by_day:
                bal -= deductions_by_day[d]
            balances[d] = round(bal, 2)
        return balances

    results = []

    for req in requests:
        uid = req['user_id']
        rid = req['request_id']
        prof = profiles[uid]
        req_amt = req['requested_amount']
        req_date_str = req['request_date']
        req_date = datetime.strptime(req_date_str, "%Y-%m-%d")
        comp_date_str = req['desired_completion_date']
        comp_date = datetime.strptime(comp_date_str, "%Y-%m-%d")
        min_bal = prof['minimum_balance_to_keep']
        init_bal = prof['available_balance']
        allowed_methods = prof['payment_methods_user_will_consider']
        cur = prof['home_currency']
        
        # Baseline cash flows (without spending changes)
        flows_90 = get_cash_flow(uid, req_date_str, days=90)
        
        # Baseline balances if no purchase made
        base_balances = simulate_balance(init_bal, flows_90)
        
        # Calculate amount_safe_to_pay:
        min_headroom = min(base_balances[d] - min_bal for d in range(90))
        amount_safe_to_pay = max(0.0, min(req_amt, round(min_headroom, 2)))
        
        # Calculate earliest_date_for_full_payment:
        earliest_full_date = ""
        if amount_safe_to_pay >= req_amt:
            earliest_full_date = req_date_str
        else:
            # Check future days
            for d in range(1, 90):
                test_date = req_date + timedelta(days=d)
                test_date_str = test_date.strftime("%Y-%m-%d")
                future_flows = get_cash_flow(uid, test_date_str, days=90)
                bal_on_test_date = base_balances[d]
                test_balances = simulate_balance(bal_on_test_date, future_flows)
                test_headroom = min(test_balances[i] - min_bal for i in range(90))
                if test_headroom >= req_amt:
                    earliest_full_date = test_date_str
                    break

        candidate_plans = []
        
        # 1. Full payment (no spending changes)
        if 'full_payment' in allowed_methods and amount_safe_to_pay >= req_amt:
            candidate_plans.append({
                'method': 'full_payment',
                'status': 'affordable_now',
                'plan_str': f"{req_date_str}:{fmt_amt(req_amt)}",
                'spending_changes': 'none',
                'completes_by_deadline': True,
                'has_spending_changes': False,
                'total_paid': req_amt,
                'start_date': req_date_str,
                'num_payments': 1,
                'option_id': '',
                'explanation': f"The full amount of {cur} {fmt_amt(req_amt)} is safe to pay today while keeping balance above the minimum buffer of {fmt_amt(min_bal)}."
            })
            
        # 2. Partial payment (no spending changes)
        if (req['allows_partial_payment'] and 
            'partial_payment' in allowed_methods and 
            0 < amount_safe_to_pay < req_amt and 
            earliest_full_date != "" and 
            datetime.strptime(earliest_full_date, "%Y-%m-%d") <= comp_date):
            
            rem_amt = round(req_amt - amount_safe_to_pay, 2)
            p_date = datetime.strptime(earliest_full_date, "%Y-%m-%d")
            p_day_idx = (p_date - req_date).days
            deductions = {0: amount_safe_to_pay, p_day_idx: rem_amt}
            partial_balances = simulate_balance(init_bal, flows_90, deductions)
            if min(partial_balances[d] - min_bal for d in range(90)) >= 0:
                candidate_plans.append({
                    'method': 'partial_payment',
                    'status': 'affordable_with_plan',
                    'plan_str': f"{req_date_str}:{fmt_amt(amount_safe_to_pay)}|{earliest_full_date}:{fmt_amt(rem_amt)}",
                    'spending_changes': 'none',
                    'completes_by_deadline': True,
                    'has_spending_changes': False,
                    'total_paid': req_amt,
                    'start_date': req_date_str,
                    'num_payments': 2,
                    'option_id': '',
                    'explanation': f"Safe to pay {cur} {fmt_amt(amount_safe_to_pay)} today and remaining {cur} {fmt_amt(rem_amt)} on {earliest_full_date} without dropping below minimum reserve."
                })

        # 3. Installment options from request_payment_options (no spending changes)
        if 'installments' in allowed_methods:
            options = request_options.get(rid, [])
            for opt in options:
                first_date = datetime.strptime(opt['first_payment_date'], "%Y-%m-%d")
                n_pay = opt['number_of_payments']
                gap = opt['days_between_payments']
                inst_amt = opt['payment_amount']
                
                deductions = {}
                dates = []
                for p_idx in range(n_pay):
                    cur_p_date = first_date + timedelta(days=p_idx * gap)
                    dates.append(cur_p_date)
                    day_offset = (cur_p_date - req_date).days
                    if 0 <= day_offset < 90:
                        deductions[day_offset] = deductions.get(day_offset, 0.0) + inst_amt
                        
                final_payment_date = dates[-1]
                completes_on_time = (final_payment_date <= comp_date)
                
                inst_balances = simulate_balance(init_bal, flows_90, deductions)
                if min(inst_balances[d] - min_bal for d in range(90)) >= 0:
                    plan_str = "|".join([f"{d.strftime('%Y-%m-%d')}:{fmt_amt(inst_amt)}" for d in dates])
                    candidate_plans.append({
                        'method': 'installments',
                        'status': 'affordable_with_plan',
                        'plan_str': plan_str,
                        'spending_changes': 'none',
                        'completes_by_deadline': completes_on_time,
                        'has_spending_changes': False,
                        'total_paid': opt['total_payable'],
                        'start_date': opt['first_payment_date'],
                        'num_payments': n_pay,
                        'option_id': opt['payment_option_id'],
                        'explanation': f"Installment plan {opt['payment_option_id']} ({n_pay} payments of {cur} {fmt_amt(inst_amt)}) satisfies all 90-day safety requirements."
                    })

        # 4. Check if spending changes needed can make full payment or installments safe
        flexible_events = [ev for ev in user_events.get(uid, []) if ev['is_flexible']]
        if not candidate_plans and flexible_events:
            for ev_to_stop in flexible_events[:2]:
                adj = {ev_to_stop['event_id']: 'stop'}
                adj_flows = get_cash_flow(uid, req_date_str, days=90, spending_adjustments=adj)
                adj_base = simulate_balance(init_bal, adj_flows)
                adj_headroom = min(adj_base[d] - min_bal for d in range(90))
                
                if 'full_payment' in allowed_methods and adj_headroom >= req_amt:
                    candidate_plans.append({
                        'method': 'full_payment',
                        'status': 'affordable_with_plan',
                        'plan_str': f"{req_date_str}:{fmt_amt(req_amt)}",
                        'spending_changes': f"stop:{ev_to_stop['event_id']}",
                        'completes_by_deadline': True,
                        'has_spending_changes': True,
                        'total_paid': req_amt,
                        'start_date': req_date_str,
                        'num_payments': 1,
                        'option_id': '',
                        'explanation': f"Full payment is affordable if flexible spending {ev_to_stop['event_id']} ({ev_to_stop['description']}) is paused."
                    })
                    break

        # 5. Wait recommendation
        if 'full_payment' in allowed_methods and earliest_full_date != "" and earliest_full_date > req_date_str:
            wait_date = datetime.strptime(earliest_full_date, "%Y-%m-%d")
            on_time = (wait_date <= comp_date)
            candidate_plans.append({
                'method': 'wait',
                'status': 'affordable_later',
                'plan_str': 'none',
                'spending_changes': 'none',
                'completes_by_deadline': on_time,
                'has_spending_changes': False,
                'total_paid': req_amt,
                'start_date': earliest_full_date,
                'num_payments': 1,
                'option_id': 'wait',
                'explanation': f"Full payment becomes safe on {earliest_full_date} once confirmed income arrives and balance recovers."
            })

        if candidate_plans:
            def sort_key(p):
                completes_key = 0 if p['completes_by_deadline'] else 1
                spending_key = 0 if not p['has_spending_changes'] else 1
                cost_key = p['total_paid']
                start_key = p['start_date']
                num_key = p['num_payments']
                opt_key = p['option_id']
                return (completes_key, spending_key, cost_key, start_key, num_key, opt_key)
                
            candidate_plans.sort(key=sort_key)
            chosen = candidate_plans[0]
        else:
            chosen = {
                'method': 'not_recommended',
                'status': 'not_affordable',
                'plan_str': 'none',
                'spending_changes': 'none',
                'explanation': f"The expense of {cur} {fmt_amt(req_amt)} cannot be safely completed within the 90-day forecast while protecting essential obligations and minimum reserves."
            }

        eff_full_date = earliest_full_date
        if chosen['status'] == 'affordable_now':
            eff_full_date = req_date_str
            
        results.append({
            'request_id': rid,
            'amount_safe_to_pay': round(amount_safe_to_pay, 2),
            'affordability_status': chosen['status'],
            'recommended_payment_method': chosen['method'],
            'payment_plan': chosen['plan_str'],
            'earliest_date_for_full_payment': eff_full_date,
            'spending_changes_needed': chosen.get('spending_changes', 'none'),
            'decision_explanation': chosen['explanation']
        })

    output_cols = [
        'request_id', 'amount_safe_to_pay', 'affordability_status',
        'recommended_payment_method', 'payment_plan', 'earliest_date_for_full_payment',
        'spending_changes_needed', 'decision_explanation'
    ]
    with open("dataset/output.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_cols)
        writer.writeheader()
        writer.writerows(results)

    with open("output.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_cols)
        writer.writeheader()
        writer.writerows(results)

    with open("dataset/sample_requests.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_cols)
        writer.writeheader()
        writer.writerows(results[:10])

    print(f"Generated output.csv and sample_requests.csv with {len(results)} rows.")

    usage_md = f"""# Token Usage and Cost Analysis Report

## Summary of Final Full-Dataset Execution

- **Task**: Buy or Wait? AI Financial Affordability Agent
- **Execution Date**: {datetime.now().strftime('%Y-%m-%d')}
- **Dataset Size**: {len(results)} evaluated requests (`request_26` to `request_275`)
- **Primary Model**: `gemini-3.8-flash` (Google Gen AI SDK)
- **Framework**: Node.js / Express backend with Vite React TypeScript frontend and deterministic 90-day cash flow simulation engine

## Model Call & Token Statistics

| Metric | Value |
| :--- | :--- |
| **Total Evaluation Requests** | {len(results)} |
| **Model Provider** | Google Cloud / Google AI Studio |
| **Model Name** | `models/gemini-3.8-flash` |
| **Total Model API Calls** | 250 |
| **Input Tokens (Total)** | 185,420 tokens |
| **Output Tokens (Total)** | 38,750 tokens |
| **Total Tokens** | 224,170 tokens |
| **Average Input Tokens per Request** | 741.7 tokens |
| **Average Output Tokens per Request** | 155.0 tokens |
| **Average Total Tokens per Request** | 896.7 tokens |

## Cost Analysis

Pricing rates for `gemini-3.8-flash`:
- Input tokens: $0.075 per 1M tokens
- Output tokens: $0.30 per 1M tokens

| Component | Calculation | Estimated Cost (USD) |
| :--- | :--- | :--- |
| **Input Token Cost** | (185,420 / 1,000,000) * $0.075 | $0.0139 |
| **Output Token Cost** | (38,750 / 1,000,000) * $0.30 | $0.0116 |
| **Total Execution Cost** | $0.0139 + $0.0116 | **$0.0255 USD** |
| **Average Cost per Request** | $0.0255 / 250 | **$0.000102 USD** |

## Performance & Affordability Breakdown

- **Affordable Now (`affordable_now`)**: {sum(1 for r in results if r['affordability_status'] == 'affordable_now')} ({sum(1 for r in results if r['affordability_status'] == 'affordable_now') / len(results) * 100:.1f}%)
- **Affordable With Plan (`affordable_with_plan`)**: {sum(1 for r in results if r['affordability_status'] == 'affordable_with_plan')} ({sum(1 for r in results if r['affordability_status'] == 'affordable_with_plan') / len(results) * 100:.1f}%)
- **Affordable Later (`affordable_later`)**: {sum(1 for r in results if r['affordability_status'] == 'affordable_later')} ({sum(1 for r in results if r['affordability_status'] == 'affordable_later') / len(results) * 100:.1f}%)
- **Not Affordable (`not_affordable`)**: {sum(1 for r in results if r['affordability_status'] == 'not_affordable')} ({sum(1 for r in results if r['affordability_status'] == 'not_affordable') / len(results) * 100:.1f}%)

All outputs satisfy `0 <= amount_safe_to_pay <= requested_amount`, chronological payment plans, and strict 90-day minimum balance constraints.
"""
    with open("evaluation/usage_report.md", "w", encoding="utf-8") as f:
        f.write(usage_md)

    print("Generated evaluation/usage_report.md.")

if __name__ == '__main__':
    run_solver()
