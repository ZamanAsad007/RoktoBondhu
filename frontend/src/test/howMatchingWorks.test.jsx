import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import HowMatchingWorks from '../pages/HowMatchingWorks';

describe('Phase 24: How Matching Works Page', () => {
  it('renders all matching diagrams, formulas, and concurrency explanations', () => {
    render(
      <MemoryRouter>
        <HowMatchingWorks />
      </MemoryRouter>
    );

    // Header & Intro
    expect(screen.getByText(/How RoktoBondhu Matching Works/i)).toBeInTheDocument();

    // 1. Proximity Expansion Waves
    expect(screen.getByText(/1\. Automated Proximity Expansion Waves/i)).toBeInTheDocument();
    expect(screen.getByText(/0 – 5 km Radius/i)).toBeInTheDocument();
    expect(screen.getByText(/5 – 10 km Radius/i)).toBeInTheDocument();
    expect(screen.getByText(/10 – 25 km Radius/i)).toBeInTheDocument();
    expect(screen.getByText(/SOS Escalation/i)).toBeInTheDocument();

    // 2. Candidate Ranking Formula
    expect(screen.getByText(/2\. Smart Candidate Ranking Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Proximity \(35%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Reliability \(25%\)/i)).toBeInTheDocument();

    // 3. Strict Concurrency
    expect(screen.getByText(/3\. Race-Proof Concurrency & State Machine/i)).toBeInTheDocument();
    expect(screen.getByText(/Request Lifecycle States/i)).toBeInTheDocument();
    expect(screen.getByText(/Donor Match States/i)).toBeInTheDocument();

    // 4. Privacy & Reliability Pillars
    expect(screen.getByText(/Masked In-App Chat/i)).toBeInTheDocument();
    expect(screen.getByText(/Transactional Outbox/i)).toBeInTheDocument();
    expect(screen.getByText(/Idempotent APIs/i)).toBeInTheDocument();
  });
});
