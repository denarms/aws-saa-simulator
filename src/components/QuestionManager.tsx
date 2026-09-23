/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Question, Option } from "../types";
import { loadSampleQuestions as fetchSampleQuestions } from "../sampleQuestions";
import { Upload, Plus, Trash2, Edit2, Download, AlertCircle, FileText, CheckCircle, RefreshCw } from "lucide-react";

interface QuestionManagerProps {
  questions: Question[];
  onUpdateQuestions: (questions: Question[]) => void;
}

export default function QuestionManager({ questions, onUpdateQuestions }: QuestionManagerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  
  // States for manual creation form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNum, setNewNum] = useState<number>(questions.length > 0 ? Math.max(...questions.map(q => q.question_number)) + 1 : 1);
  const [newText, setNewText] = useState("");
  const [isMulti, setIsMulti] = useState(false);
  const [newOptions, setNewOptions] = useState<Option[]>([
    { key: "A", text: "" },
    { key: "B", text: "" },
    { key: "C", text: "" },
    { key: "D", text: "" }
  ]);
  const [correctKeys, setCorrectKeys] = useState<string[]>(["A"]);
  const [manualExplanation, setManualExplanation] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setImportError(null);
    setSuccessMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let parsed = JSON.parse(text);

        // If the JSON is wrapped in a helper object like { total_questions: X, questions: [...] }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
          parsed = parsed.questions;
        }

        // Standardize: if single object upload, wrap in array
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }

        // Validate structure
        const validated: Question[] = [];
        parsed.forEach((item: any, idx: number) => {
          if (!item.question || !Array.isArray(item.options) || !Array.isArray(item.correct_answers)) {
            throw new Error(`La pregunta correspondiente al índice ${idx} no cumple con el formato requerido.`);
          }
          
          const translatedQ = item.translated_question || item.question_esp || undefined;
          let translatedOpts = item.translated_options || undefined;
          if (!translatedOpts && item.options.some((o: any) => o.text_esp)) {
            translatedOpts = item.options.map((o: any) => ({
              key: o.key || "",
              text: o.text_esp || o.text || ""
            }));
          }

          validated.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + idx),
            question_number: item.question_number || (questions.length + idx + 1),
            is_multiple_choice: item.is_multiple_choice !== undefined ? item.is_multiple_choice : item.correct_answers.length > 1,
            question: item.question,
            options: item.options.map((opt: any) => ({
              key: opt.key || "",
              text: opt.text || "",
              text_esp: opt.text_esp || undefined
            })),
            correct_answers: item.correct_answers.map((ans: any) => String(ans).trim().toUpperCase()),
            explanation: item.explanation || item.feedback || item.retroalimentacion || "",
            translated_question: translatedQ,
            translated_options: translatedOpts,
            question_esp: item.question_esp || undefined
          });
        });

        const merged = [...questions, ...validated];
        onUpdateQuestions(merged);
        setSuccessMsg(`¡Éxito! Se han cargado y validado correctamente ${validated.length} preguntas del examen.`);
      } catch (err: any) {
        setImportError(`Error de formato JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const loadSampleQuestions = async () => {
    setImportError(null);
    setConfirmingClear(false);
    setIsLoadingSamples(true);
    try {
      const samples = await fetchSampleQuestions();
      const formattedSamples = samples.map((q, idx) => ({
        ...q,
        id: crypto.randomUUID ? crypto.randomUUID() : `sample-${idx}`
      }));
      onUpdateQuestions(formattedSamples);
      setSuccessMsg("Se han cargado las preguntas demostrativas con respuestas de AWS SAA-C03.");
    } catch (err: any) {
      setImportError(`No se pudo cargar el set demostrativo: ${err?.message || "error desconocido"}`);
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const clearQuestions = () => {
    onUpdateQuestions([]);
    setSuccessMsg("Base de datos limpia. Se reestableció a 0 preguntas.");
    setImportError(null);
    setConfirmingClear(false);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const keySet = newOptions.filter(o => o.text.trim() !== "");
    if (keySet.length < 2) {
      setImportError("Una pregunta debe tener al menos 2 opciones con texto.");
      return;
    }

    const item: Question = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      question_number: newNum,
      is_multiple_choice: isMulti,
      question: newText,
      options: keySet,
      correct_answers: correctKeys,
      explanation: manualExplanation
    };

    onUpdateQuestions([...questions, item]);
    setSuccessMsg(`Pregunta Nº ${newNum} añadida correctamente de manera manual.`);
    
    // Clear and reset form
    setNewText("");
    setManualExplanation("");
    setNewNum(newNum + 1);
    setNewOptions([
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" }
    ]);
    setCorrectKeys(["A"]);
    setShowAddForm(false);
  };

  const toggleCorrectKey = (key: string) => {
    if (isMulti) {
      if (correctKeys.includes(key)) {
        if (correctKeys.length > 1) {
          setCorrectKeys(correctKeys.filter(k => k !== key));
        }
      } else {
        setCorrectKeys([...correctKeys, key]);
      }
    } else {
      setCorrectKeys([key]);
    }
  };

  const exportToJson = () => {
    if (questions.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(questions, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", "aws_saa_questions.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">PREGUNTAS CARGADAS</span>
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight mt-1">
              {questions.length}
            </h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileText className="w-6 h-6" id="questions_icon" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">REQUISITO INICIAL</span>
            <h3 className="text-lg font-semibold text-slate-700 tracking-tight mt-2 flex items-center gap-1.5">
              {questions.length === 0 ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> Vacío (0 por defecto)
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> Preguntas Listas
                </span>
              )}
            </h3>
          </div>
          <div className={`p-3 rounded-lg ${questions.length === 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertCircle className="w-6 h-6" id="status_alert_icon" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between gap-2">
            <button
              onClick={loadSampleQuestions}
              disabled={isLoadingSamples}
              className="flex-1 py-2 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              id="load_samples_btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSamples ? "animate-spin" : ""}`} />
              {isLoadingSamples ? "Cargando..." : "Cargar Ejemplos"}
            </button>
            {questions.length > 0 && (
              confirmingClear ? (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <button
                    onClick={clearQuestions}
                    className="py-2 px-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-sm"
                    id="confirm_clear_btn"
                  >
                    ¿Vaciar? Sí
                  </button>
                  <button
                    onClick={() => setConfirmingClear(false)}
                    className="py-2 px-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                    id="cancel_clear_btn"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingClear(true)}
                  className="py-2 px-3 text-xs font-semibold bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                  id="clear_questions_btn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vaciar
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start gap-2.5 animate-fade-in" id="success_alert_container">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      {importError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-2.5" id="error_alert_container">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>{importError}</div>
        </div>
      )}

      {/* Main Import Area */}
      <div className="grid grid-cols-1 gap-6">

        {/* Upload file section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-slate-800 mb-2">Cargar Archivo de Preguntas JSON</h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Arrastra o selecciona un archivo <strong>JSON</strong> que contenga el banco de preguntas oficial del SAA-C03. El esquema debe coincidir exactamente con el formato de llave estructurada (<code>question_number</code>, <code>options</code>, <code>correct_answers</code>).
            </p>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive ? "border-amber-500 bg-amber-50/20" : "border-slate-200 hover:border-amber-400 hover:bg-slate-50/30"
            }`}
            onClick={() => document.getElementById("file-upload")?.click()}
            id="drag_drop_zone"
          >
            <input
              id="file-upload"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-3 shadow-inner">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Arrastra tu archivo aquí</span>
              <span className="text-xs text-slate-400 mt-1">O haz clic para navegar por tus archivos (.json)</span>
            </div>
          </div>

          {questions.length > 0 && (
            <button
              onClick={exportToJson}
              className="mt-4 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
              id="export_json_btn"
            >
              <Download className="w-4 h-4" /> Exportar Banco de Preguntas Actual (.json)
            </button>
          )}
        </div>

      </div>

      {/* Manual Input Trigger */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-55/40 transition-colors text-left"
          id="toggle_manual_form_btn"
        >
          <div className="flex items-center gap-2.5">
            <Plus className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">Agregar Pregunta Manualmente</h4>
              <p className="text-xs text-slate-400 mt-0.5">Completa el formulario para ingresar un escenario personalizado</p>
            </div>
          </div>
        </button>

        {showAddForm && (
          <form onSubmit={handleAddManual} className="p-6 border-t border-slate-100 bg-slate-50/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Número de Pregunta</label>
                <input
                  type="number"
                  value={newNum}
                  onChange={(e) => setNewNum(Number(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  required
                />
              </div>

              <div className="md:col-span-2 flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={isMulti}
                    onChange={(e) => {
                      setIsMulti(e.target.checked);
                      setCorrectKeys(["A"]); // Reset
                    }}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-slate-300 rounded"
                  />
                  ¿Es de elección múltiple? (Multi-selección, elegir 2 o más)
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Enunciado del Escenario de AWS (Pregunta)</label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Ej. A company wants to host a highly available database... Which combination of services..."
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-h-[100px] focus:ring-1 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600">Opciones de Respuesta</label>
              {newOptions.map((opt, idx) => (
                <div key={opt.key} className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => toggleCorrectKey(opt.key)}
                    className={`w-9 h-9 rounded-lg font-bold text-sm tracking-wide border flex items-center justify-center shadow-sm shrink-0 transition-colors ${
                      correctKeys.includes(opt.key)
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    title={correctKeys.includes(opt.key) ? "Correcta" : "Incorrecta (Haz clic para alternar)"}
                  >
                    {opt.key}
                  </button>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const updated = [...newOptions];
                      updated[idx].text = e.target.value;
                      setNewOptions(updated);
                    }}
                    placeholder={`Texto de la respuesta ${opt.key}...`}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    required
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Explicación Técnica (Opcional)</label>
              <textarea
                value={manualExplanation}
                onChange={(e) => setManualExplanation(e.target.value)}
                placeholder="Escribe el razonamiento para cuando el alumno realice la comprobación inmediata..."
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 shadow"
              >
                Agregar al Banco
              </button>
            </div>
          </form>
        )}
      </div>

      {/* List of current questions and schemas */}
      {questions.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 mb-3">Lista de Preguntas Actuales ({questions.length})</h4>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 pr-2">
            {questions.map((q, idx) => (
              <div key={q.id || idx} className="py-3 flex items-start justify-between gap-4 group">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">Pregunta #{q.question_number} {q.is_multiple_choice ? '(Múltiple)' : '(Única)'}</span>
                  <p className="text-xs font-medium text-slate-700 line-clamp-1 pr-6">{q.question}</p>
                </div>
                <button
                  onClick={() => {
                    const filtered = questions.filter((_, i) => i !== idx);
                    onUpdateQuestions(filtered);
                  }}
                  className="p-1 px-2 border border-slate-100 hover:border-transparent hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors text-xs flex font-medium items-center gap-1 opacity-0 group-hover:opacity-100"
                  title="Eliminar Pregunta"
                >
                  <Trash2 className="w-3" /> Borrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
