/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Award, RotateCcw, History } from "lucide-react";
import { QuizMode } from "../types";

export interface ExamResultStats {
  total: number;
  answered: number;
  correct: number;
  percent: number;
  passes: boolean;
}

interface ExamResultsPanelProps {
  stats: ExamResultStats;
  quizMode: QuizMode;
  onRestart: () => void;
  onReviewFreely: () => void;
  onReviewMistakes: () => void;
  onViewHistory: () => void;
}

// The end-of-attempt summary card: pass/fail badge, estimated score, and
// the follow-up actions (restart, free review, review only the missed
// questions, or jump to the history tab).
export function ExamResultsPanel({
  stats,
  quizMode,
  onRestart,
  onReviewFreely,
  onReviewMistakes,
  onViewHistory,
}: ExamResultsPanelProps) {
  return (
    <div className="max-w-4xl w-full mx-auto space-y-8 animate-fade-in" id="exam_results_card">
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg border-b-8 border-[#FF9900] text-center space-y-4">
        <Award className="w-16 h-16 text-[#FF9900] mx-auto" />
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Resultado de la Simulación</h2>
          <p className="text-slate-400 text-xs mt-1">Resumen del rendimiento oficial simulado para AWS SAA-C03</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Resultado SAA</span>
            <span className={`block text-lg font-black mt-1 ${stats.passes ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.passes ? "APROBADO" : "NO SATISFACTORIO"}
            </span>
          </div>
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Puntuación Estimada</span>
            <span className="block text-xl font-black mt-1 text-[#FF9900]">
              {Math.max(100, Math.round((stats.correct / stats.total) * 900) + 100)} / 1000
            </span>
          </div>
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Respuestas Correctas</span>
            <span className="block text-xl font-black mt-1 text-slate-100">
              {stats.correct} de {stats.total}
            </span>
          </div>
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Exactitud general</span>
            <span className="block text-xl font-black mt-1 text-slate-100">{stats.percent}%</span>
          </div>
        </div>

        <div className="pt-4">
          {stats.passes ? (
            <p className="text-xs text-emerald-300 max-w-md mx-auto">
              🎉 ¡Excelente! Superaste el umbral de aprobación simulado (72%). Estás bien encaminado para la prueba real con AWS.
            </p>
          ) : (
            <p className="text-xs text-rose-300 max-w-md mx-auto">
              💡 No te desanimes. Estudia las fallas de diseño en las explicaciones de abajo utilizando el navegador de la columna izquierda.
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-center pt-2 flex-wrap">
          <button
            onClick={onRestart}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 font-semibold rounded-lg border border-slate-700 transition"
          >
            Reiniciar Simulación
          </button>
          <button
            onClick={onReviewFreely}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold rounded-lg transition"
          >
            Revisar Respuestas en Modo Libre
          </button>
          {stats.correct < stats.total && (
            <button
              onClick={onReviewMistakes}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
              id="review_mistakes_btn"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Repasar Falladas ({stats.total - stats.correct})
            </button>
          )}
          <button
            onClick={onViewHistory}
            className="px-5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" /> Ver Historial
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExamResultsPanel;
