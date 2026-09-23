/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Question, Option, QuizLanguage, QuizMode, ExamHistoryEntry, PersistedSettings } from "./types";
import QuestionManager from "./components/QuestionManager";
import { ConceptsViewer } from "./components/ConceptsViewer";
import { HistoryView } from "./components/HistoryView";
import { QuestionSidebar } from "./components/QuestionSidebar";
import { ExamResultsPanel } from "./components/ExamResultsPanel";
import ReactMarkdown from "react-markdown";
import { loadSampleQuestions } from "./sampleQuestions";
import { loadJSON, saveJSON, loadSessionSnapshot, STORAGE_KEYS } from "./utils/storage";
import { 
  Play, 
  HelpCircle, 
  Settings, 
  FileText, 
  Languages, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  X,
  AlertTriangle,
  Award,
  Sparkles,
  Database,
  BarChart2,
  Menu,
  Layers,
  History,
  RotateCcw
} from "lucide-react";

// Shape of the mid-session snapshot we persist so an accidental refresh
// (or closing the tab) doesn't wipe an in-progress practice/exam attempt.
interface SessionSnapshot {
  activeTab: "dashboard" | "exam" | "manager" | "concepts" | "historial";
  quizMode: QuizMode;
  activeQuestions: Question[];
  currentIdx: number;
  selectedAnswers: { [qId: string]: string[] };
  submittedAnswers: { [qId: string]: boolean };
  markedQuestions: { [qId: string]: boolean };
  aiExplanations: { [qId: string]: string };
  timeRemaining: number;
  timerActive: boolean;
  examSubmitted: boolean;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  quizLanguage: "mix",
  timerDuration: 130,
  examQuestionCount: 65,
  randomizeQuestions: true,
};

export default function App() {
  // Persisted user-editable settings (language, timer, question count, shuffle)
  const [settings, setSettings] = useState<PersistedSettings>(() =>
    loadJSON<PersistedSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );

  // Main database of questions — restored from localStorage so the bank
  // survives a page refresh instead of always starting empty.
  const [questions, setQuestions] = useState<Question[]>(() => loadJSON<Question[]>(STORAGE_KEYS.questionBank, []));
  const [currentIdx, setCurrentIdx] = useState<number>(
    () => loadSessionSnapshot<SessionSnapshot>()?.currentIdx ?? 0
  );

  // App views: "dashboard" (empty state / choose mode), "exam" (active simulator), "manager" (questions panel), "concepts" (glossary & cards), "historial" (past attempts & stats)
  const [activeTab, setActiveTab] = useState<"dashboard" | "exam" | "manager" | "concepts" | "historial">(
    () => loadSessionSnapshot<SessionSnapshot>()?.activeTab ?? "dashboard"
  );
  
  // User configs
  const [quizLanguage, setQuizLanguage] = useState<QuizLanguage>(settings.quizLanguage);
  const [quizMode, setQuizMode] = useState<QuizMode>(
    () => loadSessionSnapshot<SessionSnapshot>()?.quizMode ?? "practice"
  );
  const [timerDuration, setTimerDuration] = useState<number>(settings.timerDuration); // 130 minutes (AWS Exam standard)
  
  // Simulation configurations
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(
    () => loadSessionSnapshot<SessionSnapshot>()?.activeQuestions ?? []
  );
  const [examQuestionCount, setExamQuestionCount] = useState<number>(settings.examQuestionCount);
  const [randomizeQuestions, setRandomizeQuestions] = useState<boolean>(settings.randomizeQuestions);
  
  // State for exam simulator
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qId: string]: string[] }>(
    () => loadSessionSnapshot<SessionSnapshot>()?.selectedAnswers ?? {}
  );
  const [submittedAnswers, setSubmittedAnswers] = useState<{ [qId: string]: boolean }>(
    () => loadSessionSnapshot<SessionSnapshot>()?.submittedAnswers ?? {}
  );
  const [markedQuestions, setMarkedQuestions] = useState<{ [qId: string]: boolean }>(
    () => loadSessionSnapshot<SessionSnapshot>()?.markedQuestions ?? {}
  );
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);
  const [loadingSampleSet, setLoadingSampleSet] = useState<boolean>(false);
  
  // Explanations cache
  const [aiExplanations, setAiExplanations] = useState<{ [qId: string]: string }>(
    () => loadSessionSnapshot<SessionSnapshot>()?.aiExplanations ?? {}
  );
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number>(
    () => loadSessionSnapshot<SessionSnapshot>()?.timeRemaining ?? settings.timerDuration * 60
  );
  const [timerActive, setTimerActive] = useState<boolean>(
    () => loadSessionSnapshot<SessionSnapshot>()?.timerActive ?? false
  );
  const [examSubmitted, setExamSubmitted] = useState<boolean>(
    () => loadSessionSnapshot<SessionSnapshot>()?.examSubmitted ?? false
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Collapsible sidebar states
  const [sidebarPinned, setSidebarPinned] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Exam/practice attempt history — persisted separately from the live session.
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>(
    () => loadJSON<ExamHistoryEntry[]>(STORAGE_KEYS.examHistory, [])
  );
  // Guards against recording the same completed attempt into history twice
  // (e.g. re-renders after examSubmitted flips to true).
  const historyRecordedRef = useRef(false);
  // Skips the "auto-jump to exam tab" effect exactly once on first mount so
  // restoring a saved session doesn't get clobbered by the question-bank effect.
  const didMountRef = useRef(false);

  // Initialize view transitions and populate activeQuestions.
  // On the very first mount we may have just restored an in-progress
  // session from localStorage (its own activeQuestions/currentIdx/etc.),
  // so we skip the "jump to exam & reset activeQuestions" behavior once to
  // avoid clobbering it. On every subsequent change to `questions` (loading
  // a new bank, uploading JSON, etc.) the original behavior still applies.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      if (activeQuestions.length > 0) {
        return;
      }
    }
    if (questions.length > 0) {
      if (activeTab === "dashboard") {
        setActiveTab("exam");
      }
      setActiveQuestions(questions);
      setExamQuestionCount((prev) => Math.min(questions.length, prev || 65));
    }
  }, [questions]);

  // Persist the question bank whenever it changes.
  useEffect(() => {
    saveJSON(STORAGE_KEYS.questionBank, questions);
  }, [questions]);

  // Persist user settings whenever they change.
  useEffect(() => {
    const next: PersistedSettings = { quizLanguage, timerDuration, examQuestionCount, randomizeQuestions };
    setSettings(next);
    saveJSON(STORAGE_KEYS.settings, next);
  }, [quizLanguage, timerDuration, examQuestionCount, randomizeQuestions]);

  // Persist exam/practice history whenever it changes.
  useEffect(() => {
    saveJSON(STORAGE_KEYS.examHistory, examHistory);
  }, [examHistory]);

  // Persist the live session snapshot (debounced) so refreshing mid-attempt
  // doesn't lose progress. Skipped on dashboard/manager/concepts/historial
  // views with no active questions to avoid writing empty snapshots.
  useEffect(() => {
    const handle = setTimeout(() => {
      const snapshot: SessionSnapshot = {
        activeTab,
        quizMode,
        activeQuestions,
        currentIdx,
        selectedAnswers,
        submittedAnswers,
        markedQuestions,
        aiExplanations,
        timeRemaining,
        timerActive,
        examSubmitted,
      };
      saveJSON(STORAGE_KEYS.session, snapshot);
    }, 250);
    return () => clearTimeout(handle);
  }, [
    activeTab,
    quizMode,
    activeQuestions,
    currentIdx,
    selectedAnswers,
    submittedAnswers,
    markedQuestions,
    aiExplanations,
    timeRemaining,
    timerActive,
    examSubmitted,
  ]);

  // Record a completed attempt into history exactly once per submission.
  useEffect(() => {
    if (examSubmitted && !historyRecordedRef.current) {
      historyRecordedRef.current = true;
      const stats = getExamResultStats();
      if (stats.total > 0) {
        const entry: ExamHistoryEntry = {
          id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `attempt-${Date.now()}`,
          date: new Date().toISOString(),
          mode: quizMode,
          language: quizLanguage,
          total: stats.total,
          answered: stats.answered,
          correct: stats.correct,
          percent: stats.percent,
          passed: stats.passes,
        };
        setExamHistory((prev) => [entry, ...prev].slice(0, 300));
      }
    }
  }, [examSubmitted]);

  // Timer Countdown Effect.
  // NOTE: this previously depended on [timerActive, timeRemaining], which
  // tore down and recreated the interval every single second — wasteful and
  // a source of subtle drift. It now depends only on timerActive and always
  // updates via the functional setState form, so a single interval runs for
  // the whole countdown.
  useEffect(() => {
    if (!timerActive) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerActive(false);
          setExamSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  const startExam = (mode: QuizMode) => {
    if (questions.length === 0) {
      alert("Por favor, introduce o carga preguntas primero para iniciar el examen.");
      setActiveTab("manager");
      return;
    }

    let selectedSet = [...questions];

    if (mode === "exam") {
      const finalCount = Math.max(1, Math.min(examQuestionCount, questions.length));
      
      if (randomizeQuestions) {
        // Shuffle helper (Fisher-Yates) using copy of questions
        for (let i = selectedSet.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = selectedSet[i];
          selectedSet[i] = selectedSet[j];
          selectedSet[j] = temp;
        }
      }
      
      selectedSet = selectedSet.slice(0, finalCount);
    } else {
      // Practice mode uses all questions
      selectedSet = [...questions];
    }

    setActiveQuestions(selectedSet);
    setQuizMode(mode);
    setExamSubmitted(false);
    setSelectedAnswers({});
    setSubmittedAnswers({});
    setMarkedQuestions({});
    setAiExplanations({});
    setCurrentIdx(0);
    setTimeRemaining(timerDuration * 60);
    setTimerActive(mode === "exam"); // Only run timer in test mode
    setActiveTab("exam");
    historyRecordedRef.current = false;
  };

  // Start a focused review session containing only the questions that were
  // answered incorrectly (or left unanswered) in the attempt that just
  // finished. Runs in practice mode so the user gets immediate feedback.
  const startReviewOfMistakes = () => {
    const missed = activeQuestions.filter((q, idx) => {
      const qId = q.id || String(idx);
      const chosen = selectedAnswers[qId] || [];
      const correct = q.correct_answers;
      const isMatch = chosen.length === correct.length && chosen.every((val) => correct.includes(val));
      return !isMatch;
    });

    if (missed.length === 0) return;

    setActiveQuestions(missed);
    setQuizMode("practice");
    setExamSubmitted(false);
    setSelectedAnswers({});
    setSubmittedAnswers({});
    setMarkedQuestions({});
    setAiExplanations({});
    setCurrentIdx(0);
    setTimerActive(false);
    setActiveTab("exam");
    historyRecordedRef.current = false;
  };

  const handleCompleteExam = () => {
    setTimerActive(false);
    setExamSubmitted(true);
  };

  // Check answers for Practice Mode
  const handleCheckAnswer = async () => {
    const q = activeQuestions[currentIdx];
    if (!q) return;

    const qId = q.id || String(currentIdx);
    
    // Set checked state
    setSubmittedAnswers(prev => ({
      ...prev,
      [qId]: true
    }));

    // Trigger AI Explanation call to helper server route if not already cached
    const existingExplanation = q.explanation || (q as any).feedback || (q as any).retroalimentacion;
    if (!aiExplanations[qId] && !loadingExplanation) {
      if (existingExplanation) {
        setAiExplanations(prev => ({
          ...prev,
          [qId]: existingExplanation
        }));
        return;
      }
      // No hay backend de IA en esta build estática: usamos la explicación
      // incluida en los datos de la pregunta, o un mensaje de fallback.
      if (q.explanation) {
        setAiExplanations(prev => ({
          ...prev,
          [qId]: `**Respuestas correctas: ${q.correct_answers.join(", ")}**\n\n${q.explanation}`
        }));
      } else {
        setAiExplanations(prev => ({
          ...prev,
          [qId]: `Respuestas correctas: **${q.correct_answers.join(", ")}**`
        }));
      }
    }
  };

  const handleOptionSelect = (key: string) => {
    if (examSubmitted) return; // Prevent edits on exam summary
    
    const q = activeQuestions[currentIdx];
    if (!q) return;
    
    const qId = q.id || String(currentIdx);

    // Prevent re-selection once answer check is submitted in practice mode
    if (quizMode === "practice" && submittedAnswers[qId]) return;

    if (q.is_multiple_choice) {
      const active = selectedAnswers[qId] || [];
      if (active.includes(key)) {
        setSelectedAnswers(prev => ({
          ...prev,
          [qId]: active.filter(k => k !== key)
        }));
      } else {
        setSelectedAnswers(prev => ({
          ...prev,
          [qId]: [...active, key]
        }));
      }
    } else {
      setSelectedAnswers(prev => ({
        ...prev,
        [qId]: [key]
      }));
    }
  };

  const toggleMarkQuestion = () => {
    const q = activeQuestions[currentIdx];
    if (!q) return;
    const qId = q.id || String(currentIdx);
    setMarkedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // Navigation handlers
  const handleBack = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleNext = () => {
    if (currentIdx < activeQuestions.length - 1) setCurrentIdx(currentIdx + 1);
  };

  // Helper formatting for seconds to MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Statistics summaries
  const getExamResultStats = () => {
    let scoreEarned = 0;
    let answeredCount = 0;

    activeQuestions.forEach((q, idx) => {
      const qId = q.id || String(idx);
      const chosen = selectedAnswers[qId] || [];
      const correct = q.correct_answers;
      
      if (chosen.length > 0) {
        answeredCount++;
        // Check if correct corresponds perfectly (exact array comparison)
        const isMatch = chosen.length === correct.length && chosen.every(val => correct.includes(val));
        if (isMatch) scoreEarned++;
      }
    });

    const percent = activeQuestions.length > 0 ? Math.round((scoreEarned / activeQuestions.length) * 100) : 0;
    const passes = percent >= 72; // AWS SAA standard pass rate is normally ~720/1000 i.e. 72%

    return {
      total: activeQuestions.length,
      answered: answeredCount,
      correct: scoreEarned,
      percent,
      passes
    };
  };

  const activeQ = activeQuestions[currentIdx];
  const activeQId = activeQ ? (activeQ.id || String(currentIdx)) : "";
  const currentSelections = selectedAnswers[activeQId] || [];
  const currentSubmitted = submittedAnswers[activeQId] || false;
  const currentMarked = markedQuestions[activeQId] || false;

  const currentStats = examSubmitted ? getExamResultStats() : null;

  return (
    <div className="w-full h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden" id="main_wrapper">
      {/* Top Header Navigation */}
      <header className="h-16 bg-[#232F3E] text-white flex items-center justify-between px-3 md:px-6 shrink-0 shadow-sm z-50 relative">
        <div
          className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0"
          onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
        >
          <div className="bg-[#FF9900] p-1.5 rounded flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#232F3E] fill-current" />
          </div>
          <div className="min-w-0 md:min-w-fit">
            <span className="font-bold tracking-tight text-sm md:text-base leading-none block truncate md:whitespace-normal md:overflow-visible">
              <span className="md:hidden">AWS SAA-C03</span>
              <span className="hidden md:inline">
                AWS Certified Solutions Architect <span className="text-[#FF9900] font-extrabold">Associate</span>
              </span>
            </span>
            <span className="hidden sm:block text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
              Simulador Certificación SAA-C03
            </span>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          {/* Header language switches */}
          <div className="flex items-center gap-1.5 bg-[#1F2937] p-1 rounded-lg border border-slate-700/80">
            <button
              onClick={() => setQuizLanguage("en")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                quizLanguage === "en" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
              id="lang_en_btn"
            >
              EN
            </button>
            <button
              onClick={() => setQuizLanguage("es")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                quizLanguage === "es" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
              id="lang_es_btn"
            >
              ES
            </button>
            <button
              onClick={() => setQuizLanguage("mix")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                quizLanguage === "mix" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
              id="lang_mix_btn"
            >
              MIX
            </button>
          </div>

          <div className="h-8 w-px bg-slate-700"></div>

          {/* Time Remaining Bar */}
          {timerActive && (
            <div className="flex items-center gap-2" id="header_timer_container">
              <Clock className="w-4 h-4 text-[#FF9900]" />
              <span className="font-mono font-bold text-sm tracking-widest text-[#FF9900]">
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "dashboard" ? "bg-[#37475A] text-white" : "text-slate-300 hover:text-white"
              }`}
              id="nav_dashboard_btn"
            >
              <BarChart2 className="w-4 h-4" /> Inicio
            </button>
            <button
              onClick={() => setActiveTab("concepts")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "concepts" ? "bg-[#37475A] text-[#FF9900]" : "text-slate-300 hover:text-white"
              }`}
              id="nav_concepts_btn"
            >
              <Layers className="w-4 h-4" /> Tarjetas Conceptos
            </button>
            <button
              onClick={() => setActiveTab("manager")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "manager" ? "bg-[#37475A] text-[#FF9900]" : "text-slate-300 hover:text-white"
              }`}
              id="nav_manager_btn"
            >
              <Database className="w-4 h-4" /> Banco Preguntas ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab("historial")}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "historial" ? "bg-[#37475A] text-[#FF9900]" : "text-slate-300 hover:text-white"
              }`}
              id="nav_historial_btn"
            >
              <History className="w-4 h-4" /> Historial{examHistory.length > 0 ? ` (${examHistory.length})` : ""}
            </button>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(o => !o)}
          className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#37475A] transition-colors shrink-0"
          id="mobile_menu_toggle_btn"
          aria-label="Abrir menú"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#232F3E] border-t border-slate-700/80 shadow-lg z-50 p-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center gap-1.5 bg-[#1F2937] p-1 rounded-lg border border-slate-700/80 w-fit">
              <button
                onClick={() => setQuizLanguage("en")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  quizLanguage === "en" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
                }`}
                id="lang_en_btn_mobile"
              >
                EN
              </button>
              <button
                onClick={() => setQuizLanguage("es")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  quizLanguage === "es" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
                }`}
                id="lang_es_btn_mobile"
              >
                ES
              </button>
              <button
                onClick={() => setQuizLanguage("mix")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  quizLanguage === "mix" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"
                }`}
                id="lang_mix_btn_mobile"
              >
                MIX
              </button>
            </div>

            {timerActive && (
              <div className="flex items-center gap-2" id="header_timer_container_mobile">
                <Clock className="w-4 h-4 text-[#FF9900]" />
                <span className="font-mono font-bold text-sm tracking-widest text-[#FF9900]">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                className={`px-3.5 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === "dashboard" ? "bg-[#37475A] text-white" : "text-slate-300 hover:text-white"
                }`}
                id="nav_dashboard_btn_mobile"
              >
                <BarChart2 className="w-4 h-4" /> Inicio
              </button>
              <button
                onClick={() => { setActiveTab("concepts"); setMobileMenuOpen(false); }}
                className={`px-3.5 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === "concepts" ? "bg-[#37475A] text-[#FF9900]" : "text-slate-300 hover:text-white"
                }`}
                id="nav_concepts_btn_mobile"
              >
                <Layers className="w-4 h-4" /> Tarjetas Conceptos
              </button>
              <button
                onClick={() => { setActiveTab("manager"); setMobileMenuOpen(false); }}
                className={`px-3.5 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === "manager" ? "bg-[#37475A] text-[#FF9900]" : "text-slate-300 hover:text-white"
                }`}
                id="nav_manager_btn_mobile"
              >
                <Database className="w-4 h-4" /> Banco Preguntas ({questions.length})
              </button>
              <button
                onClick={() => { setActiveTab("historial"); setMobileMenuOpen(false); }}
                className={`px-3.5 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === "historial" ? "bg-[#37475A] text-[#FF9900]" : "text-slate-300 hover:text-white"
                }`}
                id="nav_historial_btn_mobile"
              >
                <History className="w-4 h-4" /> Historial{examHistory.length > 0 ? ` (${examHistory.length})` : ""}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container Work Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "dashboard" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full space-y-10" id="dashboard_view">
            
            {/* Elegant Branding Hero */}
            <div className="bg-[#232F3E] text-white p-8 md:p-10 rounded-2xl shadow-md border-b-4 border-[#FF9900] relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-12">
                <Award className="w-80 h-80" />
              </div>
              
              <div className="max-w-2xl">
                <span className="px-3 py-1 bg-amber-500/20 text-[#FF9900] text-[10px] font-extrabold uppercase tracking-widest rounded-full border border-amber-500/30">
                  Preparación SAA-C03 Realística
                </span>
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mt-3 text-slate-100">
                  Acelera tu Certificación AWS Solutions Architect
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed mt-4">
                  Practica con un entorno idéntico al examen oficial. Consulta explicaciones detalladas en inglés y español sobre mejores prácticas de AWS Well-Architected, y monitorea tus debilidades técnicas al instante.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3.5 mt-8 border-t border-slate-700/60 pt-6">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl font-bold text-[#FF9900]">{questions.length}</span>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Preguntas Disponibles</span>
                </div>
                <div className="hidden sm:block text-slate-600">|</div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Languages className="w-4 h-4 text-[#FF9900]" /> Configurable en <span className="font-bold underline text-white">Inglés, Español y Mix</span>
                </div>
              </div>
            </div>

            {/* If zero questions block */}
            {questions.length === 0 && (
              <div className="bg-amber-50/50 border border-amber-200 p-8 rounded-2xl flex flex-col md:flex-row items-center gap-6 justify-between text-center md:text-left">
                <div className="space-y-1 text-slate-800">
                  <h3 className="text-lg font-bold flex items-center justify-center md:justify-start gap-2 text-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> Simulador vacío (0 preguntas por defecto)
                  </h3>
                  <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                    Para cumplir con tus requisitos el simulador arranca por defecto con cero preguntas. Puedes cargar nuestro set demostrativo con 4 escenarios oficiales de SAA-C03, o subir tu propio archivo JSON.
                  </p>
                </div>
                <div className="flex gap-3.5 shrink-0 flex-wrap justify-center">
                  <button
                    onClick={async () => {
                      setLoadingSampleSet(true);
                      try {
                        const samples = await loadSampleQuestions();
                        const sampleLoaded = samples.map((q: Question, idx: number) => ({
                          ...q,
                          id: crypto.randomUUID ? crypto.randomUUID() : `sample-${idx}`
                        }));
                        setQuestions(sampleLoaded);
                        setActiveTab("exam");
                      } catch (err) {
                        console.error("No se pudo cargar el set de preguntas demo:", err);
                        alert("No se pudo cargar el set demostrativo. Inténtalo de nuevo.");
                      } finally {
                        setLoadingSampleSet(false);
                      }
                    }}
                    disabled={loadingSampleSet}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-wait text-slate-900 font-extrabold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
                    id="load_samples_hero_btn"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingSampleSet ? "animate-spin" : ""}`} />
                    {loadingSampleSet ? "Cargando..." : "Cargar Set Demo"}
                  </button>
                  <button
                    onClick={() => setActiveTab("manager")}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
                    id="nav_import_hero_btn"
                  >
                    <Database className="w-4 h-4" /> Subir JSON
                  </button>
                </div>
              </div>
            )}

            {/* Choose Training Mode Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Practice mode card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 border border-orange-100">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Modo de Práctica Inteligente</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">
                    Sin límites de tiempo ni penalizaciones de estrés. Elige tus respuestas y obtén confirmación de aciertos de forma interactiva e inmediata, con explicaciones detalladas y análisis de descarte.
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 mt-4 font-medium pl-1">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Corregir de uno en uno</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Explicaciones detalladas al instante</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Explicación de descartes</li>
                  </ul>
                </div>
                <button
                  onClick={() => startExam("practice")}
                  className="mt-6 w-full py-3 bg-[#FF9900] text-[#232F3E] hover:bg-amber-500 font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                  id="start_practice_mode_btn"
                >
                  <Play className="w-4 h-4 fill-current" /> Iniciar Práctica Libre
                </button>
              </div>

              {/* Real Exam mode card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Examen de Simulación Real</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">
                    Entrena bajo condiciones oficiales idénticas a la prueba de AWS. Tendrás límite de tiempo estricto, no podrás ver las explicaciones en tiempo real, y recibirás la retroalimentación final sobre aprobados y fallos una vez entregado el examen.
                  </p>
                  
                  <div className="mt-4 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {/* Tiempo límite */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tiempo Límite (Minutos)</label>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Recomendado simular presión.</p>
                      </div>
                      <input
                        type="number"
                        min="5"
                        max="600"
                        value={timerDuration}
                        onChange={(e) => setTimerDuration(Math.max(5, Number(e.target.value)))}
                        className="w-20 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 col-span-2 py-1 text-xs font-bold font-mono transition-all text-right"
                      />
                    </div>

                    <div className="h-px bg-slate-200/60" />

                    {/* Número de preguntas */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cantidad de preguntas</label>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">SAA Estándar: 65, Disponibles: {questions.length}</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={questions.length || 1}
                        value={examQuestionCount}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(questions.length, Number(e.target.value)));
                          setExamQuestionCount(val);
                        }}
                        className="w-20 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-bold font-mono transition-all text-right"
                      />
                    </div>

                    <div className="h-px bg-slate-200/60" />

                    {/* Mezclar preguntas de forma aleatoria */}
                    <div className="flex items-center justify-between gap-4 py-0.5">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer" htmlFor="randomize-toggle-simulation">
                          Preguntas Aleatorias
                        </label>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Mezclar pool de preguntas</p>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="randomize-toggle-simulation"
                          type="checkbox"
                          checked={randomizeQuestions}
                          onChange={(e) => setRandomizeQuestions(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-all cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => startExam("exam")}
                  className="mt-6 w-full py-3 bg-slate-900 text-white hover:bg-slate-800 font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                  id="start_exam_mode_btn"
                >
                  <Clock className="w-4 h-4" /> Lanzar Simulación Oficial
                </button>
              </div>

            </div>

            {/* Quick SAA Exam Information Tip box */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="flex gap-3 items-start text-left">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Guía del Examen AWS SAA-C03</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    Consiste de 65 preguntas que deben resolverse en 130 minutos. La puntuación mínima aprobatoria estándar es de 720 puntos sobre una escala de 100-1000. El diseño se focaliza en Alta Disponibilidad, Resiliencia, Seguridad y Optimización de Costes.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === "manager" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto w-full" id="manager_view">
            <div className="mb-4">
              <h2 className="text-xl font-extrabold text-slate-900">Configuración del Banco de Preguntas</h2>
              <p className="text-xs text-slate-500 mt-1">Gestiona el inventario de preguntas que se utilizarán para la simulación.</p>
            </div>
            
            <QuestionManager 
              questions={questions}
              onUpdateQuestions={(updated) => setQuestions(updated)}
            />
          </div>
        )}

        {activeTab === "concepts" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto w-full" id="concepts_tab_view">
            <ConceptsViewer />
          </div>
        )}

        {activeTab === "historial" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8" id="historial_tab_view">
            <HistoryView
              history={examHistory}
              onClear={() => setExamHistory([])}
              onDeleteEntry={(id) => setExamHistory((prev) => prev.filter((entry) => entry.id !== id))}
            />
          </div>
        )}

        {activeTab === "exam" && (
          <div className="flex-1 flex overflow-hidden relative" id="exam_main_interface">
            <QuestionSidebar
              sidebarOpen={sidebarOpen}
              sidebarPinned={sidebarPinned}
              setSidebarOpen={setSidebarOpen}
              setSidebarPinned={setSidebarPinned}
              quizMode={quizMode}
              activeQuestions={activeQuestions}
              currentIdx={currentIdx}
              setCurrentIdx={setCurrentIdx}
              selectedAnswers={selectedAnswers}
              submittedAnswers={submittedAnswers}
              markedQuestions={markedQuestions}
              examSubmitted={examSubmitted}
            />

            {/* Right Panel: The Interactive SAA Exam Experience */}
            <div className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto bg-white">
              
              {/* If full exam results dashboard */}
              {examSubmitted && currentStats ? (
                <ExamResultsPanel
                  stats={currentStats}
                  quizMode={quizMode}
                  onRestart={() => startExam(quizMode)}
                  onReviewFreely={() => {
                    setExamSubmitted(false);
                    setQuizMode("practice");
                  }}
                  onReviewMistakes={startReviewOfMistakes}
                  onViewHistory={() => setActiveTab("historial")}
                />
              ) : null}

              {/* Active Exam details content window */}
              {!activeQ ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100 max-w-md mx-auto">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800 mt-4">No hay preguntas seleccionadas</h3>
                  <p className="text-slate-500 text-xs mt-1">Vuelve a la pestaña "Banco de Preguntas" para cargar material de estudio.</p>
                  <button
                    onClick={() => setActiveTab("manager")}
                    className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                  >
                    Ir al Administrador
                  </button>
                </div>
              ) : (
                <div className="max-w-4xl w-full mx-auto flex flex-col flex-1" id="active_exam_sandbox">
                  
                  {/* Info Row Bar */}
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {!sidebarOpen && (
                        <button
                          onClick={() => setSidebarOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-[#232F3E] text-white hover:bg-[#1A232F] rounded-md text-[10px] font-black shadow-sm transition-all group shrink-0"
                          title="Mostrar panel lateral de preguntas (Navegación)"
                          id="show_sidebar_panel_btn"
                        >
                          <Menu className="w-3.5 h-3.5 text-[#FF9900] group-hover:scale-110 transition-transform" />
                          <span>PREGUNTAS ({activeQuestions.length})</span>
                        </button>
                      )}
                      <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
                        Pregunta {currentIdx + 1} de {activeQuestions.length}
                      </span>
                      <span className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border ${
                        activeQ.is_multiple_choice 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                          : "bg-blue-50 border-blue-200 text-blue-700"
                      }`}>
                        {activeQ.is_multiple_choice ? "Multiselección (Selecciona Dos)" : "Selección Única"}
                      </span>
                    </div>

                    <button
                      onClick={toggleMarkQuestion}
                      className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        currentMarked 
                          ? "bg-amber-100 border border-amber-300 text-amber-800" 
                          : "bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700"
                      }`}
                      id="mark_review_instance_btn"
                      title="Marcar con bandera para revisión posterior"
                    >
                      {currentMarked ? (
                        <>
                          <BookmarkCheck className="w-4 h-4 text-amber-600 fill-current" />
                          <span>¡Marcado!</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4" />
                          <span>Marcar Duda</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Question header container */}
                  <div className="space-y-4 mb-8">
                    {(() => {
                      const spanishQuestion = activeQ.question_esp || activeQ.translated_question;
                      
                      if (quizLanguage === "en" || !spanishQuestion) {
                        return (
                          <div className="space-y-2">
                            {quizLanguage !== "en" && !spanishQuestion && (
                              <div className="flex items-center bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-lg text-xs">
                                <span className="text-amber-800 font-medium">Esta pregunta no incluye traducción predefinida en español.</span>
                              </div>
                            )}
                            <h1 className="text-lg md:text-xl font-medium leading-relaxed text-slate-800" id="question_text">
                              {activeQ.question}
                            </h1>
                          </div>
                        );
                      }

                      if (quizLanguage === "es") {
                        return (
                          <div className="space-y-1 animate-fade-in">
                            <span className="text-[9px] font-extrabold uppercase text-amber-600 tracking-wider">Español / SAA-C03</span>
                            <h1 className="text-lg md:text-xl font-medium leading-relaxed text-slate-800" id="translated_question_text">
                              {spanishQuestion}
                            </h1>
                          </div>
                        );
                      }

                      // MIX mode (Bilingual: English + Spanish)
                      return (
                        <div className="space-y-4 animate-fade-in border-l-4 border-amber-500 pl-4 py-1">
                          <div className="text-slate-700 font-medium leading-relaxed">
                            <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-0.5">Inglés / Original</div>
                            <p className="text-base font-medium">{activeQ.question}</p>
                          </div>
                          <div className="text-slate-800 leading-relaxed pt-2.5 border-t border-slate-100">
                            <div className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider mb-0.5">Español / Traducción</div>
                            <p className="text-base font-medium text-slate-900">{spanishQuestion}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Option Choice Cards List */}
                  <div className="space-y-3.5 flex-1" id="option_choices_list">
                    {activeQ.options.map((opt, oIdx) => {
                      const isSelected = currentSelections.includes(opt.key);
                      const isCorrectAnswer = activeQ.correct_answers.includes(opt.key);
                      
                      // Highlight classes based on standard Practice Check or Final Exam Submission state
                      let optClass = "border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50";
                      let badgeClass = "border-slate-300 bg-white text-slate-500";
                      
                      if (isSelected) {
                        optClass = "border-amber-400 bg-amber-50/10";
                        badgeClass = "border-[#FF9900] bg-[#FF9900] text-[#232F3E]";
                      }

                      // Practice mode immediate feedback highlights
                      if ((quizMode === "practice" && currentSubmitted) || examSubmitted) {
                        if (isCorrectAnswer) {
                          // Correct option (even if user missed it, highlight it green)
                          optClass = "border-emerald-300 bg-emerald-50/20";
                          badgeClass = "border-emerald-500 bg-emerald-500 text-white";
                        } else if (isSelected) {
                          // Selected but incorrect option
                          optClass = "border-rose-300 bg-rose-50/20";
                          badgeClass = "border-rose-500 bg-rose-500 text-white";
                        } else {
                          // Non-selected incorrect
                          optClass = "border-slate-200 bg-slate-50/40 opacity-70 pointer-events-none";
                          badgeClass = "border-slate-200 text-slate-300 bg-slate-50";
                        }
                      }

                      // Resolving translated options
                      const spanishOptText = opt.text_esp || activeQ.translated_options?.find(o => o.key === opt.key)?.text;
                      let optionText = opt.text;
                      if (quizLanguage === "es") {
                        optionText = spanishOptText || opt.text;
                      } else if (quizLanguage === "mix") {
                        if (spanishOptText && spanishOptText !== opt.text) {
                          optionText = `${opt.text}\n\n[ES] ${spanishOptText}`;
                        } else {
                          optionText = opt.text;
                        }
                      }

                      return (
                        <div
                          key={opt.key}
                          onClick={() => handleOptionSelect(opt.key)}
                          className={`group cursor-pointer flex items-start p-4 rounded-xl border transition-all duration-150 ${optClass}`}
                          id={`option_${opt.key}`}
                        >
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center mr-4 shrink-0 font-bold text-sm shadow-inner transition-colors ${badgeClass}`}>
                            {opt.key}
                          </div>
                          
                          <div className="flex-1 text-sm text-slate-700 leading-relaxed font-medium pt-0.5">
                            {optionText.split('\n\n').map((paragraph, pIdx) => (
                              <p key={pIdx} className={pIdx > 0 ? "mt-2 pt-2 border-t border-dashed border-slate-100 text-xs italic text-slate-500" : ""}>
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Quick-Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-6 p-4 bg-slate-50/80 rounded-xl border border-slate-200/60" id="inline_quick_action_bar">
                    <div className="flex gap-2">
                      <button
                        onClick={handleBack}
                        disabled={currentIdx === 0}
                        className={`py-2 px-3.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 transition-colors flex items-center gap-1.5 shadow-sm ${
                          currentIdx === 0 ? "opacity-40 cursor-not-allowed bg-slate-100" : "bg-white hover:bg-slate-100"
                        }`}
                        id="inline_prev_btn"
                      >
                        <ChevronLeft className="w-4 h-4" /> Anterior
                      </button>
                      
                      <button
                        onClick={handleNext}
                        disabled={currentIdx === activeQuestions.length - 1}
                        className={`py-2 px-3.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 transition-colors flex items-center gap-1.5 shadow-sm ${
                          currentIdx === 0 && activeQuestions.length <= 1 ? "opacity-10" : ""
                        } ${
                          currentIdx === activeQuestions.length - 1 ? "opacity-40 cursor-not-allowed bg-slate-100" : "bg-white hover:bg-slate-100"
                        }`}
                        id="inline_next_btn"
                      >
                        Siguiente <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {quizMode === "practice" && !currentSubmitted ? (
                        <button
                          onClick={handleCheckAnswer}
                          disabled={currentSelections.length === 0}
                          className={`px-5 py-2 rounded-lg text-xs font-extrabold shadow-sm transition-colors flex items-center gap-1.5 ${
                            currentSelections.length === 0 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                              : "bg-[#FF9900] text-[#232F3E] hover:bg-amber-500 hover:shadow"
                          }`}
                          id="inline_check_btn"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Comprobar Respuesta
                        </button>
                      ) : (
                        quizMode === "practice" && currentSubmitted && currentIdx < activeQuestions.length - 1 && (
                          <button
                            onClick={handleNext}
                            className="px-5 py-2 rounded-lg text-xs font-extrabold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5"
                            id="inline_continue_btn"
                          >
                            <span>Siguiente Pregunta</span> <ChevronRight className="w-4 h-4" />
                          </button>
                        )
                      )}

                      {quizMode === "exam" && !examSubmitted && (
                        <button
                          onClick={() => {
                            if (currentIdx === activeQuestions.length - 1) {
                              handleCompleteExam();
                            } else {
                              handleNext();
                            }
                          }}
                          className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#232F3E] hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1"
                        >
                          {currentIdx === activeQuestions.length - 1 ? "Finalizar Examen" : "Siguiente"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Immediate Feedback Explanation Panel */}
                  {((quizMode === "practice" && currentSubmitted) || examSubmitted) && (
                    <div className="mt-8 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-xl overflow-hidden animate-slide-up border-l-4 border-l-[#FF9900]" id="immediate_feedback_panel">
                      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#FF9900]">
                          <Sparkles className="w-4.5 h-4.5 flex-shrink-0 text-[#FF9900] animate-pulse" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-[#FF9900]">
                            Retroalimentación Arquitectónica SAA-C03
                          </span>
                        </div>
                        <div className="text-[9px] font-extrabold text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded tracking-wider uppercase">
                          AWS Insight
                        </div>
                      </div>
                      
                      <div className="p-6 text-sm leading-relaxed text-slate-200">
                        {loadingExplanation ? (
                          <div className="flex items-center gap-3 py-8 text-slate-400 justify-center">
                            <RefreshCw className="w-5 h-5 animate-spin text-[#FF9900]" />
                            <span className="text-xs font-bold tracking-wide">Cargando la explicación de este escenario...</span>
                          </div>
                        ) : (
                          <div id="react_markdown_text" className="space-y-1">
                            <ReactMarkdown
                              components={{
                                h1: ({node, ...props}) => (
                                  <h1 className="text-lg font-bold text-white mb-4 mt-6 border-b border-slate-800 pb-2 tracking-tight" {...props} />
                                ),
                                h2: ({node, ...props}) => (
                                  <h2 className="text-base font-bold text-white mb-3 mt-5 pb-1 tracking-tight" {...props} />
                                ),
                                h3: ({node, ...props}) => (
                                  <h3 className="text-[13.5px] font-black text-[#FF9900] mb-3 mt-6 tracking-wider uppercase border-l-2 border-[#FF9900] pl-3" {...props} />
                                ),
                                h4: ({node, ...props}) => (
                                  <h4 className="text-[12.5px] font-extrabold text-amber-500 mb-2 mt-4" {...props} />
                                ),
                                p: ({node, ...props}) => (
                                  <p className="text-slate-200 mb-4.5 leading-relaxed text-[13.5px] font-normal" {...props} />
                                ),
                                ul: ({node, ...props}) => (
                                  <ul className="list-disc pl-5 mb-5 space-y-2 text-[13.5px] text-slate-200" {...props} />
                                ),
                                ol: ({node, ...props}) => (
                                  <ol className="list-decimal pl-5 mb-5 space-y-2 text-[13.5px] text-slate-200" {...props} />
                                ),
                                li: ({node, ...props}) => (
                                  <li className="marker:text-[#FF9900] leading-relaxed" {...props} />
                                ),
                                blockquote: ({node, ...props}) => (
                                  <blockquote className="border-l-4 border-amber-500 bg-slate-950/50 pl-4 py-2.5 pr-3 my-4 rounded-r-lg italic text-slate-300 text-xs leading-relaxed" {...props} />
                                ),
                                strong: ({node, ...props}) => (
                                  <strong className="font-extrabold text-white bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/30 text-[13px]" {...props} />
                                ),
                                code: ({node, inline, className, ...props}: any) => {
                                  return (
                                    <code className="font-mono text-xs bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded border border-slate-800/50" {...props} />
                                  );
                                }
                              }}
                            >
                              {aiExplanations[activeQId] || activeQ.explanation || "No hay explicación detallada disponible para esta pregunta."}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Spacer helper padding */}
                  <div className="h-10 shrink-0"></div>

                </div>
              )}

            </div>
          </div>
        )}
      </main>

      {/* Bottom control panel bar */}
      <footer className="h-20 bg-white border-t border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-inner">
        {/* Left footer buttons */}
        <div className="flex gap-2">
          {activeTab === "exam" && (
            <>
              <button
                onClick={handleBack}
                disabled={currentIdx === 0}
                className={`py-2 px-4.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 transition-colors flex items-center gap-1 ${
                  currentIdx === 0 ? "opacity-40 cursor-not-allowed bg-slate-50" : "bg-white hover:bg-slate-50"
                }`}
                id="footer_prev_btn"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              
              <button
                onClick={handleNext}
                disabled={currentIdx === activeQuestions.length - 1}
                className={`py-2 px-4.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 transition-colors flex items-center gap-1 ${
                  currentIdx === activeQuestions.length - 1 ? "opacity-40 cursor-not-allowed bg-slate-50" : "bg-white hover:bg-slate-50"
                }`}
                id="footer_next_btn"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Right footer actions */}
        <div className="flex gap-2.5">
          {activeTab === "exam" && (
            <>
              {quizMode === "practice" && !currentSubmitted && (
                <button
                  onClick={handleCheckAnswer}
                  disabled={currentSelections.length === 0}
                  className={`px-6 py-2.5 rounded-lg text-xs font-bold shadow-md transition-colors ${
                    currentSelections.length === 0 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-[#232F3E] text-white hover:bg-slate-800"
                  }`}
                  id="footer_check_btn"
                >
                  Comprobar Respuesta
                </button>
              )}

              {quizMode === "exam" && !examSubmitted && (
                <button
                  onClick={handleCompleteExam}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold shadow-md transition-colors"
                  id="footer_submit_exam_btn"
                >
                  Finalizar Examen SAA
                </button>
              )}
            </>
          )}

          {questions.length > 0 && activeTab === "dashboard" && (
            <button
              onClick={() => setActiveTab("exam")}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
            >
              Reanudar Simulación Activa
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
