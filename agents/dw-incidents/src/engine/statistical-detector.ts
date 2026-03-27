/**
 * Statistical Anomaly Detection (REQ-INC-001).
 *
 * Methods:
 * - Z-score: for normally distributed metrics
 * - IQR (Interquartile Range): for skewed distributions
 * - Moving average: for trend detection
 *
 * Target: <60s detection latency.
 */

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  metric: string;
  source: string;
}

export interface AnomalyDetection {
  isAnomaly: boolean;
  metric: string;
  value: number;
  expected: number;
  deviation: number;
  method: 'zscore' | 'iqr' | 'moving_average' | 'isolation_forest' | 'semantic';
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  timestamp: number;
}

export interface DetectorConfig {
  zScoreThreshold: number;
  iqrMultiplier: number;
  movingAverageWindow: number;
  minDataPoints: number;
}

export class StatisticalDetector {
  private config: DetectorConfig;

  constructor(config?: Partial<DetectorConfig>) {
    this.config = {
      zScoreThreshold: 3.0,
      iqrMultiplier: 1.5,
      movingAverageWindow: 7,
      minDataPoints: 10,
      ...config,
    };
  }

  /**
   * Detect anomalies using z-score method.
   * Best for normally distributed metrics.
   */
  detectZScore(dataPoints: MetricDataPoint[], current: MetricDataPoint): AnomalyDetection {
    const values = dataPoints.map((d) => d.value);
    const mean = this.mean(values);
    const std = this.stdDev(values, mean);

    if (std === 0) {
      return this.buildDetection(current, mean, 0, 'zscore', false);
    }

    const zScore = (current.value - mean) / std;
    const isAnomaly = Math.abs(zScore) > this.config.zScoreThreshold;

    return this.buildDetection(current, mean, zScore, 'zscore', isAnomaly);
  }

  /**
   * Detect anomalies using IQR method.
   * Robust against skewed distributions.
   */
  detectIQR(dataPoints: MetricDataPoint[], current: MetricDataPoint): AnomalyDetection {
    const values = dataPoints.map((d) => d.value).sort((a, b) => a - b);
    const q1 = this.percentile(values, 25);
    const q3 = this.percentile(values, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - this.config.iqrMultiplier * iqr;
    const upperBound = q3 + this.config.iqrMultiplier * iqr;
    const median = this.percentile(values, 50);

    const isAnomaly = current.value < lowerBound || current.value > upperBound;
    const deviation = median !== 0 ? (current.value - median) / (iqr || 1) : 0;

    return this.buildDetection(current, median, deviation, 'iqr', isAnomaly);
  }

  /**
   * Detect anomalies using moving average.
   * Good for trend-based detection.
   */
  detectMovingAverage(dataPoints: MetricDataPoint[], current: MetricDataPoint): AnomalyDetection {
    const window = Math.min(this.config.movingAverageWindow, dataPoints.length);
    const recentValues = dataPoints.slice(-window).map((d) => d.value);
    const movingAvg = this.mean(recentValues);
    const movingStd = this.stdDev(recentValues, movingAvg);

    const deviation = movingStd > 0 ? (current.value - movingAvg) / movingStd : 0;
    const isAnomaly = Math.abs(deviation) > this.config.zScoreThreshold;

    return this.buildDetection(current, movingAvg, deviation, 'moving_average', isAnomaly);
  }

  /**
   * Run all detection methods and return the most confident result.
   */
  detect(dataPoints: MetricDataPoint[], current: MetricDataPoint): AnomalyDetection {
    if (dataPoints.length < this.config.minDataPoints) {
      return this.buildDetection(current, current.value, 0, 'zscore', false);
    }

    const results = [
      this.detectZScore(dataPoints, current),
      this.detectIQR(dataPoints, current),
      this.detectMovingAverage(dataPoints, current),
    ];

    // If any method detects anomaly, it's an anomaly
    const anomalies = results.filter((r) => r.isAnomaly);
    if (anomalies.length > 0) {
      // Return highest confidence anomaly
      return anomalies.sort((a, b) => b.confidence - a.confidence)[0];
    }

    return results[0]; // Return z-score result as default
  }

  // -- Helpers --

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  private percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  private buildDetection(
    point: MetricDataPoint,
    expected: number,
    deviation: number,
    method: AnomalyDetection['method'],
    isAnomaly: boolean,
  ): AnomalyDetection {
    const absDeviation = Math.abs(deviation);
    return {
      isAnomaly,
      metric: point.metric,
      value: point.value,
      expected,
      deviation,
      method,
      severity: absDeviation > 5 ? 'critical' : absDeviation > 3 ? 'warning' : 'info',
      confidence: isAnomaly ? Math.min(0.95, 0.6 + absDeviation * 0.05) : 0.9,
      timestamp: point.timestamp,
    };
  }
}
