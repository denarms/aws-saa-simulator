/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Question, QuizMode } from "../types";
import { Menu, Pin, PinOff, X } from "lucide-react";

interface QuestionSidebarProps {
  sidebarOpen: boolean;
  sidebarPinned: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSidebarPinned: (pinned: boolean) => void;
  quizMode: QuizMode;
  activeQuestions: Question[];
  currentIdx: number;
  setCurrentIdx: (idx: number) => void;
  selectedAnswers: { [qId: string]: string[] };
  submittedAnswers: { [qId: string]: boolean };
  markedQuestions: { [qId: string]: boolean };
  examSubmitted: boolean;
}

// The left-hand question navigator used in the "exam" tab: a grid of
// numbered buttons color-coded by answer/correctness state, plus the
// floating restore tab and backdrop used when it's collapsed/floating.
export function QuestionSidebar({
  sidebarOpen,
  sidebarPinned,
  setSidebarOpen,
  setSidebarPinned,
  quizMode,
  activeQuestions,
  currentIdx,
  setCurrentIdx,
  selectedAnswers,
  submittedAnswers,
  markedQuestions,
  examSubmitted,
}: QuestionSidebarProps) {
  const answeredCount = Object.keys(selectedAnswers).filter((k) => selectedAnswers[k].length > 0).length;

  return (
    <>
      {/* Sidebar backdrop for floating/drawer mode */}
      {sidebarOpen && (
        <div
          className={`absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] z-30 transition-opacity ${
            sidebarPinned ? "md:hidden" : ""
          }`}
          onClick={() => setSidebarOpen(false)}
          id="sidebar_backdrop"
        />
      )}

      {/* Left Edge Floating Tab to restore Sidebar Navigation */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-0 top-1/3 bg-[#232F3E] text-white hover:bg-[#1A232F] py-4 px-2 rounded-r-xl shadow-lg border-y border-r border-[#FF9900]/40 transition-all hover:pl-3 z-30 flex flex-col items-center gap-2 group cursor-pointer animate-fade-in"
          title="Mostrar panel de preguntas"
          id="floating_sidebar_tab"
        >
          <Menu className="w-4 h-4 text-[#FF9900] group-hover:scale-110 transition-transform" />
          <span className="[writing-mode:vertical-lr] text-[9px] font-black tracking-widest text-[#FF9900] uppercase select-none">
            PREGUNTAS
          </span>
        </button>
      )}

      {/* Left Sidebar: Grid navigation of specific questions */}
      <aside
        className={`
          bg-white flex flex-col h-full transition-all duration-300 z-40
          ${
            sidebarPinned
              ? sidebarOpen
                ? "absolute md:relative w-72 md:w-72 translate-x-0 flex shadow-xl md:shadow-none border-r border-slate-200/80"
                : "absolute md:relative w-72 md:w-0 -translate-x-full md:translate-x-0 md:overflow-hidden md:opacity-0 md:border-r-0 pointer-events-none"
              : sidebarOpen
                ? "absolute w-72 translate-x-0 flex shadow-xl border-r border-slate-200/80"
                : "absolute w-72 -translate-x-full pointer-events-none"
          }
        `}
        id="sidebar_navigator"
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Navegación</h3>
            <span className="text-[10px] text-slate-400 font-semibold">
              {quizMode === "practice" ? "MODO PRÁCTICA" : "MODO EXAMEN"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pin/Unpin action - only relevant for desktop md breakpoint */}
            <button
              onClick={() => {
                const newPinned = !sidebarPinned;
                setSidebarPinned(newPinned);
                // If we are unpinning, close the sidebar to slide it out of the way immediately
                // and avoid leaving a floating blurred overlay.
                if (!newPinned) {
                  setSidebarOpen(false);
                } else {
                  setSidebarOpen(true);
                }
              }}
              className="p-1 px-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50 transition-colors hidden md:flex items-center gap-1"
              title={sidebarPinned ? "Desfijar de la pantalla (Modo Flotante)" : "Fijar a la pantalla (Modo Acoplado)"}
              id="toggle_pin_btn"
            >
              {sidebarPinned ? (
                <PinOff className="w-3.5 h-3.5 text-indigo-600 fill-indigo-100" />
              ) : (
                <Pin className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Close action */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50 transition-colors"
              title="Ocultar barra de navegación"
              id="hide_sidebar_btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid map list of questions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2.5">
            {activeQuestions.map((q, idx) => {
              const qId = q.id || String(idx);
              const isSelected = idx === currentIdx;
              const answersSelected = selectedAnswers[qId] || [];
              const isAnswered = answersSelected.length > 0;
              const isChecked = submittedAnswers[qId] || false;
              const isMarked = markedQuestions[qId] || false;

              // Compute dynamic button color classes based on state
              let btnStyle = "bg-slate-50 text-slate-600 hover:bg-slate-100/80 border border-slate-200";
              if (quizMode === "practice" && isChecked) {
                // Validate if answers match
                const exactMatch =
                  answersSelected.length === q.correct_answers.length &&
                  answersSelected.every((v) => q.correct_answers.includes(v));
                btnStyle = exactMatch
                  ? "bg-emerald-500 text-white hover:bg-emerald-600 border border-emerald-600 font-bold"
                  : "bg-rose-500 text-white hover:bg-rose-600 border border-rose-600 font-bold";
              } else if (examSubmitted) {
                const exactMatch =
                  answersSelected.length === q.correct_answers.length &&
                  answersSelected.every((v) => q.correct_answers.includes(v));
                btnStyle = exactMatch
                  ? "bg-emerald-500 text-white font-bold"
                  : isAnswered
                    ? "bg-rose-500 text-white font-bold"
                    : "bg-slate-100 text-slate-300 border border-slate-200";
              } else if (isMarked) {
                btnStyle = "bg-amber-500 text-white border-2 border-amber-600 font-black";
              } else if (isAnswered) {
                btnStyle = "bg-[#232F3E] text-white hover:bg-slate-800 border border-slate-900";
              }

              if (isSelected && !isMarked && (!isChecked || quizMode !== "practice") && !examSubmitted) {
                btnStyle = "bg-white text-slate-900 border-2 border-[#FF9900] font-black scale-105 shadow-sm";
              }

              return (
                <button
                  key={qId}
                  onClick={() => {
                    setCurrentIdx(idx);
                    // Auto close on mobile or unpinned desktop to avoid blocking layout
                    if (!sidebarPinned || window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`h-9 flex items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-all ${btnStyle}`}
                  id={`nav_q_${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress Summary bar stats at bottom */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Preguntas Resueltas</span>
            <span className="text-xs font-bold text-slate-700">
              {answeredCount} / {activeQuestions.length}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${activeQuestions.length > 0 ? (answeredCount / activeQuestions.length) * 100 : 0}%`,
              }}
              id="sidebar_progress_bar"
            />
          </div>
        </div>
      </aside>
    </>
  );
}

export default QuestionSidebar;
