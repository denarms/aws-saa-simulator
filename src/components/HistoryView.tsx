/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ExamHistoryEntry } from "../types";
import { Trash2, Award, TrendingUp, Target, ListChecks, AlertTriangle } from "lucide-react";

interface HistoryViewProps {
  history: ExamHistoryEntry[];
  onClear: () => void;
  onDeleteEntry: (id: string) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HistoryView({ history, onClear, onDeleteEntry }: HistoryViewProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return { attempts: 0, avgPercent: 0, bestPercent: 0, passRate: 0, examAttempts: 0 };
    }
    const examAttempts = history.filter((h) => h.mode === "exam");
    const avgPercent = Math.round(history.reduce((sum, h) => sum + h.percent, 0) / history.length);
    const bestPercent = Math.max(...history.map((h) => h.percent));
    const passRate =
      examAttempts.length > 0
        ? Math.round((examAttempts.filter((h) => h.passed).length / examAttempts.length) * 100)
        : 0;
    return { attempts: history.length, avgPercent, bestPercent, passRate, examAttempts: examAttempts.length };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 bg-slate-50 rounded-2xl border border-slate-100" id="history_empty_state">
        <ListChecks className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-slate-800 mt-4">Todavía no hay historial</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
          Completa una práctica o un examen de simulación para ver aquí tu progreso, puntuaciones y estadísticas.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8" id="history_view">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Historial y Estadísticas</h2>
        <p className="text-xs text-slate-500 mt-1">
          Seguimiento de tus intentos anteriores, guardado localmente en este navegador.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ListChecks className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="block text-lg font-black text-slate-900 leading-none">{stats.attempts}</span>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Intentos</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="block text-lg font-black text-slate-900 leading-none">{stats.avgPercent}%</span>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Promedio</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="block text-lg font-black text-slate-900 leading-none">{stats.bestPercent}%</span>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Mejor puntuación</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Target className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="block text-lg font-black text-slate-900 leading-none">
              {stats.examAttempts > 0 ? `${stats.passRate}%` : "—"}
            </span>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              Tasa de aprobación
            </span>
          </div>
        </div>
      </div>

      {/* Attempts list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Intentos recientes</h3>
          {!confirmingClear ? (
            <button
              onClick={() => setConfirmingClear(true)}
              className="text-[11px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
              id="history_clear_btn"
            >
              <Trash2 className="w-3.5 h-3.5" /> Borrar historial
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> ¿Seguro?
              </span>
              <button
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
                className="font-bold text-rose-600 hover:underline"
                id="history_clear_confirm_btn"
              >
                Sí, borrar
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="font-bold text-slate-400 hover:underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <ul className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          {history.map((entry) => (
            <li key={entry.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-[10px] ${
                    entry.mode === "exam"
                      ? entry.passed
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-rose-50 text-rose-600 border border-rose-100"
                      : "bg-orange-50 text-orange-600 border border-orange-100"
                  }`}
                >
                  {entry.mode === "exam" ? (entry.passed ? "OK" : "NO") : "PR"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {entry.mode === "exam" ? "Simulación de Examen" : "Práctica Libre"} — {entry.percent}%
                    <span className="ml-2 text-[10px] font-semibold text-slate-400 uppercase">
                      {entry.language}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDate(entry.date)} · {entry.correct}/{entry.total} correctas · {entry.answered} respondidas
                  </p>
                </div>
              </div>
              <button
                onClick={() => onDeleteEntry(entry.id)}
                className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                title="Eliminar este intento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default HistoryView;
