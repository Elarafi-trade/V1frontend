import { useState, useCallback } from 'react';

interface AgentAnalysis {
  correlation: number;
  beta: number;
  zScore: number;
  spreadMean: number;
  spreadStd: number;
  currentSpread: number;
  signalType: string;
}

interface AgentSignal {
  meetsThreshold: boolean;
  action: string;
  recommendation: string;
}

interface AgentResponse {
  pair: string;
  symbolA: string;
  symbolB: string;
  dataPoints: number;
  analysis: AgentAnalysis;
  signal: AgentSignal;
  narrative: string;
  timestamp: string;
}

export function useAgentAnalysis() {
  const [analysis, setAnalysis] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (symbolA: string, symbolB: string, limit = 100) => {
    setLoading(true);
    setError(null);

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      console.log(`🤖 Fetching analysis for ${symbolA} / ${symbolB}...`);
      
      const response = await fetch('https://pair-agent.onrender.com/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbolA,
          symbolB,
          limit,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
      }

      const data: AgentResponse = await response.json();
      setAnalysis(data);
      console.log('✅ Agent Analysis:', data);
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const errorMsg = 'Agent timeout - API is slow (render.com cold start)';
        setError(errorMsg);
        console.warn('⚠️ Agent API timeout:', errorMsg);
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch analysis';
        setError(errorMsg);
        console.error('❌ Agent Analysis Error:', err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    analysis,
    loading,
    error,
    fetchAnalysis,
    clearAnalysis,
  };
}

