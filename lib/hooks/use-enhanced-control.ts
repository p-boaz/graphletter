"use client";

import { useEffect, useState } from "react";

interface Risk {
  id: string;
  title: string;
  description: string;
  risk_grouping: string;
  nist_csf_function: string;
}

interface Threat {
  id: string;
  title: string;
  description: string;
  threat_grouping: string;
}

interface MaturityLevels {
  scf_control_id: string;
  level_0_description: string | null;
  level_1_description: string | null;
  level_2_description: string | null;
  level_3_description: string | null;
  level_4_description: string | null;
  level_5_description: string | null;
}

interface EnhancedControlData {
  risks: Risk[];
  threats: Threat[];
  maturity_levels: MaturityLevels | null;
}

export function useEnhancedControl(controlId: string) {
  const [data, setData] = useState<EnhancedControlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchControlData() {
      if (!controlId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/scf/controls/${controlId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch control data");
        }

        const result = await response.json();
        setData({
          risks: result.risks || [],
          threats: result.threats || [],
          maturity_levels: result.maturity_levels || null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchControlData();
  }, [controlId]);

  return { data, loading, error };
}
