/**
 * Performance Monitor Service
 * 
 * Tracks and analyzes system performance metrics for the RAG system
 */

export interface PerformanceMetrics {
  apiLatency: Record<string, number[]>;
  cacheHitRate: number;
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  timestamp: Date;
}

export interface PerformanceReport {
  summary: {
    period: string;
    totalRequests: number;
    averageLatency: number;
    cacheHitRate: number;
    errorRate: number;
    healthScore: number; // 0-100
  };
  endpoints: Record<string, EndpointMetrics>;
  bottlenecks: Bottleneck[];
  recommendations: string[];
}

export interface EndpointMetrics {
  endpoint: string;
  requests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface Bottleneck {
  component: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  recommendation: string;
}

class PerformanceMonitor {
  private metrics: Map<string, any[]> = new Map();
  private startTime: Date = new Date();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  
  // Latency tracking per endpoint
  private latencyMap: Map<string, number[]> = new Map();
  
  // Performance thresholds
  private readonly THRESHOLDS = {
    ACCEPTABLE_LATENCY: 10000,  // 10 seconds
    GOOD_LATENCY: 5000,         // 5 seconds
    EXCELLENT_LATENCY: 2000,    // 2 seconds
    MIN_CACHE_HIT_RATE: 0.5,    // 50%
    TARGET_CACHE_HIT_RATE: 0.7, // 70%
    MAX_ERROR_RATE: 0.05,       // 5%
  };
  
  /**
   * Start tracking a request
   */
  startRequest(endpoint: string): string {
    const requestId = `${endpoint}-${Date.now()}-${Math.random()}`;
    this.metrics.set(requestId, [Date.now(), endpoint]);
    this.requestCount++;
    return requestId;
  }
  
  /**
   * End tracking a request
   */
  endRequest(requestId: string, success: boolean = true, cached: boolean = false): void {
    const data = this.metrics.get(requestId);
    if (!data) return;
    
    const [startTime, endpoint] = data;
    const latency = Date.now() - startTime;
    
    // Track latency per endpoint
    if (!this.latencyMap.has(endpoint)) {
      this.latencyMap.set(endpoint, []);
    }
    this.latencyMap.get(endpoint)!.push(latency);
    
    // Track cache hits/misses
    if (cached) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    
    // Track errors
    if (!success) {
      this.errorCount++;
    }
    
    // Clean up
    this.metrics.delete(requestId);
  }
  
  /**
   * Measure API latency for a specific endpoint
   */
  measureApiLatency(endpoint: string): number {
    const latencies = this.latencyMap.get(endpoint);
    if (!latencies || latencies.length === 0) {
      return 0;
    }
    
    const sum = latencies.reduce((a, b) => a + b, 0);
    return sum / latencies.length;
  }
  
  /**
   * Track cache hit rate
   */
  trackCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) return 0;
    return this.cacheHits / total;
  }
  
  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    const allLatencies: number[] = [];
    const apiLatency: Record<string, number[]> = {};
    
    // Collect all latencies
    this.latencyMap.forEach((latencies, endpoint) => {
      apiLatency[endpoint] = latencies;
      allLatencies.push(...latencies);
    });
    
    return {
      apiLatency,
      cacheHitRate: this.trackCacheHitRate(),
      totalRequests: this.requestCount,
      averageResponseTime: allLatencies.length > 0 
        ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length 
        : 0,
      p95ResponseTime: this.calculatePercentile(allLatencies, 95),
      p99ResponseTime: this.calculatePercentile(allLatencies, 99),
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      timestamp: new Date()
    };
  }
  
  /**
   * Analyze bottlenecks in the system
   */
  analyzeBottlenecks(): PerformanceReport {
    const metrics = this.getMetrics();
    const bottlenecks: Bottleneck[] = [];
    const recommendations: string[] = [];
    
    // Check overall latency
    if (metrics.averageResponseTime > this.THRESHOLDS.ACCEPTABLE_LATENCY) {
      bottlenecks.push({
        component: 'Overall System',
        severity: 'critical',
        impact: `Average response time (${(metrics.averageResponseTime / 1000).toFixed(1)}s) exceeds acceptable threshold`,
        recommendation: 'Investigate slow endpoints and consider caching or optimization'
      });
    } else if (metrics.averageResponseTime > this.THRESHOLDS.GOOD_LATENCY) {
      bottlenecks.push({
        component: 'Overall System',
        severity: 'medium',
        impact: `Average response time (${(metrics.averageResponseTime / 1000).toFixed(1)}s) could be improved`,
        recommendation: 'Consider implementing response caching and query optimization'
      });
    }
    
    // Check cache hit rate
    if (metrics.cacheHitRate < this.THRESHOLDS.MIN_CACHE_HIT_RATE) {
      bottlenecks.push({
        component: 'Cache System',
        severity: 'high',
        impact: `Low cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%) causing unnecessary API calls`,
        recommendation: 'Increase cache TTL or implement smarter cache invalidation'
      });
      recommendations.push('Implement Redis or Upstash for distributed caching');
    } else if (metrics.cacheHitRate < this.THRESHOLDS.TARGET_CACHE_HIT_RATE) {
      recommendations.push(`Improve cache hit rate from ${(metrics.cacheHitRate * 100).toFixed(1)}% to target 70%`);
    }
    
    // Check error rate
    if (metrics.errorRate > this.THRESHOLDS.MAX_ERROR_RATE) {
      bottlenecks.push({
        component: 'Error Handling',
        severity: 'critical',
        impact: `High error rate (${(metrics.errorRate * 100).toFixed(1)}%) affecting user experience`,
        recommendation: 'Review error logs and implement better error recovery'
      });
    }
    
    // Check specific endpoints
    const endpointMetrics: Record<string, EndpointMetrics> = {};
    
    this.latencyMap.forEach((latencies, endpoint) => {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      
      endpointMetrics[endpoint] = {
        endpoint,
        requests: latencies.length,
        averageLatency: avgLatency,
        p95Latency: this.calculatePercentile(latencies, 95),
        p99Latency: this.calculatePercentile(latencies, 99),
        errorCount: 0, // Would need separate tracking
        cacheHits: 0,  // Would need separate tracking per endpoint
        cacheMisses: 0
      };
      
      // Check for slow endpoints
      if (avgLatency > this.THRESHOLDS.ACCEPTABLE_LATENCY) {
        bottlenecks.push({
          component: `Endpoint: ${endpoint}`,
          severity: avgLatency > this.THRESHOLDS.ACCEPTABLE_LATENCY * 2 ? 'critical' : 'high',
          impact: `Slow endpoint with ${(avgLatency / 1000).toFixed(1)}s average latency`,
          recommendation: endpoint.includes('retrieve') 
            ? 'Optimize vector search or reduce embedding dimensions'
            : endpoint.includes('rerank')
            ? 'Consider using a faster model or batching requests'
            : 'Profile and optimize endpoint logic'
        });
      }
    });
    
    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct points for latency
    if (metrics.averageResponseTime > this.THRESHOLDS.ACCEPTABLE_LATENCY) {
      healthScore -= 30;
    } else if (metrics.averageResponseTime > this.THRESHOLDS.GOOD_LATENCY) {
      healthScore -= 15;
    } else if (metrics.averageResponseTime > this.THRESHOLDS.EXCELLENT_LATENCY) {
      healthScore -= 5;
    }
    
    // Deduct points for cache hit rate
    if (metrics.cacheHitRate < this.THRESHOLDS.MIN_CACHE_HIT_RATE) {
      healthScore -= 20;
    } else if (metrics.cacheHitRate < this.THRESHOLDS.TARGET_CACHE_HIT_RATE) {
      healthScore -= 10;
    }
    
    // Deduct points for error rate
    if (metrics.errorRate > this.THRESHOLDS.MAX_ERROR_RATE) {
      healthScore -= 25;
    } else if (metrics.errorRate > 0.01) {
      healthScore -= 10;
    }
    
    // Generate recommendations based on health score
    if (healthScore < 50) {
      recommendations.unshift('⚠️ URGENT: System performance is critically degraded');
    } else if (healthScore < 70) {
      recommendations.unshift('System performance needs improvement');
    } else if (healthScore >= 90) {
      recommendations.unshift('✅ System performance is excellent');
    }
    
    // Additional recommendations
    if (metrics.p99ResponseTime > metrics.averageResponseTime * 3) {
      recommendations.push('High variance in response times - investigate outliers');
    }
    
    const runTime = (Date.now() - this.startTime.getTime()) / 1000;
    
    return {
      summary: {
        period: `${runTime.toFixed(0)} seconds`,
        totalRequests: this.requestCount,
        averageLatency: metrics.averageResponseTime,
        cacheHitRate: metrics.cacheHitRate,
        errorRate: metrics.errorRate,
        healthScore: Math.max(0, healthScore)
      },
      endpoints: endpointMetrics,
      bottlenecks,
      recommendations
    };
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.latencyMap.clear();
    this.startTime = new Date();
    this.requestCount = 0;
    this.errorCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): string {
    const report = this.analyzeBottlenecks();
    return JSON.stringify(report, null, 2);
  }
  
  /**
   * Log performance summary
   */
  logSummary(): void {
    const report = this.analyzeBottlenecks();
    
    console.log('\n📊 Performance Summary');
    console.log('======================');
    console.log(`Period: ${report.summary.period}`);
    console.log(`Requests: ${report.summary.totalRequests}`);
    console.log(`Avg Latency: ${(report.summary.averageLatency / 1000).toFixed(2)}s`);
    console.log(`Cache Hit Rate: ${(report.summary.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Error Rate: ${(report.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`Health Score: ${report.summary.healthScore}/100`);
    
    if (report.bottlenecks.length > 0) {
      console.log('\n⚠️ Bottlenecks:');
      report.bottlenecks.forEach(b => {
        const icon = b.severity === 'critical' ? '🔴' : b.severity === 'high' ? '🟠' : '🟡';
        console.log(`${icon} ${b.component}: ${b.impact}`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(r => console.log(`  - ${r}`));
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor };