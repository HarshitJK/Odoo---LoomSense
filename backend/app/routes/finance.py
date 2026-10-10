from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.config import TARGET_MARGIN
from app.services import costing, profitability

router = APIRouter()


def check_month(month: Optional[str]) -> str:
    month = month or date.today().strftime("%Y-%m")
    try:
        date.fromisoformat(month + "-01")
    except ValueError:
        raise HTTPException(422, "month must look like 2026-10")
    return month


@router.get("/dashboard")
def finance_dashboard(month: Optional[str] = None):
    """Owner KPIs for a month (default: current month). Orders list covers all orders."""
    month = check_month(month)
    summary = profitability.monthly_summary(month)
    profits = profitability.all_order_profits()
    finished = [p for p in profits if not p["provisional"] and p["revenue"]]

    payments = dbm.transactions().find(
        {"type": "BUYER_PAYMENT", "date": {"$regex": f"^{month}"}}, {"_id": 0}
    )
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
            "buyerPayments": round(sum(t["amount"] for t in payments), 2),
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
    """Revenue, cost and profit for each of the last 4 months."""
    return profitability.monthly_trend()


@router.get("/profit-leakage")
def finance_profit_leakage(order_id: Optional[str] = None):
    """Leakage for order_id, or for the lowest-margin finished order."""
    order_id = order_id or profitability.lowest_margin_order_id()
    if not order_id:
        raise HTTPException(404, "No finished orders to analyse")
    return profitability.profit_leakage(order_id)


@router.get("/orders/{order_id}")
def finance_order(order_id: str):
    return profitability.order_profit(order_id)
