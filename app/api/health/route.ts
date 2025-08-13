import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { performanceMonitor } from '@/services/performance-monitor';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  services: {
    qdrant: ServiceHealth;
    openai: ServiceHealth;
    database: ServiceHealth;
  };
  performance: {
    averageLatency: number;
    cacheHitRate: number;
    errorRate: number;
    healthScore: number;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    version: string;
    environment: string;
  };
  recentErrors?: string[];
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: string;
  error?: string;
}

// Track start time
const startTime = new Date();

// Track recent errors
const recentErrors: string[] = [];
const MAX_RECENT_ERRORS = 10;

function trackError(error: string) {
  recentErrors.unshift(error);
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.pop();
  }
}

/**
 * Check Qdrant health
 */
async function checkQdrantHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    const collection = process.env.QDRANT_COLLECTION || 'materials_passages';
    
    if (!url) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: 'QDRANT_URL not configured'
      };
    }
    
    const client = new QdrantClient({ url, apiKey });
    
    // Try to get collection info
    const info = await client.getCollection(collection);
    const latency = Date.now() - start;
    
    // Check if collection has data
    const hasData = info.points_count !== null && info.points_count !== undefined && info.points_count > 0;
    
    if (!hasData) {
      return {
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        error: 'Collection exists but has no data'
      };
    }
    
    // If latency is high, mark as degraded
    if (latency > 5000) {
      return {
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        error: `High latency: ${latency}ms`
      };
    }
    
    return {
      status: 'healthy',
      latency,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check OpenAI health
 */
async function checkOpenAIHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: 'OPENAI_API_KEY not configured'
      };
    }
    
    // Make a simple API call to check connectivity
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const latency = Date.now() - start;
    
    if (!response.ok) {
      return {
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        error: `API returned status ${response.status}`
      };
    }
    
    // If latency is high, mark as degraded
    if (latency > 3000) {
      return {
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        error: `High latency: ${latency}ms`
      };
    }
    
    return {
      status: 'healthy',
      latency,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check database health (localStorage/sessionStorage simulation)
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    // In a real app, this would check Firebase/Firestore
    // For now, we'll simulate a healthy database
    const latency = Math.random() * 100; // Simulate 0-100ms latency
    
    return {
      status: 'healthy',
      latency,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * GET /api/health
 * Returns comprehensive health status
 */
export async function GET(req: NextRequest) {
  try {
    // Run health checks in parallel
    const [qdrantHealth, openaiHealth, databaseHealth] = await Promise.all([
      checkQdrantHealth(),
      checkOpenAIHealth(),
      checkDatabaseHealth()
    ]);
    
    // Get performance metrics
    const perfReport = performanceMonitor.analyzeBottlenecks();
    
    // Calculate overall status
    const services = { qdrant: qdrantHealth, openai: openaiHealth, database: databaseHealth };
    const unhealthyServices = Object.values(services).filter(s => s.status === 'down').length;
    const degradedServices = Object.values(services).filter(s => s.status === 'degraded').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (unhealthyServices > 0) {
      overallStatus = 'down';
    } else if (degradedServices > 0 || perfReport.summary.healthScore < 70) {
      overallStatus = 'degraded';
    }
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime.getTime(),
      services,
      performance: {
        averageLatency: perfReport.summary.averageLatency,
        cacheHitRate: perfReport.summary.cacheHitRate,
        errorRate: perfReport.summary.errorRate,
        healthScore: perfReport.summary.healthScore
      },
      system: {
        memory: {
          used: Math.round(usedMemory / 1024 / 1024), // MB
          total: Math.round(totalMemory / 1024 / 1024), // MB
          percentage: Math.round((usedMemory / totalMemory) * 100)
        },
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    // Add recent errors if any
    if (recentErrors.length > 0) {
      healthStatus.recentErrors = recentErrors.slice(0, 5);
    }
    
    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'down',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime.getTime(),
      error: error instanceof Error ? error.message : 'Health check failed',
      services: {
        qdrant: { status: 'down', lastCheck: new Date().toISOString() },
        openai: { status: 'down', lastCheck: new Date().toISOString() },
        database: { status: 'down', lastCheck: new Date().toISOString() }
      },
      performance: {
        averageLatency: 0,
        cacheHitRate: 0,
        errorRate: 1,
        healthScore: 0
      },
      system: {
        memory: { used: 0, total: 0, percentage: 0 },
        version: '0.1.0',
        environment: 'unknown'
      }
    }, { status: 503 });
  }
}

/**
 * POST /api/health/report-error
 * Report an error to the health monitoring system
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { error, context } = body;
    
    if (error) {
      const errorMessage = `[${new Date().toISOString()}] ${error}${context ? ` (${context})` : ''}`;
      trackError(errorMessage);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to report error' }, { status: 400 });
  }
}