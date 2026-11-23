import { Controller, Post, Body, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { AnalyticsService } from "./analytics.service";
import {
  RecordDeployDto,
  RecordInvokeDto,
  RecordCompileDto,
} from "./analytics.dto";
import { parseGranularity, parseRangeKey } from "src/libs/range";
import {
  parseActionType,
  parseIntParam,
  parseOrder,
  parseSort,
  parseText,
  parseTimeZone,
} from "src/libs/params";
import { ActivityFilters } from "./analytics.service";

type ActivityQuery = Record<
  "type" | "wallet" | "q" | "sort" | "order",
  string | undefined
>;

function parseActivityFilters(query: ActivityQuery): ActivityFilters {
  return {
    type: parseActionType(query.type),
    wallet: parseText(query.wallet, "wallet", 64),
    q: parseText(query.q, "q"),
    sort: parseSort(query.sort),
    order: parseOrder(query.order),
  };
}

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("deploy")
  async recordDeployment(@Body() body: RecordDeployDto) {
    const { wallet, address, name, txHash } = body;
    return this.analyticsService.recordDeployment({
      wallet,
      address,
      name,
      txHash,
    });
  }

  @Post("invoke")
  async recordInvoke(@Body() body: RecordInvokeDto) {
    const { wallet, address, method, txHash } = body;
    return this.analyticsService.recordInvoke({
      wallet,
      address,
      method,
      txHash,
    });
  }

  @Post("compile")
  async recordCompile(@Body() body: RecordCompileDto) {
    const { wallet } = body;
    return this.analyticsService.recordCompile(wallet);
  }

  @Get("summary")
  async getSummaryStats() {
    return this.analyticsService.getSummaryStats();
  }

  @Get("recent")
  async getRecentActivity() {
    return this.analyticsService.getRecentActivity();
  }

  @Get("activity-over-time")
  async getActivityOverTime() {
    return this.analyticsService.getActivityOverTime();
  }

  @Get("transaction-distribution")
  async getTransactionDistribution() {
    return this.analyticsService.getTransactionDistribution();
  }

  @Get("unique-users-per-day")
  async getUniqueUsersPerDay() {
    return this.analyticsService.getUniqueUsersPerDay();
  }

  @Get("unique-users-per-week")
  async getUniqueUsersPerWeek() {
    return this.analyticsService.getUniqueUsersPerWeek();
  }

  @Get("active-users-per-day")
  async getActiveUsersPerDay() {
    return this.analyticsService.getActiveUsersPerDay();
  }

  @Get("active-users-per-week")
  async getActiveUsersPerWeek() {
    return this.analyticsService.getActiveUsersPerWeek();
  }

  @Get("active-users")
  async getActiveUsers(
    @Query("range") range?: string,
    @Query("granularity") granularity?: string,
  ) {
    return this.analyticsService.getActiveUsers(
      parseRangeKey(range),
      parseGranularity(granularity),
    );
  }

  @Get("activity-timeseries")
  async getActivityTimeseries(
    @Query("range") range?: string,
    @Query("granularity") granularity?: string,
  ) {
    return this.analyticsService.getActivityTimeseries(
      parseRangeKey(range),
      parseGranularity(granularity),
    );
  }

  @Get("overview")
  async getOverview(@Query("range") range?: string) {
    return this.analyticsService.getOverview(parseRangeKey(range));
  }

  @Get("top-contracts")
  async getTopContracts(
    @Query("range") range?: string,
    @Query("limit") limit?: string,
  ) {
    return this.analyticsService.getTopContracts(
      parseRangeKey(range),
      parseIntParam(limit, { name: "limit", fallback: 10, min: 1, max: 50 }),
    );
  }

  @Get("top-wallets")
  async getTopWallets(
    @Query("range") range?: string,
    @Query("limit") limit?: string,
  ) {
    return this.analyticsService.getTopWallets(
      parseRangeKey(range),
      parseIntParam(limit, { name: "limit", fallback: 10, min: 1, max: 50 }),
    );
  }

  @Get("new-vs-returning")
  async getNewVsReturning(
    @Query("range") range?: string,
    @Query("granularity") granularity?: string,
  ) {
    return this.analyticsService.getNewVsReturning(
      parseRangeKey(range),
      parseGranularity(granularity, "week"),
    );
  }

  @Get("heatmap")
  async getHeatmap(@Query("range") range?: string, @Query("tz") tz?: string) {
    return this.analyticsService.getHeatmap(
      parseRangeKey(range),
      parseTimeZone(tz),
    );
  }

  @Get("activity")
  async getActivity(
    @Query()
    query: ActivityQuery & { range?: string; page?: string; pageSize?: string },
  ) {
    return this.analyticsService.getActivityPage(
      parseRangeKey(query.range),
      parseActivityFilters(query),
      parseIntParam(query.page, {
        name: "page",
        fallback: 1,
        min: 1,
        max: 100_000,
      }),
      parseIntParam(query.pageSize, {
        name: "pageSize",
        fallback: 25,
        min: 1,
        max: 100,
      }),
    );
  }

  @Get("activity/export")
  async exportActivity(
    @Query() query: ActivityQuery & { range?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const range = parseRangeKey(query.range);
    const csv = await this.analyticsService.exportActivityCsv(
      range,
      parseActivityFilters(query),
    );
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="solang-activity-${range}-${date}.csv"`,
    );
    return csv;
  }

  @Get("info")
  async getInfo() {
    return this.analyticsService.getInfo();
  }
}
