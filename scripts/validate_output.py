#!/usr/bin/env python3
import sys
import csv
import os
import re
from datetime import datetime

def validate(output_path="output.csv", requests_path="requests.csv"):
    if not os.path.exists(requests_path):
        requests_path = os.path.join("dataset", "requests.csv")
    
    if not os.path.exists(output_path):
        output_path = os.path.join("dataset", "output.csv")

    if not os.path.exists(output_path):
        print(f"Error: output file not found at {output_path}")
        sys.exit(1)

    if not os.path.exists(requests_path):
        print(f"Error: requests file not found at {requests_path}")
        sys.exit(1)

    # 1. Load requests
    requests = {}
    with open(requests_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            requests[r["request_id"]] = {
                "requested_amount": float(r["requested_amount"]),
                "request_date": r["request_date"],
                "desired_completion_date": r["desired_completion_date"],
                "allows_partial_payment": r["allows_partial_payment"].lower() == "true",
            }

    # 2. Load outputs
    expected_headers = [
        "request_id",
        "amount_safe_to_pay",
        "affordability_status",
        "recommended_payment_method",
        "payment_plan",
        "earliest_date_for_full_payment",
        "spending_changes_needed",
        "decision_explanation",
    ]

    with open(output_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        actual_headers = next(reader, None)
        if actual_headers != expected_headers:
            print(f"HEADER MISMATCH: Expected {expected_headers}, got {actual_headers}")
            sys.exit(1)
        
        rows = list(reader)

    total_requests = len(requests)
    predictions_generated = len(rows)
    validation_failures = 0
    rows_repaired = 0

    seen_ids = set()

    for idx, row in enumerate(rows, start=2):
        if len(row) != 8:
            print(f"Row {idx} invalid column count: {len(row)}")
            validation_failures += 1
            continue

        req_id = row[0]
        if req_id in seen_ids:
            print(f"Duplicate prediction for request_id: {req_id}")
            validation_failures += 1
        seen_ids.add(req_id)

        if req_id not in requests:
            print(f"Unknown request_id: {req_id}")
            validation_failures += 1
            continue

        req_data = requests[req_id]
        
        # Validate amount_safe_to_pay
        try:
            safe_amt = float(row[1])
            if safe_amt < 0 or safe_amt > req_data["requested_amount"] + 1e-5:
                print(f"Row {idx}: Invalid safe amount {safe_amt} (requested: {req_data['requested_amount']})")
                validation_failures += 1
        except ValueError:
            print(f"Row {idx}: Non-numeric safe amount '{row[1]}'")
            validation_failures += 1

        # Validate status
        status = row[2]
        if status not in ["affordable_now", "affordable_with_plan", "affordable_later", "not_affordable"]:
            print(f"Row {idx}: Invalid status '{status}'")
            validation_failures += 1

        # Validate payment method
        method = row[3]
        if method not in ["full_payment", "partial_payment", "installments", "wait", "not_recommended"]:
            print(f"Row {idx}: Invalid payment method '{method}'")
            validation_failures += 1

        # Validate payment plan
        plan = row[4]
        if method in ["not_recommended", "wait"]:
            if plan != "none":
                print(f"Row {idx}: Expected plan 'none' for method '{method}', got '{plan}'")
                validation_failures += 1
        elif method == "partial_payment":
            parts = plan.split("|")
            if len(parts) != 2:
                print(f"Row {idx}: Partial payment plan must have exactly two payments, got {len(parts)}")
                validation_failures += 1
            else:
                try:
                    d1, a1 = parts[0].split(":")
                    d2, a2 = parts[1].split(":")
                    datetime.strptime(d1, "%Y-%m-%d")
                    datetime.strptime(d2, "%Y-%m-%d")
                    if float(a1) + float(a2) - req_data["requested_amount"] > 0.05:
                        print(f"Row {idx}: Partial payments sum mismatch: {float(a1) + float(a2)} != {req_data['requested_amount']}")
                        validation_failures += 1
                except Exception as e:
                    print(f"Row {idx}: Malformed partial payment plan: {plan} ({e})")
                    validation_failures += 1

        # Validate earliest date
        earliest_date = row[5]
        if status == "affordable_now":
            if earliest_date != req_data["request_date"]:
                print(f"Row {idx}: affordable_now earliest date {earliest_date} must equal request_date {req_data['request_date']}")
                validation_failures += 1
        elif earliest_date != "":
            try:
                datetime.strptime(earliest_date, "%Y-%m-%d")
            except ValueError:
                print(f"Row {idx}: Invalid earliest date format '{earliest_date}'")
                validation_failures += 1

        # Validate spending changes
        changes = row[6]
        if changes != "none":
            for ch in changes.split("|"):
                if not (ch.startswith("stop:") or ch.startswith("reduce_to:")):
                    print(f"Row {idx}: Invalid spending change format '{ch}'")
                    validation_failures += 1

        # Validate explanation
        expl = row[7]
        if not expl or len(expl.strip()) == 0:
            print(f"Row {idx}: Missing explanation")
            validation_failures += 1

    missing_requests = set(requests.keys()) - seen_ids
    if missing_requests:
        print(f"Missing predictions for {len(missing_requests)} requests: {list(missing_requests)[:5]}")
        validation_failures += len(missing_requests)

    print("==================================================")
    print("AFFORDAI VALIDATION REPORT")
    print("==================================================")
    print(f"Total requests: {total_requests}")
    print(f"Predictions generated: {predictions_generated}")
    print(f"Validation failures: {validation_failures}")
    print(f"Rows repaired: {rows_repaired}")
    print(f"Output path: {os.path.abspath(output_path)}")
    print("==================================================")

    if validation_failures > 0:
        sys.exit(1)
    else:
        print("ALL VALIDATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    validate()
