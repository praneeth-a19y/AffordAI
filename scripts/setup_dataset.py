import os
import csv
import json
import re
from datetime import datetime, timedelta
import random

random.seed(42)

# Load requests
requests = []
with open("dataset/requests.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        row['requested_amount'] = float(row['requested_amount'])
        row['allows_partial_payment'] = row['allows_partial_payment'].lower() == 'true'
        requests.append(row)

print(f"Loaded {len(requests)} requests.")

# Currency detection based on request amount and text
def detect_currency(req):
    text = req['request_text']
    for cur in ['IDR', 'INR', 'ZAR', 'USD', 'EUR']:
        if cur in text:
            return cur
    amt = req['requested_amount']
    if amt > 1000000:
        return 'IDR'
    elif amt > 20000:
        return 'INR'
    elif amt > 5000:
        return 'ZAR'
    elif amt > 100:
        return 'EUR'
    return 'USD'

exchange_rates_to_usd = {
    'USD': 1.0,
    'EUR': 1.08,
    'ZAR': 0.055,
    'INR': 0.012,
    'IDR': 0.000064
}

# 1. Generate financial profiles
profiles = []
for req in requests:
    uid = req['user_id']
    cur = detect_currency(req)
    req_amt = req['requested_amount']
    
    # Balance scaled to currency and request
    # Some users have plenty, some have partial, some have tight
    user_num = int(uid.replace('user_', ''))
    scenario_type = user_num % 5
    
    if scenario_type == 0:
        # Afford now
        available_balance = round(req_amt * random.uniform(1.6, 2.5), 2)
        min_bal = round(req_amt * random.uniform(0.15, 0.35), 2)
        methods = "full_payment|partial_payment|installments"
    elif scenario_type == 1:
        # Tight today, safe with partial or installments
        available_balance = round(req_amt * random.uniform(0.6, 1.1), 2)
        min_bal = round(req_amt * random.uniform(0.2, 0.4), 2)
        methods = "full_payment|partial_payment|installments" if req['allows_partial_payment'] else "full_payment|installments"
    elif scenario_type == 2:
        # Installments only preference or only wait
        available_balance = round(req_amt * random.uniform(1.2, 2.0), 2)
        min_bal = round(req_amt * random.uniform(0.25, 0.5), 2)
        methods = "installments|wait" if user_num % 2 == 0 else "full_payment|installments"
    elif scenario_type == 3:
        # Needs flexible spending changes
        available_balance = round(req_amt * random.uniform(0.8, 1.2), 2)
        min_bal = round(req_amt * random.uniform(0.3, 0.6), 2)
        methods = "full_payment|installments"
    else:
        # Not affordable or affordable later
        available_balance = round(req_amt * random.uniform(0.4, 0.8), 2)
        min_bal = round(req_amt * random.uniform(0.3, 0.5), 2)
        methods = "full_payment|installments|wait"

    priorities = random.choice(["emergency_savings", "debt_reduction", "balanced", "growth"])
    spending_pref = random.choice(["flexible_entertainment", "strict_budget", "willing_to_adjust_flexible"])

    profiles.append({
        'user_id': uid,
        'home_currency': cur,
        'available_balance': available_balance,
        'minimum_balance_to_keep': min_bal,
        'financial_priorities': priorities,
        'spending_preferences': spending_pref,
        'payment_methods_user_will_consider': methods
    })

with open("dataset/financial_profiles.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        'user_id', 'home_currency', 'available_balance', 'minimum_balance_to_keep',
        'financial_priorities', 'spending_preferences', 'payment_methods_user_will_consider'
    ])
    writer.writeheader()
    writer.writerows(profiles)

profile_map = {p['user_id']: p for p in profiles}

# 2. Generate financial events (salary, rent, subscriptions)
events = []
event_counter = 1

for req in requests:
    uid = req['user_id']
    cur = profile_map[uid]['home_currency']
    req_date = datetime.strptime(req['request_date'], "%Y-%m-%d")
    req_amt = req['requested_amount']
    
    # Monthly confirmed salary (approx 1.2x to 2.5x of normal monthly costs)
    salary_amt = round(req_amt * random.uniform(0.8, 1.8), 2)
    # Salary arrival: 15-25 days from request_date, and repeats every 30 days
    salary_day_offset = (int(uid.replace('user_', '')) * 7) % 20 + 5
    first_salary = req_date + timedelta(days=salary_day_offset)
    
    events.append({
        'event_id': f"event_{event_counter}",
        'user_id': uid,
        'event_type': 'income',
        'is_recurring': True,
        'recurrence_interval_days': 30,
        'is_flexible': False,
        'is_essential': True,
        'status': 'confirmed',
        'amount': salary_amt,
        'currency': cur,
        'event_date': first_salary.strftime("%Y-%m-%d"),
        'description': 'Confirmed Monthly Salary',
        'linked_event_id': ''
    })
    event_counter += 1

    # Essential recurring expense (Rent / Housing)
    rent_amt = round(salary_amt * random.uniform(0.25, 0.4), 2)
    rent_date = req_date + timedelta(days=(salary_day_offset + 3) % 28 + 2)
    events.append({
        'event_id': f"event_{event_counter}",
        'user_id': uid,
        'event_type': 'recurring_expense',
        'is_recurring': True,
        'recurrence_interval_days': 30,
        'is_flexible': False,
        'is_essential': True,
        'status': 'confirmed',
        'amount': rent_amt,
        'currency': cur,
        'event_date': rent_date.strftime("%Y-%m-%d"),
        'description': 'Apartment Rent & Essential Utilities',
        'linked_event_id': ''
    })
    event_counter += 1

    # Essential recurring expense (Groceries / Food / Transport)
    groceries_amt = round(salary_amt * random.uniform(0.15, 0.25), 2)
    events.append({
        'event_id': f"event_{event_counter}",
        'user_id': uid,
        'event_type': 'recurring_expense',
        'is_recurring': True,
        'recurrence_interval_days': 15,
        'is_flexible': False,
        'is_essential': True,
        'status': 'confirmed',
        'amount': round(groceries_amt / 2, 2),
        'currency': cur,
        'event_date': (req_date + timedelta(days=4)).strftime("%Y-%m-%d"),
        'description': 'Bi-weekly Groceries & Commuting',
        'linked_event_id': ''
    })
    event_counter += 1

    # Flexible recurring expense 1 (Entertainment / Streaming / Dining)
    flex1_amt = round(salary_amt * random.uniform(0.05, 0.12), 2)
    events.append({
        'event_id': f"event_{event_counter}",
        'user_id': uid,
        'event_type': 'recurring_expense',
        'is_recurring': True,
        'recurrence_interval_days': 30,
        'is_flexible': True,
        'is_essential': False,
        'status': 'confirmed',
        'amount': flex1_amt,
        'currency': cur,
        'event_date': (req_date + timedelta(days=7)).strftime("%Y-%m-%d"),
        'description': 'Streaming Services & Dining Out Club',
        'linked_event_id': ''
    })
    event_counter += 1

    # Flexible recurring expense 2 (Gym / Lifestyle Membership)
    flex2_amt = round(salary_amt * random.uniform(0.03, 0.08), 2)
    events.append({
        'event_id': f"event_{event_counter}",
        'user_id': uid,
        'event_type': 'recurring_expense',
        'is_recurring': True,
        'recurrence_interval_days': 30,
        'is_flexible': True,
        'is_essential': False,
        'status': 'confirmed',
        'amount': flex2_amt,
        'currency': cur,
        'event_date': (req_date + timedelta(days=12)).strftime("%Y-%m-%d"),
        'description': 'Fitness & Luxury Lifestyle Subscription',
        'linked_event_id': ''
    })
    event_counter += 1

with open("dataset/financial_events.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        'event_id', 'user_id', 'event_type', 'is_recurring', 'recurrence_interval_days',
        'is_flexible', 'is_essential', 'status', 'amount', 'currency', 'event_date',
        'description', 'linked_event_id'
    ])
    writer.writeheader()
    writer.writerows(events)

# 3. Generate request payment options
payment_options = []
opt_id_counter = 1

for req in requests:
    rid = req['request_id']
    req_date = datetime.strptime(req['request_date'], "%Y-%m-%d")
    amt = req['requested_amount']
    
    # 3-installment plan (starts on request date, every 30 days)
    p3_amt = round((amt * 1.02) / 3, 2)
    payment_options.append({
        'request_id': rid,
        'payment_option_id': f"opt_{opt_id_counter}",
        'payment_type': 'installments',
        'number_of_payments': 3,
        'days_between_payments': 30,
        'first_payment_date': req['request_date'],
        'payment_amount': p3_amt,
        'financing_fee': round(amt * 0.02, 2),
        'total_payable': round(p3_amt * 3, 2)
    })
    opt_id_counter += 1

    # 4-installment plan
    p4_amt = round((amt * 1.04) / 4, 2)
    payment_options.append({
        'request_id': rid,
        'payment_option_id': f"opt_{opt_id_counter}",
        'payment_type': 'installments',
        'number_of_payments': 4,
        'days_between_payments': 15,
        'first_payment_date': req['request_date'],
        'payment_amount': p4_amt,
        'financing_fee': round(amt * 0.04, 2),
        'total_payable': round(p4_amt * 4, 2)
    })
    opt_id_counter += 1

with open("dataset/request_payment_options.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        'request_id', 'payment_option_id', 'payment_type', 'number_of_payments',
        'days_between_payments', 'first_payment_date', 'payment_amount',
        'financing_fee', 'total_payable'
    ])
    writer.writeheader()
    writer.writerows(payment_options)

# 4. Exchange rates
rates = []
for cur in ['USD', 'EUR', 'ZAR', 'INR', 'IDR']:
    rates.append({'rate_date': '2024-01-01', 'base_currency': cur, 'target_currency': 'USD', 'rate': exchange_rates_to_usd[cur]})
    rates.append({'rate_date': '2025-01-01', 'base_currency': cur, 'target_currency': 'USD', 'rate': exchange_rates_to_usd[cur]})
    rates.append({'rate_date': '2026-01-01', 'base_currency': cur, 'target_currency': 'USD', 'rate': exchange_rates_to_usd[cur]})

with open("dataset/exchange_rates.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=['rate_date', 'base_currency', 'target_currency', 'rate'])
    writer.writeheader()
    writer.writerows(rates)

# 5. Messages & Images
messages = []
images = []
for i, req in enumerate(requests[:30]):
    messages.append({
        'message_id': f"msg_{i+1}",
        'user_id': req['user_id'],
        'request_id': req['request_id'],
        'related_event_id': '',
        'message_date': req['request_date'],
        'sender': 'merchant_or_employer',
        'content': f"Confirmed quote for {req['request_type']}: total requested {req['requested_amount']}."
    })
with open("dataset/messages.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=['message_id', 'user_id', 'request_id', 'related_event_id', 'message_date', 'sender', 'content'])
    writer.writeheader()
    writer.writerows(messages)

with open("dataset/images.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=['image_id', 'user_id', 'request_id', 'related_event_id', 'description', 'extracted_amount'])
    writer.writeheader()
    writer.writerows(images)

print("Dataset generated successfully.")
