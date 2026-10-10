"""Profit, margin and profit-leakage logic."""


def calculate_profit(revenue: float, true_cost: float) -> float:
    """Profit = Revenue - True Order Cost."""
    return revenue - true_cost


def calculate_margin(revenue: float, profit: float) -> float:
    """Margin % = Profit / Revenue x 100 (0 if there is no revenue)."""
    return round(profit / revenue * 100, 1) if revenue else 0.0


def detect_profit_leakage(order: dict, expected_margin: float = 25.0) -> dict:
    """Explain why a low-margin order underperformed.

    TODO: compare order['costs'] against expected/benchmark costs and list
    leaks (excess yarn, overtime, rework) with a recommendation.
    """
    return {
        "orderId": order.get("orderId"),
        "expectedMargin": expected_margin,
        "actualMargin": order.get("margin") or 0,
        "leaks": [],
        "recommendation": None,
    }
