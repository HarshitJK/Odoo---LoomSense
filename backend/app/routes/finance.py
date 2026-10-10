from typing import Optional

from fastapi import APIRouter, HTTPException

from app.config import TARGET_MARGIN
from app.services import costing, profitability
from app.utils.validation import valid_month

router = APIRouter()


@router.get("/dashboard")
def finance_dashboard(month: Optional[str] = None):
    """Owner KPIs for a month (default: current month). Orders list covers all orders."""
    month = valid_month(month)
    data = costing.load_data()  # one batch of queries shared by every calculation below
    profits = profitability.all_order_profits(data)
    from app.services.month_end import report
    books = report(month)
    summary = {"label": profitability.month_label(month), "revenue": books["totalCashIn"],
        "totalCost": books["totalExpenses"], "profit": books["netCashResult"],
        "margin": profitability.calculate_margin(books["totalCashIn"], books["netCashResult"]),
        "costBreakdown": {"rawMaterial": books["rawMaterialBills"], "labour": books["workerWages"],
            "machine": books["machineOperatingCost"], "rework": books["reworkCost"], "other": books["otherExpenses"]}}
    finished = [p for p in profits if not p["provisional"] and p["revenue"]]

    month_payments = [t["amount"] for t in data["transactions"] if (t.get("date") or "").startswith(month)]
    breakdown = summary["costBreakdown"]
    return {
        "month": month,
        "label": summary["label"],
        "targetMargin": TARGET_MARGIN,
        "kpis": {
            "revenue": summary["revenue"],
            "productionCost": summary["totalCost"],
            "netProfit": summary["profit"],
            "profitMargin": summary["margin"],
            "buyerPayments": round(sum(month_payments), 2),
            "paymentsReceived": round(sum(p["paidAmount"] for p in profits), 2),
            "paymentsPending": round(sum(p["pendingAmount"] for p in profits), 2),
            "workerWages": costing.wages_summary(month)["totalWorkforceCost"],
            "rawMaterialExpense": breakdown["rawMaterial"],
            "machineOperatingCost": breakdown["machine"],
            "reworkCost": breakdown["rework"],
        },
        "costBreakdown": breakdown,
        "mostProfitableOrder": max(finished, key=lambda p: p["margin"], default=None),
        "leastProfitableOrder": min(finished, key=lambda p: p["margin"], default=None),
        "orders": profits,
    }


@router.get("/monthly")
def finance_monthly():
    """Revenue, cost, profit and margin for each of the last 4 months."""
    from app.services.month_end import report
    result = []
    for month in profitability.last_months():
        r = report(month)
        result.append({"month": month, "label": profitability.month_label(month), "revenue": r["totalCashIn"],
                       "cost": r["totalExpenses"], "profit": r["netCashResult"],
                       "margin": profitability.calculate_margin(r["totalCashIn"], r["netCashResult"])})
    return result


@router.get("/profit-leakage")
def finance_profit_leakage(order_id: Optional[str] = None):
    """Leakage for order_id, or for the lowest-margin finished order."""
    data = costing.load_data()
    if order_id:
        order_id = order_id.replace("-", "").upper()
    else:
        order_id = profitability.lowest_margin_order_id(profitability.all_order_profits(data))
    if not order_id:
        raise HTTPException(404, "No finished orders to analyse")
    return profitability.profit_leakage(order_id, data)


@router.get("/orders/{order_id}")
def finance_order(order_id: str):
    return profitability.order_profit(order_id.replace("-", "").upper())


@router.get("/month-end")
def month_end(month: str):
    from app.services.month_end import report
    return report(month)


from datetime import date, datetime, timezone
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field
from app import database as dbm


class Expense(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    description: str = Field(min_length=1)
    date: date
    amount: float = Field(gt=0)


@router.post("/expenses", status_code=201)
def add_expense(body: Expense):
    record = body.model_dump(mode="json")
    record.update(expenseId="EXP" + uuid4().hex, createdAt=datetime.now(timezone.utc).isoformat())
    dbm.db.operatingExpenses.insert_one(record)
    record.pop("_id", None)
    return record
