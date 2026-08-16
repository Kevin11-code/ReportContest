const db = require('./db');

console.log('Cleaning database: removing all dummy participants, submissions, and audit logs...');

// Reset all participant and submission tables
db.resetContest();

const defaultProblem = `# Technical Assessment & Architecture Report

### 1. Scenario & Challenge
Evaluate the engineering, operational, and sustainability implications of deploying an autonomous campus micro-grid powered by rooftop solar PV and smart battery energy storage systems (BESS).

### 2. Required Report Sections
- **Executive Summary & Feasibility**: High-level problem breakdown and financial/technical viability.
- **System Architecture & Load Balancing**: Distribution topology, backup priorities, and peak shaving.
- **Cybersecurity & Offline Resiliency**: Isolated SCADA networks and air-gapped failsafe protocols.
- **Risk Mitigation & Phased Roadmap**: Implementation timeline and risk matrix.

### 3. Deliverables & Constraints
- **Word Limit**: 500 – 1500 words.
- Use clear headings, bullet points, and actionable engineering recommendations.`;

db.updateContestConfig({
  title: 'Offline Technical Report Writing Contest',
  problem_statement: defaultProblem,
  duration_minutes: 60
});

console.log('✅ Database cleaned successfully! 0 participants, 0 submissions, 0 audit logs. Contest state: WAITING.');
