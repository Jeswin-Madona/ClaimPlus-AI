'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle2,
  UserCheck,
  RefreshCw,
  FileText,
  Zap,
  AlertCircle,
  ShieldAlert,
  DollarSign,
  Copy,
  Check,
  Printer,
  Sliders,
  ChevronRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ClaimInput {
  patient_id: string;
  patient_name: string;
  diagnosis_narrative: string;
  icd10_code: string;
  cpt_code: string;
  room_rent_billed: number;
  surgery_fee_billed: number;
  medicine_fee_billed: number;
  sum_insured: number;
}

export interface Deduction {
  category: string;
  claimed: number;
  allowed: number;
  deducted: number;
  reason: string;
}

export interface FinancialBreakdown {
  room_rent_billed: number;
  surgery_fee_billed: number;
  medicine_fee_billed: number;
  sum_insured: number;
  max_allowed_room_rent: number;
  total_billed: number;
  total_deducted: number;
  total_approved: number;
  deductions: Deduction[];
}

export interface AdjudicationResponse {
  status: 'APPROVED' | 'PENDING_REVIEW' | 'OVERRIDDEN';
  patient_id: string;
  patient_name?: string;
  diagnosis_narrative?: string;
  icd10_code: string;
  cpt_code: string;
  confidence_score: number;
  discrepancy_flags: string[];
  financial_breakdown: FinancialBreakdown;
  adjudication_timestamp: string;
  supervisor_note?: string;
  overridden_at?: string;
  _meta?: {
    usedEndpoint?: string;
    processedAt?: string;
  };
}

const PRESETS: { id: string; name: string; tag: string; description: string; data: ClaimInput }[] = [
  {
    id: 'TC-01',
    name: 'TC-01: Clean Appendectomy (Auto-Approve)',
    tag: 'Auto-Approve',
    description: 'Matching Codes (K35.80 + 44970) & Room Rent within 1% Cap',
    data: {
      patient_id: 'PAT-8831',
      patient_name: 'Rahul Sharma',
      diagnosis_narrative: 'Acute Appendicitis with laparoscopic appendectomy',
      icd10_code: 'K35.80',
      cpt_code: '44970',
      room_rent_billed: 4000,
      surgery_fee_billed: 60000,
      medicine_fee_billed: 8500,
      sum_insured: 500000
    }
  },
  {
    id: 'TC-02',
    name: 'TC-02: Coding Mismatch (Escalate)',
    tag: 'Escalate',
    description: 'ICD K35.80 matched with CPT 99213 (Outpatient Visit)',
    data: {
      patient_id: 'PAT-9042',
      patient_name: 'Anita Desai',
      diagnosis_narrative: 'Acute Appendicitis, conservative management billed as outpatient visit',
      icd10_code: 'K35.80',
      cpt_code: '99213',
      room_rent_billed: 3500,
      surgery_fee_billed: 15000,
      medicine_fee_billed: 4200,
      sum_insured: 500000
    }
  },
  {
    id: 'TC-03',
    name: 'TC-03: Sub-Limit Cap Breach (Auto-Deduct)',
    tag: 'Auto-Deduct',
    description: 'Room Rent ₹12,000 breaches 1% Sum Insured Cap (Max ₹3,000)',
    data: {
      patient_id: 'PAT-7719',
      patient_name: 'Vikram Malhotra',
      diagnosis_narrative: 'Acute Appendicitis with deluxe room suite charges',
      icd10_code: 'K35.80',
      cpt_code: '44970',
      room_rent_billed: 12000,
      surgery_fee_billed: 65000,
      medicine_fee_billed: 9000,
      sum_insured: 300000
    }
  }
];

export default function Page() {
  const [formData, setFormData] = useState<ClaimInput>(PRESETS[0].data);
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(PRESETS[0].data, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AdjudicationResponse | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Supervisor Action state
  const [supervisorNote, setSupervisorNote] = useState<string>('');
  const [isOverriding, setIsOverriding] = useState<boolean>(false);

  // Execution History
  const [history, setHistory] = useState<{ id: string; timestamp: string; status: string; patient: string; confidence: number }[]>([]);

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    setFormData(preset.data);
    setJsonText(JSON.stringify(preset.data, null, 2));
    setJsonError(null);
  };

  const handleInputChange = (field: keyof ClaimInput, value: string | number) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setFormData(parsed);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  const runAdjudication = async () => {
    let payload = formData;
    if (activeTab === 'json') {
      try {
        payload = JSON.parse(jsonText);
      } catch (e) {
        setJsonError('Invalid JSON syntax');
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/adjudicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const duration = Math.round(performance.now() - start);
      setExecutionTimeMs(duration);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }

      setResult(data);

      setHistory((prev) => [
        {
          id: data.patient_id || payload.patient_id,
          timestamp: new Date().toLocaleTimeString(),
          status: data.status,
          patient: data.patient_name || payload.patient_name,
          confidence: data.confidence_score
        },
        ...prev.slice(0, 9)
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with /api/adjudicate route.');
    } finally {
      setLoading(false);
    }
  };

  const handleSupervisorOverride = () => {
    if (!result) return;
    setIsOverriding(true);
    setTimeout(() => {
      setResult({
        ...result,
        status: 'OVERRIDDEN',
        supervisor_note: supervisorNote || 'Verified clinical narrative & approved by Senior Medical Auditor.',
        overridden_at: new Date().toISOString()
      });
      setIsOverriding(false);
    }, 400);
  };

  const handlePrintMemo = () => {
    window.print();
  };

  const copyApiUrl = () => {
    navigator.clipboard.writeText('/api/adjudicate');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-gray-100 flex flex-col font-sans print:bg-white print:text-black">
      {/* HEADER */}
      <header className="border-b border-gray-800/80 bg-[#0E1526]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-[#080C14] rounded-[11px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-emerald-400 bg-clip-text text-transparent">
              ClaimPulse AI — Autonomous Health Claim Adjudication
            </h1>
            <p className="text-xs text-gray-400">
              Real-time ICD-10/CPT coding verification and policy sub-limit compliance engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 bg-[#172033]/90 border border-gray-700/60 rounded-lg px-3 py-1.5 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-gray-200 font-medium">n8n Engine Active</span>
            <button
              onClick={copyApiUrl}
              className="ml-2 pl-2 border-l border-gray-700 text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-1 font-mono text-[11px]"
              title="Click to copy API Route endpoint"
            >
              {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>POST /api/adjudicate</span>
            </button>
          </div>
        </div>
      </header>

      {/* PRINT-ONLY MEMO HEADER */}
      <div className="hidden print:block p-8 border-b border-gray-300">
        <h1 className="text-2xl font-bold">ClaimPulse AI — Adjudication Settlement Summary</h1>
        <p className="text-sm text-gray-600">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* MAIN DUAL-PANE CONTAINER */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
        {/* LEFT PANEL: CLAIM INTAKE & TEST FIXTURES (Col 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6 print:hidden">
          {/* PRESET SELECTOR CARD */}
          <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-semibold text-gray-200 tracking-wider uppercase">Test Scenario Presets</h2>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">1-Click Loading</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all flex flex-col justify-between relative overflow-hidden group',
                    formData.patient_id === preset.data.patient_id
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/40'
                      : 'bg-[#141C2E]/60 border-gray-800 hover:border-gray-700 hover:bg-[#141C2E]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-100 font-mono">{preset.name}</span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded font-semibold',
                        preset.id === 'TC-01'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : preset.id === 'TC-02'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      )}
                    >
                      {preset.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight mt-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* INTERACTIVE FORM / JSON PAYLOAD EDITOR */}
          <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-semibold text-gray-200 tracking-wider uppercase">Claim Intake Form</h2>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center bg-[#172033] p-1 rounded-lg border border-gray-700/60 text-xs">
                <button
                  onClick={() => setActiveTab('form')}
                  className={cn(
                    'px-3 py-1 rounded-md font-medium transition-all',
                    activeTab === 'form' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-gray-200'
                  )}
                >
                  Interactive Form
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={cn(
                    'px-3 py-1 rounded-md font-medium transition-all',
                    activeTab === 'json' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-gray-200'
                  )}
                >
                  Raw JSON
                </button>
              </div>
            </div>

            {activeTab === 'form' ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">Patient ID</label>
                    <input
                      type="text"
                      value={formData.patient_id}
                      onChange={(e) => handleInputChange('patient_id', e.target.value)}
                      className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-3 py-2 text-gray-200 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">Patient Name</label>
                    <input
                      type="text"
                      value={formData.patient_name}
                      onChange={(e) => handleInputChange('patient_name', e.target.value)}
                      className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-3 py-2 text-gray-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Diagnosis Narrative</label>
                  <textarea
                    rows={2}
                    value={formData.diagnosis_narrative}
                    onChange={(e) => handleInputChange('diagnosis_narrative', e.target.value)}
                    className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-3 py-2 text-gray-200 focus:border-emerald-500 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">ICD-10 Diagnosis Code</label>
                    <input
                      type="text"
                      value={formData.icd10_code}
                      onChange={(e) => handleInputChange('icd10_code', e.target.value)}
                      className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-3 py-2 text-emerald-400 font-mono font-semibold focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">K35.80 = Acute Appendicitis</span>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">CPT Procedure Code</label>
                    <input
                      type="text"
                      value={formData.cpt_code}
                      onChange={(e) => handleInputChange('cpt_code', e.target.value)}
                      className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-3 py-2 text-cyan-300 font-mono font-semibold focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">44970 = Laparoscopic Appendectomy</span>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-3 mt-2">
                  <span className="text-gray-400 font-semibold block mb-2 text-[11px] uppercase tracking-wider">Itemized Hospital Billing (₹)</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Room Rent</label>
                      <input
                        type="number"
                        value={formData.room_rent_billed}
                        onChange={(e) => handleInputChange('room_rent_billed', Number(e.target.value))}
                        className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-2.5 py-2 text-gray-200 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Surgery Fee</label>
                      <input
                        type="number"
                        value={formData.surgery_fee_billed}
                        onChange={(e) => handleInputChange('surgery_fee_billed', Number(e.target.value))}
                        className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-2.5 py-2 text-gray-200 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Pharmacy</label>
                      <input
                        type="number"
                        value={formData.medicine_fee_billed}
                        onChange={(e) => handleInputChange('medicine_fee_billed', Number(e.target.value))}
                        className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-2.5 py-2 text-gray-200 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Policy Sum Insured (₹)</label>
                  <input
                    type="number"
                    value={formData.sum_insured}
                    onChange={(e) => handleInputChange('sum_insured', Number(e.target.value))}
                    className="w-full bg-[#141C2E] border border-gray-700/80 rounded-lg px-3 py-2 text-amber-300 font-mono font-semibold focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">1% Room Rent Cap = ₹{(formData.sum_insured * 0.01).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full flex-1 min-h-[340px] bg-[#080C14] border border-gray-800 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/80 resize-none leading-relaxed"
                />
                {jsonError && <p className="text-rose-400 text-xs mt-2 font-mono">{jsonError}</p>}
              </div>
            )}

            {/* ACTION BUTTON */}
            <button
              onClick={runAdjudication}
              disabled={loading || !!jsonError}
              className={cn(
                'w-full mt-5 py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all',
                loading || !!jsonError
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-gray-950 font-bold hover:brightness-110 active:scale-[0.99] shadow-emerald-500/25 border border-emerald-400/30'
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-950" />
                  <span>Evaluating Claim via n8n...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-gray-950 fill-current" />
                  <span>Adjudicate Claim</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: ADJUDICATION TRACE & FINANCIAL SETTLEMENT (Col 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {errorMsg && (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-4 text-rose-200 flex items-start gap-3 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-rose-300">Adjudication Communication Failure</h4>
                <p className="mt-1 leading-relaxed text-rose-200/90">{errorMsg}</p>
              </div>
            </div>
          )}

          {!result && !loading && !errorMsg && (
            <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center flex-1 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700 flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-300">Adjudication Engine Awaiting Input</h3>
              <p className="text-xs text-gray-400 max-w-md mt-2 leading-relaxed">
                Select one of the 1-click scenario presets on the left or enter custom claim parameters, then click <strong className="text-emerald-400">Adjudicate Claim</strong> to execute automated clinical code verification.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center flex-1 shadow-xl">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin"></div>
                <Zap className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto" />
              </div>
              <h3 className="text-base font-semibold text-gray-200 animate-pulse">Running Clinical Code & Sub-Limit Verification...</h3>
              <p className="text-xs text-gray-400 mt-2 font-mono">Routing payload through /api/adjudicate → n8n engine</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6">
              {/* STATUS BANNER */}
              <div
                className={cn(
                  'border rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all',
                  result.status === 'APPROVED'
                    ? 'bg-gradient-to-r from-emerald-950/60 via-[#0E1526] to-[#0E1526] border-emerald-500/50 shadow-emerald-950/40'
                    : result.status === 'OVERRIDDEN'
                    ? 'bg-gradient-to-r from-teal-950/60 via-[#0E1526] to-[#0E1526] border-teal-500/50 shadow-teal-950/40'
                    : 'bg-gradient-to-r from-amber-950/60 via-[#0E1526] to-[#0E1526] border-amber-500/50 shadow-amber-950/40'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg',
                        result.status === 'APPROVED'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20'
                          : result.status === 'OVERRIDDEN'
                          ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-teal-500/20'
                          : 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-amber-500/20'
                      )}
                    >
                      {result.status === 'APPROVED' ? (
                        <CheckCircle2 className="w-8 h-8" />
                      ) : result.status === 'OVERRIDDEN' ? (
                        <UserCheck className="w-8 h-8" />
                      ) : (
                        <AlertTriangle className="w-8 h-8" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-mono text-gray-400">Adjudication Result</span>
                        {executionTimeMs !== null && (
                          <span className="text-[11px] font-mono text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded">
                            {executionTimeMs} ms
                          </span>
                        )}
                      </div>
                      <h2
                        className={cn(
                          'text-2xl font-black tracking-tight',
                          result.status === 'APPROVED'
                            ? 'text-emerald-400'
                            : result.status === 'OVERRIDDEN'
                            ? 'text-teal-300'
                            : 'text-amber-400'
                        )}
                      >
                        {result.status === 'APPROVED'
                          ? 'APPROVED'
                          : result.status === 'OVERRIDDEN'
                          ? 'APPROVED (SUPERVISOR OVERRIDE)'
                          : 'PENDING_REVIEW'}
                      </h2>
                      <p className="text-xs text-gray-300 mt-0.5">
                        Patient: <span className="font-mono text-white font-semibold">{result.patient_name || formData.patient_name}</span> ({result.patient_id})
                      </p>
                    </div>
                  </div>

                  {/* COMPOSITE CONFIDENCE GAUGE */}
                  <div className="flex items-center gap-3 bg-[#172033]/80 border border-gray-800 rounded-xl p-3">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-mono block">Confidence Score</span>
                      <span
                        className={cn(
                          'text-2xl font-mono font-black',
                          result.confidence_score >= 0.85 ? 'text-emerald-400' : 'text-amber-400'
                        )}
                      >
                        {Math.round(result.confidence_score * 100)}%
                      </span>
                    </div>
                    <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-500',
                          result.confidence_score >= 0.85 ? 'bg-emerald-400' : 'bg-amber-400'
                        )}
                        style={{ width: `${Math.round(result.confidence_score * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {result.supervisor_note && (
                  <div className="mt-4 pt-3 border-t border-teal-500/30 text-xs text-teal-200 bg-teal-950/30 rounded-lg p-3">
                    <strong className="text-teal-400 font-semibold block mb-1">Supervisor Sign-off Note:</strong>
                    {result.supervisor_note}
                  </div>
                )}
              </div>

              {/* DISCREPANCY & COMPLIANCE FLAGS */}
              <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  Compliance & Discrepancy Verification Trace
                </h3>

                {result.discrepancy_flags.length === 0 ? (
                  <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>0 Discrepancy Flags. ICD-10 and CPT codes match cleanly with all policy limits.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.discrepancy_flags.map((flag, idx) => (
                      <div key={idx} className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed font-mono">{flag}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FINANCIAL SETTLEMENT LEDGER */}
              <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Financial Settlement Ledger
                  </span>
                  <button
                    onClick={handlePrintMemo}
                    className="text-xs text-gray-400 hover:text-emerald-400 flex items-center gap-1 transition-colors print:hidden"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Memo</span>
                  </button>
                </h3>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#172033]/60 border border-gray-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-400 block font-mono">TOTAL BILLED</span>
                    <span className="text-base font-bold text-gray-100 font-mono">₹{result.financial_breakdown.total_billed.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#172033]/60 border border-gray-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-400 block font-mono">TOTAL DEDUCTIONS</span>
                    <span className="text-base font-bold text-rose-400 font-mono">-₹{result.financial_breakdown.total_deducted.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#172033]/60 border border-emerald-900/40 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-emerald-400 block font-mono">APPROVED SETTLEMENT</span>
                    <span className="text-base font-bold text-emerald-300 font-mono">₹{result.financial_breakdown.total_approved.toLocaleString()}</span>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="overflow-x-auto border border-gray-800 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#172033] text-gray-400 border-b border-gray-800">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Claimed (₹)</th>
                        <th className="p-2.5 text-right">Allowed (₹)</th>
                        <th className="p-2.5 text-right">Deducted (₹)</th>
                        <th className="p-2.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-gray-300">
                      <tr>
                        <td className="p-2.5 font-medium">Room Rent</td>
                        <td className="p-2.5 text-right">₹{result.financial_breakdown.room_rent_billed.toLocaleString()}</td>
                        <td className="p-2.5 text-right">₹{result.financial_breakdown.max_allowed_room_rent.toLocaleString()}</td>
                        <td className={cn('p-2.5 text-right font-semibold', result.financial_breakdown.total_deducted > 0 ? 'text-rose-400' : 'text-gray-500')}>
                          -₹{result.financial_breakdown.total_deducted.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-gray-400 text-[11px]">
                          {result.financial_breakdown.total_deducted > 0 ? 'Breaches 1% Sum Insured Sub-limit Cap' : 'Within Policy Limits'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Surgery Fee ({result.cpt_code})</td>
                        <td className="p-2.5 text-right">₹{result.financial_breakdown.surgery_fee_billed.toLocaleString()}</td>
                        <td className="p-2.5 text-right">₹{result.financial_breakdown.surgery_fee_billed.toLocaleString()}</td>
                        <td className="p-2.5 text-right text-gray-500">₹0</td>
                        <td className="p-2.5 text-gray-400 text-[11px]">Fully Approved</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Pharmacy / Consumables</td>
                        <td className="p-2.5 text-right">₹{result.financial_breakdown.medicine_fee_billed.toLocaleString()}</td>
                        <td className="p-2.5 text-right">₹{result.financial_breakdown.medicine_fee_billed.toLocaleString()}</td>
                        <td className="p-2.5 text-right text-gray-500">₹0</td>
                        <td className="p-2.5 text-gray-400 text-[11px]">Fully Approved</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HUMAN-IN-THE-LOOP SUPERVISOR ACTIONS */}
              {result.status === 'PENDING_REVIEW' && (
                <div className="bg-gradient-to-r from-amber-950/40 via-[#0E1526] to-[#0E1526] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 print:hidden">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-300">Supervisor Override & Sign-off</h3>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    Automated adjudication flagged discrepancy risks. As a supervisor, you can sign off and override the claim status to <strong className="text-emerald-400">APPROVED (OVERRIDDEN)</strong>.
                  </p>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Supervisor Audit Note</label>
                    <input
                      type="text"
                      placeholder="e.g., Clinical documentation verified by medical director. Code mismatch accepted."
                      value={supervisorNote}
                      onChange={(e) => setSupervisorNote(e.target.value)}
                      className="w-full bg-[#172033] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSupervisorOverride}
                      disabled={isOverriding}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 font-bold rounded-xl text-xs hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      {isOverriding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Sign-off & Override to APPROVED</span>
                    </button>
                    <button
                      onClick={handlePrintMemo}
                      className="py-2.5 px-4 bg-[#172033] border border-gray-700 text-gray-200 font-semibold rounded-xl text-xs hover:border-gray-600 transition-all flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4 text-gray-400" />
                      <span>Export Memo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECENT HISTORY */}
          {history.length > 0 && (
            <div className="bg-[#0E1526]/90 border border-gray-800 rounded-2xl p-5 shadow-xl print:hidden">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Audit Execution History</h3>
              <div className="space-y-2">
                {history.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#172033]/40 border border-gray-800/80 rounded-xl p-2.5 text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          item.status === 'APPROVED' ? 'bg-emerald-400' : item.status === 'OVERRIDDEN' ? 'bg-teal-400' : 'bg-amber-400'
                        )}
                      />
                      <span className="text-gray-300">{item.id}</span>
                      <span className="text-gray-400 text-[11px]">({item.patient})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-[11px]">{Math.round(item.confidence * 100)}% Confidence</span>
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded font-bold',
                          item.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : item.status === 'OVERRIDDEN'
                            ? 'bg-teal-500/20 text-teal-300'
                            : 'bg-amber-500/20 text-amber-300'
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
