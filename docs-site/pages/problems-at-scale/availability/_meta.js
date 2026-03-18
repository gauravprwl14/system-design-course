export default {
  "CONTEXT": { "display": "hidden" },
  index: "Overview",

  "--- Microservices ---": {
    type: "separator",
    title: "Microservices"
  },
  "cascading-failures": "🔴 Cascading Failures",
  "timeout-domino-effect": "🔴 Timeout Domino Effect",
  "circuit-breaker-failure": "🟡 Circuit Breaker Stuck Open/Closed",
  "retry-storm": "🟡 Retry Storm",

  "--- Distributed Systems ---": {
    type: "separator",
    title: "Distributed Systems"
  },
  "split-brain": "🔴 Split-Brain / Dual Masters",

  "--- Content Platforms ---": {
    type: "separator",
    title: "Content Platforms"
  },
  "thundering-herd": "🔴 Thundering Herd / Cache Stampede"
}
