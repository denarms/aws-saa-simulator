import React, { useState, useEffect, useRef } from "react";
import { 
  loadDefaultConcepts, 
  ConceptCard 
} from "../conceptsData";
import { 
  Search, 
  Layers, 
  BookOpen, 
  Upload, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function ConceptsViewer() {
  const [concepts, setConcepts] = useState<ConceptCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [studyMode, setStudyMode] = useState<"grid" | "flashcard">("grid");
  
  // Flashcards navigation
  const [flashIdx, setFlashIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Custom JSON Upload error/success states
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingConcepts, setIsLoadingConcepts] = useState(true);

  // Load concepts from localStorage, fall back to the (lazily loaded) defaults
  useEffect(() => {
    let cancelled = false;
    const saved = localStorage.getItem("aws_concepts_pool");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConcepts(parsed);
          setIsLoadingConcepts(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved concepts, falling back.", e);
      }
    }
    loadDefaultConcepts()
      .then((defaults) => {
        if (!cancelled) setConcepts(defaults);
      })
      .catch((err) => {
        console.error("No se pudieron cargar los conceptos por defecto:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConcepts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save concepts to localStorage when modified
  const saveConceptsPool = (pool: ConceptCard[]) => {
    setConcepts(pool);
    localStorage.setItem("aws_concepts_pool", JSON.stringify(pool));
  };

  // Handle file import
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result as string;
        const parsed = JSON.parse(rawText);
        
        let importedList: ConceptCard[] = [];
        
        // Check if the format is { total_concepts: X, concepts: [...] }
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.concepts)) {
          importedList = parsed.concepts;
        } else if (Array.isArray(parsed)) {
          importedList = parsed;
        } else {
          throw new Error("Formato inválido. Debe ser una lista [] o tener la propiedad 'concepts'.");
        }

        // Validate basic keys
        const validList = importedList.filter(
          (c: any) => c && typeof c === "object" && typeof c.concept === "string" && typeof c.definition === "string"
        );

        if (validList.length === 0) {
          throw new Error("No se encontraron tarjetas válidas con 'concept' y 'definition'.");
        }

        saveConceptsPool(validList);
        setFlashIdx(0);
        setIsFlipped(false);
        setImportStatus({
          type: "success",
          message: `¡Éxito! Se importaron ${validList.length} conceptos correctamente.`
        });
      } catch (err: any) {
        setImportStatus({
          type: "error",
          message: err.message || "Error al procesar el archivo JSON."
        });
      }
    };
    reader.readAsText(file);
    // Reset file input value to trigger again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Reset to default concepts
  const handleResetToDefault = async () => {
    if (window.confirm("¿Seguro que deseas restablecer el banco de conceptos predefinidos? Esto borrará tus tarjetas importadas.")) {
      try {
        const defaults = await loadDefaultConcepts();
        saveConceptsPool(defaults);
        setFlashIdx(0);
        setIsFlipped(false);
        setImportStatus({ type: "success", message: "Se ha restablecido el banco predeterminado." });
      } catch (err) {
        setImportStatus({ type: "error", message: "No se pudo restablecer el banco predeterminado." });
      }
    }
  };

  // Clear all concepts
  const handleClearAll = () => {
    if (window.confirm("¿Seguro que deseas eliminar todos los conceptos?")) {
      saveConceptsPool([]);
      setFlashIdx(0);
      setIsFlipped(false);
      setImportStatus({ type: "success", message: "Se han eliminado todos los conceptos." });
    }
  };

  // Filtered concepts
  const filteredConcepts = concepts.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.concept.toLowerCase().includes(q) || 
      c.definition.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-16" id="concepts_viewer_section">
      
      {/* Header section with Stats & Upload Option */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6" id="concepts_header_banner">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[#FF9900]">
            <Layers className="w-5 h-5 text-[#FF9900]" />
            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[#FF9900]">
              AWS Well-Architected Glossary
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Tarjetas de Conceptos Clave <span className="text-indigo-600">({concepts.length})</span>
          </h2>
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Domina las definiciones técnicas clave de AWS Solutions Architect Associate SAA-C03. Explora en formato glosario o ponte a prueba con el modo interactivo de flashcards.
          </p>
        </div>

        {/* Action Buttons: Import / Reset */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImportJson}
            className="hidden"
            id="import_concepts_file_input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 cursor-pointer"
            id="trigger_import_concepts_btn"
            title="Sube tu archivo JSON con hasta 732 tarjetas u otro tamaño"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar Tarjetas (.JSON)
          </button>
          
          <button
            onClick={handleResetToDefault}
            className="px-3 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            id="reset_concepts_btn"
            title="Restablecer set demostrativo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restablecer
          </button>

          {concepts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
              id="clear_concepts_btn"
              title="Borrar todas las tarjetas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Import status notification */}
      {importStatus.type && (
        <div 
          className={`p-4 rounded-xl flex items-start gap-3 border text-xs animate-slide-up ${
            importStatus.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}
          id="import_notification_alert"
        >
          {importStatus.type === "success" ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-extrabold block">
              {importStatus.type === "success" ? "Operación exitosa" : "Error en el archivo"}
            </span>
            <p className="mt-0.5 text-slate-600 leading-relaxed">{importStatus.message}</p>
          </div>
          <button 
            onClick={() => setImportStatus({ type: null, message: "" })}
            className="text-slate-400 hover:text-slate-600 ml-1.5 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Study Workspace Tab Swaps */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        
        {/* Sidebar Panel: Search & View Mode Switches */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Estudiar por</span>
            
            <div className="space-y-2">
              <button
                onClick={() => {
                  setStudyMode("grid");
                  setIsFlipped(false);
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
                  studyMode === "grid" 
                    ? "bg-[#232F3E] text-white shadow-sm" 
                    : "hover:bg-slate-100 text-slate-700 bg-slate-50 border border-slate-100"
                }`}
                id="mode_grid_btn"
              >
                <BookOpen className="w-4 h-4" />
                Lista y Glosario
              </button>

              <button
                onClick={() => {
                  setStudyMode("flashcard");
                  setIsFlipped(false);
                  setFlashIdx(0);
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
                  studyMode === "flashcard" 
                    ? "bg-[#232F3E] text-white shadow-sm" 
                    : "hover:bg-slate-100 text-slate-700 bg-slate-50 border border-slate-100"
                }`}
                id="mode_flashcard_btn"
                disabled={concepts.length === 0}
              >
                <RotateCw className="w-4 h-4 animate-pulse" />
                Modo Flashcards SAA
              </button>
            </div>

            {studyMode === "grid" && (
              <div className="pt-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block" htmlFor="concepts-search">Buscar en Tarjetas</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="concepts-search"
                    type="text"
                    placeholder="Ej. S3, VPC, EC2..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-medium transition-all"
                  />
                </div>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="text-[10px] font-bold text-indigo-600 hover:underline block text-right w-full"
                  >
                    Limpiar Filtro
                  </button>
                )}
              </div>
            )}

            {studyMode === "flashcard" && concepts.length > 0 && (
              <div className="pt-2 space-y-2 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Tu Progreso</span>
                <div className="flex justify-between font-bold text-slate-600 text-[11px]">
                  <span>Tarjeta:</span>
                  <span>{flashIdx + 1} de {concepts.length}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="bg-[#FF9900] h-full rounded-full transition-all duration-300"
                    style={{ width: `${((flashIdx + 1) / concepts.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Format Help Guide */}
          <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl border border-slate-800 text-[11px] leading-relaxed space-y-2.5 shadow-sm">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400 fill-current" /> Formato de Carga
            </span>
            <p>
              Puedes cargar cualquier archivo JSON con tus propias tarjetas. El formato soportado es:
            </p>
            <pre className="bg-slate-950 p-2 rounded text-[9.5px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`{
  "concepts": [
    {
      "concept": "Nombre",
      "definition": "Descripción..."
    }
  ]
}`}
            </pre>
          </div>
        </div>

        {/* Content Display Panel */}
        <div className="flex-1 min-w-0">
          {isLoadingConcepts ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-3 flex flex-col items-center justify-center h-full min-h-[300px]" id="loading_concepts_card">
              <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
              <p className="text-xs text-slate-500 font-semibold">Cargando tarjetas de conceptos...</p>
            </div>
          ) : concepts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-4 flex flex-col items-center justify-center h-full min-h-[300px]" id="empty_concepts_card">
              <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 mb-2">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-slate-800">No hay tarjetas de conceptos cargadas</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Carga el set demostrativo con el botón "Restablecer" o importa tu propio archivo JSON de tarjetas para comenzar a estudiar la arquitectura de AWS.
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const defaults = await loadDefaultConcepts();
                    saveConceptsPool(defaults);
                  } catch (err) {
                    setImportStatus({ type: "error", message: "No se pudo cargar el set demostrativo." });
                  }
                }}
                className="px-4 py-2 bg-[#232F3E] text-white hover:bg-slate-800 font-extrabold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Cargar Set Demostrativo
              </button>
            </div>
          ) : studyMode === "grid" ? (
            /* GRID VIEW */
            <div className="space-y-4" id="concepts_grid_container">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Mostrando {filteredConcepts.length} de {concepts.length} tarjetas
                </span>
              </div>

              {filteredConcepts.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-200/80 shadow-sm text-center text-slate-500 text-xs">
                  No se encontraron conceptos que coincidan con "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredConcepts.map((item, idx) => (
                    <div 
                      key={idx}
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
                      id={`concept_card_${idx}`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {item.concept}
                          </h4>
                          {item.question_reference && (
                            <span className="text-[9px] font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border border-slate-200/40">
                              Pregunta Ref: {item.question_reference}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {item.definition}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* FLASHCARD VIEW */
            <div className="flex flex-col items-center justify-center space-y-6" id="concepts_flashcards_interactive">
              
              {/* The interactive flip container */}
              <div 
                className="w-full max-w-lg aspect-[5/3.2] min-h-[280px] perspective-1000 cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
                title="Haz clic para voltear la tarjeta"
                id="flashcard_interactive_box"
              >
                <div 
                  className={`w-full h-full duration-500 transform-style-3d relative transition-transform ${
                    isFlipped ? "rotate-y-180" : ""
                  }`}
                >
                  
                  {/* FRONT SIDE */}
                  <div className="absolute inset-0 backface-hidden bg-white rounded-2xl border-2 border-slate-200 shadow-md p-8 flex flex-col justify-between">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500 fill-current" /> AWS CONCEPT
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {flashIdx + 1} de {concepts.length}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                      <h3 className="text-lg md:text-xl font-black text-slate-900 leading-snug">
                        {concepts[flashIdx]?.concept}
                      </h3>
                      <p className="text-[10px] text-indigo-500 font-extrabold tracking-widest mt-4 uppercase animate-pulse">
                        Hacer clic para ver definición
                      </p>
                    </div>

                    <div className="flex items-center justify-center text-slate-400 text-[10px] font-bold gap-1 mt-2">
                      <RotateCw className="w-3 h-3 animate-spin-slow" /> Ver Reverso
                    </div>
                  </div>

                  {/* BACK SIDE */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 text-slate-100 rounded-2xl border-2 border-[#FF9900]/40 shadow-xl p-8 flex flex-col justify-between">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <span className="text-[9px] font-black uppercase text-[#FF9900] tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#FF9900]" /> EXPLICACIÓN / RESPUESTA
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {flashIdx + 1} de {concepts.length}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center py-4">
                      <h4 className="text-xs font-black text-[#FF9900] uppercase tracking-wide mb-2">
                        Definición de {concepts[flashIdx]?.concept}:
                      </h4>
                      <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-medium">
                        {concepts[flashIdx]?.definition}
                      </p>
                    </div>

                    <div className="flex items-center justify-center text-slate-500 text-[10px] font-bold gap-1 mt-2 border-t border-slate-800 pt-3">
                      <RotateCw className="w-3 h-3" /> Hacer clic para volver a ver concepto
                    </div>
                  </div>

                </div>
              </div>

              {/* Navigation controls for Flashcards */}
              <div className="flex items-center gap-4 bg-white px-5 py-3 rounded-full border border-slate-200/80 shadow-sm" id="flashcard_navigation_dock">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                    setTimeout(() => {
                      setFlashIdx(prev => (prev > 0 ? prev - 1 : concepts.length - 1));
                    }, 150);
                  }}
                  className="p-2.5 hover:bg-slate-100 rounded-full text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  title="Concepto anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-xs font-bold text-slate-600 font-mono select-none px-2">
                  {flashIdx + 1} / {concepts.length}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                    setTimeout(() => {
                      setFlashIdx(prev => (prev < concepts.length - 1 ? prev + 1 : 0));
                    }, 150);
                  }}
                  className="p-2.5 hover:bg-slate-100 rounded-full text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  title="Concepto siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 font-medium text-center">
                Consejo: Puedes pulsar la barra espaciadora o hacer clic directamente en la tarjeta para revelarla.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
