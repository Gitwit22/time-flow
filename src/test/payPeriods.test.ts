import { describe, expect, it } from "vitest";

import { formatDateForInput, parseDateInput, toDateOnlyString } from "@/lib/date";
import {
  getCurrentPayPeriod,
  getEntriesForPayPeriod,
  getExpensesForPayPeriod,
  getNextPayPeriod,
  getPayPeriodForDate,
  getPreviousPayPeriod,
  summarizePayPeriod,
} from "@/lib/payPeriods";

describe("pay period utilities", () => {
  it("calculates a weekly pay period from a fixed anchor date", () => {
    const period = getPayPeriodForDate("2026-01-15", {
      payPeriodFrequency: "weekly",
      payPeriodStartDate: "2026-01-05",
    });

    expect(period.startDate).toBe("2026-01-12");
    expect(period.endDate).toBe("2026-01-18");
  });

  it("calculates a biweekly pay period from a fixed anchor date", () => {
    const period = getCurrentPayPeriod(
      {
        payPeriodFrequency: "biweekly",
        payPeriodStartDate: "2026-01-05",
      },
      new Date("2026-01-20T12:00:00"),
    );

    expect(period.startDate).toBe("2026-01-19");
    expect(period.endDate).toBe("2026-02-01");
  });

  it("moves to previous and next periods from the same settings", () => {
    const current = getPayPeriodForDate("2026-01-20", {
      payPeriodFrequency: "biweekly",
      payPeriodStartDate: "2026-01-05",
    });

    expect(getPreviousPayPeriod(current, { payPeriodFrequency: "biweekly", payPeriodStartDate: "2026-01-05" }).startDate).toBe("2026-01-05");
    expect(getNextPayPeriod(current, { payPeriodFrequency: "biweekly", payPeriodStartDate: "2026-01-05" }).startDate).toBe("2026-02-02");
  });

  it("filters entries and expenses into the correct pay period and summarizes totals", () => {
    const period = getPayPeriodForDate("2026-01-20", {
      payPeriodFrequency: "biweekly",
      payPeriodStartDate: "2026-01-05",
    });
    const entries = [
      { date: "2026-01-19", durationHours: 2, amount: 300 },
      { date: "2026-01-18", durationHours: 1, amount: 150 },
    ];
    const expenses = [
      { date: "2026-01-21", amount: 45 },
      { date: "2026-01-10", amount: 10 },
    ];
    const invoices = [
      { periodStart: "2026-01-19", periodEnd: "2026-02-01", totalAmount: 800 },
    ];

    expect(getEntriesForPayPeriod(entries, period)).toHaveLength(1);
    expect(getExpensesForPayPeriod(expenses, period)).toHaveLength(1);

    expect(
      summarizePayPeriod({
        entries,
        expenses,
        invoices,
        period,
      }),
    ).toMatchObject({
      timeEarnings: 300,
      expenseTotal: 45,
      invoiceTotal: 800,
      netAmount: 255,
      totalHours: 2,
    });
  });
});

describe("date-only helpers", () => {
  it("preserves date-only inputs without timezone shifts", () => {
    expect(parseDateInput("2026-04-30")).toBe("2026-04-30");
    expect(formatDateForInput("2026-04-30T23:30:00.000Z")).toBe("2026-04-30");
    expect(toDateOnlyString("2026-04-30")).toBe("2026-04-30");
  });
});