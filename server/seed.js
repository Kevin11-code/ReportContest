const db = require('./db');

console.log('Seeding sample test data into SQLite database...');

// Reset current contest state
db.resetContest();

// Configure realistic problem statement
db.updateContestConfig({
  title: 'Annual Campus Technical Report Challenge 2026',
  problem_statement: `### Scenario & Objective

Your institution is considering deploying an autonomous campus micro-grid powered by rooftop solar panels, battery energy storage systems (BESS), and smart IoT power meters across department buildings.

### Report Requirements:
1. **Executive Summary & Feasibility Analysis**: Evaluate technical and financial viability.
2. **Architecture & Power Distribution Strategy**: Detail peak load balancing and backup power priority.
3. **Cybersecurity & Offline Resiliency**: Outline measures to prevent network intrusions and ensure offline operation when external power or grid internet fails.
4. **Implementation Timeline & Risk Mitigation Matrix**: Provide phased rollout and mitigation strategy.

*Word limit: 500 - 1500 words. Format with clear headings, bullet points, and actionable recommendations.*`,
  duration_minutes: 60
});

// Seed 12 sample participants with diverse states & integrity logs
const sampleParticipants = [
  { id: 'CS-2024-001', name: 'Aarav Sharma', status: 'submitted', words: 680, flags: [{ type: 'tab_switch', detail: 'Switched away for 3s', sev: 'medium' }] },
  { id: 'CS-2024-002', name: 'Priya Patel', status: 'writing', words: 430, flags: [] },
  { id: 'CS-2024-003', name: 'Rohan Verma', status: 'submitted', words: 890, flags: [] },
  { id: 'CS-2024-004', name: 'Sneha Iyer', status: 'writing', words: 510, flags: [{ type: 'fullscreen_exit', detail: 'Exited fullscreen mode', sev: 'medium' }] },
  { id: 'CS-2024-005', name: 'Vikram Malhotra', status: 'submitted', words: 720, flags: [{ type: 'paste_attempt', detail: 'Blocked Ctrl+V paste attempt', sev: 'high' }, { type: 'tab_switch', detail: 'Tab blur detected', sev: 'medium' }] },
  { id: 'CS-2024-006', name: 'Ananya Deshmukh', status: 'auto_submitted', words: 340, flags: [] },
  { id: 'CS-2024-007', name: 'Kabir Mehta', status: 'writing', words: 290, flags: [] },
  { id: 'CS-2024-008', name: 'Diya Sen', status: 'submitted', words: 950, flags: [] },
  { id: 'CS-2024-009', name: 'Aditya Rao', status: 'registered', words: 0, flags: [] },
  { id: 'CS-2024-010', name: 'Tanvi Joshi', status: 'writing', words: 610, flags: [{ type: 'typing_burst', detail: 'Burst typing rate: 190 WPM detected', sev: 'medium' }] },
  { id: 'CS-2024-011', name: 'Manish Kumar', status: 'submitted', words: 810, flags: [] },
  { id: 'CS-2024-012', name: 'Ishita Gupta', status: 'registered', words: 0, flags: [] }
];

sampleParticipants.forEach((sample, i) => {
  const ip = `192.168.1.${100 + i}`;
  const p = db.registerOrGetParticipant(sample.id, sample.name, ip, 'Mozilla/5.0 Chrome/120.0');

  if (sample.words > 0) {
    const htmlContent = `
      <h2>Executive Summary</h2>
      <p>The proposed autonomous campus micro-grid offers a <strong>sustainable, cost-effective solution</strong> for campus energy independence. By integrating high-efficiency monocrystalline solar PV arrays with lithium iron phosphate (LiFePO4) BESS units, the institution can reduce peak tariff expenditure by 42%.</p>
      
      <h2>Technical Architecture</h2>
      <ul>
        <li><strong>Solar Generation Capacity:</strong> 250 kWp installed across Engineering and Library blocks.</li>
        <li><strong>Storage Unit:</strong> 500 kWh containerized modular BESS.</li>
        <li><strong>Smart Metering & Telemetry:</strong> Modbus RS-485 sensors with local edge controller fallback.</li>
      </ul>
      
      <h2>Resiliency & Cybersecurity</h2>
      <p>To guarantee complete offline continuity during grid blackout, an isolated SCADA network operates on an air-gapped subnet with hardware-level firewall segmentation.</p>
    `;

    db.saveDraft(sample.id, {
      content_html: htmlContent,
      content_text: 'The proposed autonomous campus micro-grid offers a sustainable, cost-effective solution...',
      word_count: sample.words,
      char_count: sample.words * 6
    });
  }

  // Insert mock flags
  sample.flags.forEach(f => {
    db.logAuditEvent(sample.id, f.type, f.detail, f.sev);
  });

  if (sample.status === 'submitted') {
    db.submitFinal(sample.id, false);
  } else if (sample.status === 'auto_submitted') {
    db.submitFinal(sample.id, true);
  }
});

console.log('✅ Seed completed successfully! Added 12 sample participants with reports & audit logs.');
