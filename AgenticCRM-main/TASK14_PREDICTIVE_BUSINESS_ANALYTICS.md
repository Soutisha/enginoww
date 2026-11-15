# Task 14 — Predictive Business Analytics

## Scope delivered

Task 14 extends the existing Analytics module and adds a dedicated Predictive Business Analytics screen. It does not introduce a new database table: all results are calculated from company-scoped CRM records already stored by BizPilot.

### Capabilities

- **Revenue forecasting:** aggregates net paid payments by month, selects the highest-volume currency instead of adding unlike currencies, and projects the next three months using an ordinary least-squares linear trend. The API returns the fit R-squared, a conservative confidence label, data coverage, and the method used.
- **Customer segmentation:** RFM-style segments derived from paid purchase recency, order frequency, and spend: Champions, Loyal, At Risk, New Customers, and Inactive. Segment definitions are returned with the data.
- **Sales trends:** monthly lead creation, won leads, and collected revenue over the last 12 months.
- **Conversion outlook:** uses the average conversion rate of up to the last three completed monthly lead cohorts. This is explicitly described as a simple baseline, not a causal model.
- **Product recommendations:** ranks product/deal line items by revenue from won deals and reports units sold. It only compares line items whose deal currency matches the selected revenue currency.
- **Anomaly detection:** flags monthly revenue values at least two standard deviations from the 12-month mean and provides the z-score and explanation.
- **Explainable insights:** deterministic observations include evidence values and recommended review areas. No generative model invents business facts.

## API

`GET /api/analytics/predictive`

Uses the existing JWT authentication, company-scope guard, and `analytics` permission on `AnalyticsController`. All database queries are scoped to `user.companyId`.

## Frontend

- New route: `/analytics/predictive`
- Existing Analytics page links to Predictive insights.
- Includes revenue history/forecast, sales trends, customer segments, product ranking, anomaly alerts, explainable insights, and data coverage/methodology.
- Handles loading, error/retry, empty data, currency formatting, and refresh.

## Data and interpretation boundaries

- Payment amounts are stored in minor units and converted to major currency units after subtracting recorded refunds.
- Different currencies are never summed together; the currency with the largest observed net paid amount is selected and the response flags mixed-currency data.
- Product line-item totals are sourced from won deals. If no won deal line items exist, the product recommendation list is empty rather than fabricated.
- Revenue forecasts are statistical trend estimates and can be unreliable with sparse history, seasonality, one-off transactions, or changing conditions. They are not guarantees.
- Customer segmentation is based on recorded paid payments, not inferred customer intent. Contacts without payment history are classified as inactive.
- No database migration is required.

## Verification

Run `node scripts/verify-task14.mjs` for the Task 14 structural checks. A full API/dashboard type-check, production build, and live database/API test require installing workspace dependencies and configuring the application's database and environment; those checks are not represented as passed by the static verifier.
