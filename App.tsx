
import React, { useState, useEffect } from 'react';
import { 
  FileUp, 
  Trash2, 
  Play, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  FileText,
  PieChart,
  LayoutDashboard,
  Settings,
  Image as ImageIcon,
  User,
  Tag,
  Coins,
  Receipt,
  Key,
  ExternalLink,
  Pencil,
  FileSpreadsheet,
  Package,
  Briefcase,
  Eye,
  X,
  AlertTriangle
} from 'lucide-react';
import { ReportType, ProcessingFile } from './types';
import { processInvoice } from './geminiService';
import { generateExcel } from './excelService';

// Validation helpers for DGII (Dominican Republic Tax Authority)
const validateRncCedulaByTipo = (val: any, tipoId?: string): { isValid: boolean; message: string } => {
  if (!val) return { isValid: false, message: 'El campo es requerido' };
  const clean = String(val).replace(/[^0-9]/g, '');
  if (tipoId === '1') {
    return {
      isValid: clean.length === 9,
      message: 'RNC inválido: debe contener exactamente 9 dígitos.'
    };
  } else if (tipoId === '2') {
    return {
      isValid: clean.length === 11,
      message: 'Cédula inválida: debe contener exactamente 11 dígitos.'
    };
  } else if (tipoId === '3') {
    return {
      isValid: String(val).trim().length > 0,
      message: 'Pasaporte requerido.'
    };
  }
  
  // Generic guess based on length
  return {
    isValid: clean.length === 9 || clean.length === 11,
    message: 'Identificación incorrecta: RNC debe tener 9 dígitos y Cédula debe tener 11.'
  };
};

const validateNcfWithMsg = (val: any): { isValid: boolean; message: string } => {
  if (!val) return { isValid: false, message: 'El NCF es requerido' };
  const clean = String(val).trim().toUpperCase();
  if (/^B[0-9]{10}$/.test(clean)) {
    return { isValid: true, message: 'NCF Válido (Comprobante Estándar de 11 dígitos)' };
  }
  if (/^E[0-9]{12}$/.test(clean)) {
    return { isValid: true, message: 'e-CF Válido (Comprobante Electrónico de 13 dígitos)' };
  }
  if (/^A[0-9]{18}$/.test(clean)) {
    return { isValid: true, message: 'NCF Válido (Formato Anterior de 19 dígitos)' };
  }
  return {
    isValid: false,
    message: 'NCF incorrecto. Formatos válidos: B + 10 dígitos (ej. B0100000001), E + 12 dígitos (ej. E310100000001) o A + 18 dígitos.'
  };
};

const GASTO_LABELS: Record<string, string> = {
  '01': 'Gastos de personal',
  '02': 'Gastos de trabajos, suministros y servicios',
  '03': 'Arrendamientos',
  '04': 'Gastos de activos fijos',
  '05': 'Gastos de representación',
  '06': 'Gastos deducciones admitidas',
  '07': 'Gastos financieros',
  '08': 'Gastos extraordinarios',
  '09': 'Compras y gastos que forman parte del costo de venta',
  '10': 'Adquisiciones de activos',
  '11': 'Gastos de Seguros'
};

const INGRESO_LABELS: Record<string, string> = {
  '01': 'Operaciones',
  '02': 'Financieros',
  '03': 'Extraordinarios',
  '04': 'Otros Ingresos'
};

interface EditableCellProps {
  fileId: string;
  field: string;
  value: any;
  type: 'text' | 'number' | 'select';
  selectOptions?: Record<string, string>;
  onSave: (fileId: string, field: string, value: any) => void;
  className?: string;
  children: React.ReactNode;
}

const EditableCell: React.FC<EditableCellProps> = ({
  fileId,
  field,
  value,
  type,
  selectOptions,
  onSave,
  className = '',
  children
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSave = () => {
    onSave(fileId, field, tempValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setTempValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (type === 'select' && selectOptions) {
      return (
        <td className="p-2 border-b">
          <select
            value={tempValue || ''}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSave}
            autoFocus
            className="w-full bg-white border border-indigo-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccione...</option>
            {Object.entries(selectOptions).map(([code, label]) => (
              <option key={code} value={code}>
                {code} - {label}
              </option>
            ))}
          </select>
        </td>
      );
    }

    return (
      <td className="p-2 border-b">
        <input
          type={type === 'number' ? 'number' : 'text'}
          step={type === 'number' ? '0.01' : undefined}
          value={tempValue === undefined || tempValue === null ? '' : tempValue}
          onChange={(e) => {
            const val = e.target.value;
            setTempValue(type === 'number' ? (val === '' ? 0 : parseFloat(val)) : val);
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full bg-white border border-indigo-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>
    );
  }

  return (
    <td 
      onClick={() => setIsEditing(true)}
      className={`p-4 cursor-pointer hover:bg-indigo-50/50 transition-colors group/cell relative ${className}`}
      title="Clic para editar"
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex-1 overflow-hidden truncate">
          {children}
        </div>
        <Pencil size={12} className="opacity-0 group-hover/cell:opacity-100 text-slate-400 transition-opacity ml-1 flex-shrink-0" />
      </div>
    </td>
  );
};

const App: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>(ReportType.REPORT_606);
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'upload' | 'results'>('upload');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [rncInformante, setRncInformante] = useState<string>('');
  const [periodo, setPeriodo] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}${mm}`;
  });
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.hasKey) {
            setHasApiKey(true);
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching backend config:', err);
      }

      // Fallback: Check if AI Studio selected API Key exists
      try {
        // @ts-ignore
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          // @ts-ignore
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
          return;
        }
      } catch (err) {
        console.error('Error querying aistudio key status:', err);
      }

      // Default to true so user is not blocked
      setHasApiKey(true);
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
    } catch (err) {
      console.error('Error opening select key dialog:', err);
    }
    setHasApiKey(true); // Proceed as per guidelines race condition rule
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const handleCellSave = (fileId: string, field: string, value: any) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId && f.extractedData) {
        let typedValue = value;
        if (['montoPropinaLegal', 'itbisFacturado', 'totalFacturado', 'montoFacturado', 'montoBienes', 'montoServicios', 'otrosImpuestos'].includes(field)) {
          typedValue = parseFloat(value) || 0;
        }
        
        const updatedData = {
          ...f.extractedData,
          [field]: typedValue
        };

        // If we are in 606, keep the amounts in sync with the Goods/Services subtotal split
        if (reportType === ReportType.REPORT_606) {
          const total = Number(updatedData.totalFacturado) || 0;
          const itbis = Number(updatedData.itbisFacturado) || 0;
          const otros = Number(updatedData.otrosImpuestos) || 0;
          const propina = Number(updatedData.montoPropinaLegal) || 0;
          const subtotal = Math.max(0, total - itbis - otros - propina);

          const currentType = updatedData.tipoBienServicio || (['09', '10'].includes(updatedData.tipoGasto || '02') ? 'bien' : 'servicio');
          updatedData.tipoBienServicio = currentType;

          if (currentType === 'bien') {
            updatedData.montoBienes = subtotal;
            updatedData.montoServicios = 0;
          } else {
            updatedData.montoServicios = subtotal;
            updatedData.montoBienes = 0;
          }
        }

        return {
          ...f,
          extractedData: updatedData
        };
      }
      return f;
    }));
  };

  const handleTipoCompraChange = (fileId: string, value: 'bien' | 'servicio') => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId && f.extractedData) {
        const data = f.extractedData;
        const total = Number(data.totalFacturado) || 0;
        const itbis = Number(data.itbisFacturado) || 0;
        const otros = Number(data.otrosImpuestos) || 0;
        const propina = Number(data.montoPropinaLegal) || 0;
        const subtotal = Math.max(0, total - itbis - otros - propina);

        return {
          ...f,
          extractedData: {
            ...data,
            tipoBienServicio: value,
            montoBienes: value === 'bien' ? subtotal : 0,
            montoServicios: value === 'servicio' ? subtotal : 0
          }
        };
      }
      return f;
    }));
  };

  const processAll = async () => {
    setIsProcessing(true);
    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status === 'completed') continue;

      try {
        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);

        const result = await processInvoice(updatedFiles[i].file, reportType);
        
        updatedFiles[i].extractedData = result;
        updatedFiles[i].status = 'completed';
      } catch (err: any) {
        console.error(err);
        updatedFiles[i].status = 'error';
        
        if (err.message === 'KEY_NOT_FOUND' || err.message === 'QUOTA_EXCEEDED') {
          updatedFiles[i].error = 'Error de cuota o clave API. Por favor, selecciona una clave de un proyecto con facturación.';
          setHasApiKey(false);
          setIsProcessing(false);
          return;
        } else {
          updatedFiles[i].error = `Error: ${err.message || err.toString()}`;
        }
      }
      setFiles([...updatedFiles]);
    }
    setIsProcessing(false);
    setView('results');
  };

  const exportData = () => {
    const completedData = files
      .filter(f => f.status === 'completed' && f.extractedData)
      .map(f => f.extractedData);
    
    if (completedData.length > 0) {
      generateExcel(completedData, reportType, rncInformante, periodo);
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="text-indigo-600" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Configuración Requerida</h2>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
            Para utilizar el procesador de facturas mediante <strong>Gemini 2.5 Flash</strong> y evitar límites de cuota compartidos, 
            es necesario que selecciones tu propia API Key. Puedes usar una clave gratuita (<strong>Free Tier</strong>) o una con facturación activa si deseas procesar grandes volúmenes.
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={handleOpenKeyDialog}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
            >
              <Key size={20} />
              Seleccionar API Key
            </button>
            
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
            >
              Documentación de Facturación
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  const previewFile = files.find(f => f.id === previewFileId);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-indigo-900 text-white flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="text-indigo-400" />
            FiscalSmart
          </h1>
          <p className="text-indigo-300 text-xs mt-1 uppercase tracking-wider font-semibold">Generador DGII 606/607</p>
        </div>
        <nav className="mt-6">
          <button 
            onClick={() => setView('upload')}
            className={`w-full flex items-center gap-3 px-6 py-4 transition-colors ${view === 'upload' ? 'bg-indigo-800 border-l-4 border-indigo-400' : 'hover:bg-indigo-800'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => setView('results')}
            className={`w-full flex items-center gap-3 px-6 py-4 transition-colors ${view === 'results' ? 'bg-indigo-800 border-l-4 border-indigo-400' : 'hover:bg-indigo-800'}`}
          >
            <FileText size={20} />
            Resultados
          </button>
          
          <div className="mt-auto p-6 absolute bottom-0 w-64 hidden md:block">
             <div className="bg-indigo-800 rounded-lg p-4 text-sm mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={14} className="text-green-400" />
                  <p className="font-medium text-xs">Clave API Activa</p>
                </div>
                <button 
                  onClick={handleOpenKeyDialog}
                  className="text-indigo-300 text-[10px] hover:text-white transition-colors underline"
                >
                  Cambiar API Key
                </button>
             </div>
             <div className="bg-indigo-800 rounded-lg p-4 text-sm">
                <p className="font-medium">Potenciado por Gemini</p>
                <p className="text-indigo-300 text-xs mt-1">Extracción automática de datos fiscales con IA.</p>
             </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {view === 'upload' ? 'Procesar Documentos' : 'Revisión y Exportación'}
            </h2>
            <p className="text-slate-500">
              {view === 'upload' ? 'Sube tus facturas para extraer datos automáticamente.' : 'Verifica los datos extraídos antes de exportar a Excel.'}
            </p>
          </div>

          {view === 'upload' && (
            <div className="flex bg-white p-1 rounded-lg shadow-sm border border-slate-200">
              <button 
                onClick={() => setReportType(ReportType.REPORT_606)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === ReportType.REPORT_606 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Gasto (606)
              </button>
              <button 
                onClick={() => setReportType(ReportType.REPORT_607)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === ReportType.REPORT_607 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Ingreso (607)
              </button>
            </div>
          )}
        </header>

        {view === 'upload' ? (
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-12 flex flex-col items-center justify-center text-center transition-all hover:border-indigo-400 group">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileUp className="text-indigo-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Cargar Facturas</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">Arrastra y suelta tus archivos PDF o imágenes (JPG/PNG) aquí, o haz clic para seleccionar archivos.</p>
              <label className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg">
                Seleccionar Archivos
                <input type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">{files.length} Archivos cargados</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFiles([])}
                      className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm flex items-center gap-2"
                    >
                      <Trash2 size={16} /> Limpiar Todo
                    </button>
                    <button 
                      onClick={processAll}
                      disabled={isProcessing}
                      className="bg-green-600 text-white hover:bg-green-700 px-4 py-1 rounded text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                      {isProcessing ? 'Procesando...' : 'Procesar Todo'}
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                  {files.map(file => (
                    <div key={file.id} className="p-4 flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded bg-slate-100 flex-shrink-0 overflow-hidden relative">
                         {file.file.type.startsWith('image/') ? (
                           <img src={file.previewUrl} alt="preview" className="w-full h-full object-cover" />
                         ) : (
                           <div className="flex items-center justify-center h-full text-indigo-400">
                             <FileText size={24} />
                           </div>
                         )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{file.file.name}</p>
                        <p className="text-xs text-slate-500">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {file.status === 'completed' && <CheckCircle className="text-green-500" size={18} />}
                        {file.status === 'error' && <AlertCircle className="text-red-500" size={18} title={file.error} />}
                        {file.status === 'processing' && <Loader2 className="text-indigo-500 animate-spin" size={18} />}
                        {file.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                        <button 
                          onClick={() => removeFile(file.id)}
                          className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Configuration Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                  Datos de Cabecera Oficial (Formato {reportType})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
                    RNC / Cédula del Informante
                  </label>
                  <input 
                    type="text" 
                    placeholder="Eje: 101010101"
                    maxLength={11}
                    value={rncInformante}
                    onChange={(e) => setRncInformante(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
                    Periodo Declarado (AAAAMM)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Eje: 202607"
                    maxLength={6}
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700 font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={exportData}
                    className="w-full bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all self-stretch md:self-auto h-[38px] font-sans"
                  >
                    <Download size={18} />
                    Descargar Excel Oficial
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50 border border-amber-200 p-4 rounded-xl">
              <div className="flex items-start gap-2.5 text-amber-800 text-sm">
                <span className="text-lg leading-none">💡</span>
                <div>
                  <span className="font-bold block mb-0.5">Valores Editables</span>
                  Haz clic directamente sobre cualquier celda de la tabla para corregir o ajustar los datos extraídos por la IA antes de exportar.
                </div>
              </div>
              <button 
                onClick={exportData}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg transition-all whitespace-nowrap self-stretch md:self-auto"
              >
                <Download size={18} />
                Descargar Excel para DGII
              </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                    <th className="p-4 border-b">Archivo</th>
                    <th className="p-4 border-b">Nombre / Razón Social</th>
                    <th className="p-4 border-b">RNC / Cédula</th>
                    <th className="p-4 border-b">NCF</th>
                    <th className="p-4 border-b">Categoría DGII</th>
                    {reportType === ReportType.REPORT_606 && (
                      <th className="p-4 border-b text-center">Tipo Compra</th>
                    )}
                    <th className="p-4 border-b">Fecha</th>
                    <th className="p-4 border-b text-right">Propina Legal</th>
                    <th className="p-4 border-b text-right">ITBIS</th>
                    <th className="p-4 border-b text-right">Monto Total</th>
                    <th className="p-4 border-b">Estado</th>
                    <th className="p-4 border-b text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {files.filter(f => f.status === 'completed' || f.status === 'error').map(file => {
                    const data = file.extractedData;
                    const entityName = data?.nombreSuplidor || data?.nombreCliente || '---';
                    const catCode = data?.tipoGasto || data?.tipoIngreso;
                    const catLabel = reportType === ReportType.REPORT_606 ? GASTO_LABELS[catCode] : INGRESO_LABELS[catCode];
                    const propina = data?.montoPropinaLegal || 0;
                    const itbis = data?.itbisFacturado || 0;

                    return (
                      <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center overflow-hidden">
                             {file.file.type.startsWith('image/') ? (
                               <img src={file.previewUrl} className="w-full h-full object-cover" />
                             ) : <FileText size={16} className="text-indigo-500" />}
                          </div>
                          <span className="truncate max-w-[120px] font-medium text-slate-700">{file.file.name}</span>
                        </td>
                        <EditableCell
                          fileId={file.id}
                          field={reportType === ReportType.REPORT_606 ? 'nombreSuplidor' : 'nombreCliente'}
                          value={entityName}
                          type="text"
                          onSave={handleCellSave}
                        >
                           <div className="flex items-center gap-2">
                             <User size={14} className="text-slate-400" />
                             <span className="font-medium text-slate-800 uppercase text-xs">{entityName}</span>
                           </div>
                        </EditableCell>
                        <EditableCell
                          fileId={file.id}
                          field="rncCedula"
                          value={data?.rncCedula || ''}
                          type="text"
                          onSave={handleCellSave}
                          className="font-mono text-slate-600"
                        >
                          {(() => {
                            const rncCheck = validateRncCedulaByTipo(data?.rncCedula, data?.tipoId);
                            return (
                              <div className="flex items-center gap-1.5" title={rncCheck.isValid ? undefined : rncCheck.message}>
                                <span className={!rncCheck.isValid ? "text-amber-600 font-semibold" : ""}>
                                  {data?.rncCedula || '---'}
                                </span>
                                {!rncCheck.isValid && data?.rncCedula && (
                                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                )}
                              </div>
                            );
                          })()}
                        </EditableCell>
                        <EditableCell
                          fileId={file.id}
                          field="ncf"
                          value={data?.ncf || ''}
                          type="text"
                          onSave={handleCellSave}
                          className="font-mono text-slate-600"
                        >
                          {(() => {
                            const ncfCheck = validateNcfWithMsg(data?.ncf);
                            return (
                              <div className="flex items-center gap-1.5" title={ncfCheck.isValid ? undefined : ncfCheck.message}>
                                <span className={!ncfCheck.isValid ? "text-amber-600 font-semibold" : ""}>
                                  {data?.ncf || '---'}
                                </span>
                                {!ncfCheck.isValid && data?.ncf && (
                                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                )}
                              </div>
                            );
                          })()}
                        </EditableCell>
                        <EditableCell
                          fileId={file.id}
                          field={reportType === ReportType.REPORT_606 ? 'tipoGasto' : 'tipoIngreso'}
                          value={catCode || ''}
                          type="select"
                          selectOptions={reportType === ReportType.REPORT_606 ? GASTO_LABELS : INGRESO_LABELS}
                          onSave={handleCellSave}
                        >
                           {catCode ? (
                             <div className="flex items-center gap-1.5 bg-indigo-50/70 text-indigo-800 px-2.5 py-1 rounded-md border border-indigo-100 max-w-[280px]">
                               <Tag size={12} className="shrink-0 text-indigo-500" />
                               <span className="text-xs font-medium leading-tight text-indigo-950 break-words">{catCode} - {catLabel}</span>
                             </div>
                           ) : '---'}
                        </EditableCell>
                        {reportType === ReportType.REPORT_606 && (
                          <td className="p-4 border-b text-center align-middle">
                            {(() => {
                              const tg = data?.tipoGasto || '02';
                              const detectedType = data?.tipoBienServicio || (['09', '10'].includes(tg) ? 'bien' : 'servicio');
                              
                              return (
                                <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTipoCompraChange(file.id, 'servicio');
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      detectedType === 'servicio'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                    title="Clasificar como Servicio"
                                  >
                                    <Briefcase size={12} />
                                    Servicio
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTipoCompraChange(file.id, 'bien');
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                      detectedType === 'bien'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                    title="Clasificar como Bien (Mercancía/Activo)"
                                  >
                                    <Package size={12} />
                                    Bien
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        <EditableCell
                          fileId={file.id}
                          field="fechaComprobante"
                          value={data?.fechaComprobante || ''}
                          type="text"
                          onSave={handleCellSave}
                          className="text-slate-600"
                        >
                          {data?.fechaComprobante || '---'}
                        </EditableCell>
                        <EditableCell
                          fileId={file.id}
                          field="montoPropinaLegal"
                          value={propina}
                          type="number"
                          onSave={handleCellSave}
                          className="text-right"
                        >
                          {propina > 0 ? (
                            <span className="text-amber-600 font-medium flex items-center justify-end gap-1">
                              <Coins size={14} />
                              RD$ {propina.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300">RD$ 0</span>
                          )}
                        </EditableCell>
                        <EditableCell
                          fileId={file.id}
                          field="itbisFacturado"
                          value={itbis}
                          type="number"
                          onSave={handleCellSave}
                          className="text-right"
                        >
                          {itbis > 0 ? (
                            <span className="text-blue-600 font-medium">
                              RD$ {itbis.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300">RD$ 0</span>
                          )}
                        </EditableCell>
                        <EditableCell
                          fileId={file.id}
                          field={reportType === ReportType.REPORT_606 ? 'totalFacturado' : 'montoFacturado'}
                          value={data ? (data.totalFacturado || data.montoFacturado || 0) : 0}
                          type="number"
                          onSave={handleCellSave}
                          className="font-semibold text-indigo-700 text-right"
                        >
                          {data ? `RD$ ${(data.totalFacturado || data.montoFacturado || 0).toLocaleString()}` : '---'}
                        </EditableCell>
                        <td className="p-4">
                          {file.status === 'completed' ? (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">Extraído</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">Fallo</span>
                              <AlertCircle size={14} className="text-red-500 cursor-help" title={file.error} />
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => setPreviewFileId(file.id)}
                            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-150 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-indigo-100/60"
                            title="Ver documento y corregir datos"
                          >
                            <Eye size={13} />
                            Ver y Corregir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {files.filter(f => f.status === 'completed' || f.status === 'error').length === 0 && (
                    <tr>
                      <td colSpan={reportType === ReportType.REPORT_606 ? 12 : 11} className="p-12 text-center text-slate-400">
                        No hay resultados para mostrar aún. Procesa algunos archivos primero.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Side-by-Side Visual Preview & Correction Modal */}
      {previewFileId && previewFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-2xl w-full h-[90vh] max-w-7xl flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div>
                <h3 className="font-sans font-semibold text-lg text-slate-900 flex items-center gap-2">
                  <Eye size={20} className="text-indigo-600" />
                  Auditoría de Documento y Corrección de Datos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archivo: <span className="font-semibold font-mono text-slate-700">{previewFile.file.name}</span>
                </p>
              </div>
              <button
                onClick={() => setPreviewFileId(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Split Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
              {/* Left Panel: Document Viewer */}
              <div className="lg:col-span-7 h-full flex flex-col bg-slate-100 border-r border-slate-200 p-4 min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-indigo-500" />
                    Documento Original
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md font-medium">
                    {previewFile.file.type}
                  </span>
                </div>
                
                <div className="flex-1 overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center relative shadow-inner">
                  {previewFile.file.type.startsWith('image/') ? (
                    <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                      <img
                        src={previewFile.previewUrl}
                        alt={previewFile.file.name}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain rounded shadow-lg"
                      />
                    </div>
                  ) : previewFile.file.type === 'application/pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-100 rounded-xl text-center overflow-y-auto">
                      <div className="bg-indigo-500/10 p-4 rounded-full text-indigo-400 mb-4 animate-pulse">
                        <FileText size={48} />
                      </div>
                      <h4 className="text-base font-semibold text-white">Visualización Externa del PDF</h4>
                      <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
                        Por seguridad, Microsoft Edge y Chrome bloquean la visualización incrustada de PDFs locales dentro de marcos (iframes) del sistema.
                      </p>
                      
                      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-sm justify-center">
                        <a
                          href={previewFile.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-3 rounded-xl shadow-lg transition-all"
                        >
                          <ExternalLink size={14} />
                          Abrir PDF en Nueva Pestaña
                        </a>
                        <a
                          href={previewFile.previewUrl}
                          download={previewFile.file.name}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-4 py-3 rounded-xl transition-all"
                        >
                          <Download size={14} />
                          Descargar PDF
                        </a>
                      </div>

                      <div className="mt-6 border-t border-slate-800/60 pt-4 w-full max-w-sm text-left">
                        <p className="text-[11px] text-slate-500 leading-normal">
                          💡 **Consejo de Productividad:** Abre el PDF en una nueva pestaña y arrástrala al lado derecho o izquierdo de tu pantalla para comparar el documento original con los datos extraídos en tiempo real.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 text-slate-400">
                      <FileText size={48} className="mx-auto mb-3 text-slate-500" />
                      <p className="font-semibold text-slate-300">Formato no previsualizable directamente</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Puedes corregir los datos manualmente en el panel derecho.
                      </p>
                      <a
                        href={previewFile.previewUrl}
                        download={previewFile.file.name}
                        className="mt-4 inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      >
                        <Download size={12} />
                        Descargar Archivo
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Editing Form */}
              <div className="lg:col-span-5 h-full flex flex-col p-6 overflow-y-auto bg-white min-h-0">
                <div className="mb-6">
                  <h4 className="font-sans font-semibold text-slate-900 text-sm">Campos Extraídos por la IA</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Verifica y corrige cualquier campo que no haya sido extraído correctamente. Las modificaciones se aplican en tiempo real.
                  </p>
                </div>

                <div className="space-y-4 flex-1">
                  {previewFile.extractedData ? (
                    <>
                      {/* Entidad (Suplidor o Cliente) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          {reportType === ReportType.REPORT_606 ? 'Nombre Suplidor / Razón Social' : 'Nombre Cliente'}
                        </label>
                        <input
                          type="text"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none uppercase"
                          value={previewFile.extractedData[reportType === ReportType.REPORT_606 ? 'nombreSuplidor' : 'nombreCliente'] || ''}
                          onChange={(e) => handleCellSave(
                            previewFile.id,
                            reportType === ReportType.REPORT_606 ? 'nombreSuplidor' : 'nombreCliente',
                            e.target.value
                          )}
                        />
                      </div>

                      {/* RNC y Tipo ID */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                            RNC o Cédula
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              className={`w-full text-sm font-mono border rounded-lg pl-3 pr-10 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 ${
                                !validateRncCedulaByTipo(previewFile.extractedData.rncCedula, previewFile.extractedData.tipoId).isValid && previewFile.extractedData.rncCedula
                                  ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500'
                                  : 'border-slate-200 focus:border-indigo-500'
                              }`}
                              value={previewFile.extractedData.rncCedula || ''}
                              onChange={(e) => handleCellSave(previewFile.id, 'rncCedula', e.target.value)}
                            />
                            {!validateRncCedulaByTipo(previewFile.extractedData.rncCedula, previewFile.extractedData.tipoId).isValid && previewFile.extractedData.rncCedula && (
                              <div className="absolute right-3 top-2.5 text-amber-500" title={validateRncCedulaByTipo(previewFile.extractedData.rncCedula, previewFile.extractedData.tipoId).message}>
                                <AlertTriangle size={18} />
                              </div>
                            )}
                          </div>
                          {!validateRncCedulaByTipo(previewFile.extractedData.rncCedula, previewFile.extractedData.tipoId).isValid && previewFile.extractedData.rncCedula && (
                            <p className="text-[11px] text-amber-600 mt-1 font-medium">
                              ⚠️ {validateRncCedulaByTipo(previewFile.extractedData.rncCedula, previewFile.extractedData.tipoId).message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Tipo Identificación
                          </label>
                          <select
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={previewFile.extractedData.tipoId || '1'}
                            onChange={(e) => handleCellSave(previewFile.id, 'tipoId', e.target.value)}
                          >
                            <option value="1">RNC (1)</option>
                            <option value="2">Cédula (2)</option>
                            <option value="3">Pasaporte (3)</option>
                          </select>
                        </div>
                      </div>

                      {/* NCF y NCF Modificado */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Comprobante (NCF)
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              className={`w-full text-sm font-mono border rounded-lg pl-3 pr-10 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 uppercase ${
                                !validateNcfWithMsg(previewFile.extractedData.ncf).isValid && previewFile.extractedData.ncf
                                  ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500'
                                  : 'border-slate-200 focus:border-indigo-500'
                              }`}
                              value={previewFile.extractedData.ncf || ''}
                              onChange={(e) => handleCellSave(previewFile.id, 'ncf', e.target.value)}
                            />
                            {!validateNcfWithMsg(previewFile.extractedData.ncf).isValid && previewFile.extractedData.ncf && (
                              <div className="absolute right-3 top-2.5 text-amber-500" title={validateNcfWithMsg(previewFile.extractedData.ncf).message}>
                                <AlertTriangle size={18} />
                              </div>
                            )}
                          </div>
                          {!validateNcfWithMsg(previewFile.extractedData.ncf).isValid && previewFile.extractedData.ncf && (
                            <p className="text-[11px] text-amber-600 mt-1 font-medium">
                              ⚠️ {validateNcfWithMsg(previewFile.extractedData.ncf).message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                            NCF Modificado
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              className={`w-full text-sm font-mono border rounded-lg pl-3 pr-10 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 uppercase ${
                                previewFile.extractedData.ncfModificado && !validateNcfWithMsg(previewFile.extractedData.ncfModificado).isValid
                                  ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500'
                                  : 'border-slate-200 focus:border-indigo-500'
                              }`}
                              value={previewFile.extractedData.ncfModificado || ''}
                              onChange={(e) => handleCellSave(previewFile.id, 'ncfModificado', e.target.value)}
                            />
                            {previewFile.extractedData.ncfModificado && !validateNcfWithMsg(previewFile.extractedData.ncfModificado).isValid && (
                              <div className="absolute right-3 top-2.5 text-amber-500" title={validateNcfWithMsg(previewFile.extractedData.ncfModificado).message}>
                                <AlertTriangle size={18} />
                              </div>
                            )}
                          </div>
                          {previewFile.extractedData.ncfModificado && !validateNcfWithMsg(previewFile.extractedData.ncfModificado).isValid && (
                            <p className="text-[11px] text-amber-600 mt-1 font-medium">
                              ⚠️ {validateNcfWithMsg(previewFile.extractedData.ncfModificado).message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Fechas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Fecha Comprobante
                          </label>
                          <input
                            type="text"
                            placeholder="AAAAMMDD"
                            className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={previewFile.extractedData.fechaComprobante || ''}
                            onChange={(e) => handleCellSave(previewFile.id, 'fechaComprobante', e.target.value)}
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Formato: AAAAMMDD</span>
                        </div>
                        {reportType === ReportType.REPORT_606 ? (
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Fecha de Pago
                            </label>
                            <input
                              type="text"
                              placeholder="AAAAMMDD"
                              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={previewFile.extractedData.fechaPago || ''}
                              onChange={(e) => handleCellSave(previewFile.id, 'fechaPago', e.target.value)}
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Formato: AAAAMMDD (Opcional)</span>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Fecha de Retención
                            </label>
                            <input
                              type="text"
                              placeholder="AAAAMMDD"
                              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={previewFile.extractedData.fechaRetencion || ''}
                              onChange={(e) => handleCellSave(previewFile.id, 'fechaRetencion', e.target.value)}
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Formato: AAAAMMDD (Opcional)</span>
                          </div>
                        )}
                      </div>

                      {/* Categoría DGII */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          {reportType === ReportType.REPORT_606 ? 'Categoría de Gasto (DGII)' : 'Tipo de Ingreso (DGII)'}
                        </label>
                        <select
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                          value={previewFile.extractedData[reportType === ReportType.REPORT_606 ? 'tipoGasto' : 'tipoIngreso'] || ''}
                          onChange={(e) => handleCellSave(
                            previewFile.id,
                            reportType === ReportType.REPORT_606 ? 'tipoGasto' : 'tipoIngreso',
                            e.target.value
                          )}
                        >
                          <option value="">Selecciona una opción...</option>
                          {Object.entries(reportType === ReportType.REPORT_606 ? GASTO_LABELS : INGRESO_LABELS).map(([code, label]) => (
                            <option key={code} value={code}>{code} - {label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Tipo de Compra (Only for 606) */}
                      {reportType === ReportType.REPORT_606 && (
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Clasificación de Compra
                          </label>
                          {(() => {
                            const tg = previewFile.extractedData.tipoGasto || '02';
                            const detectedType = previewFile.extractedData.tipoBienServicio || (['09', '10'].includes(tg) ? 'bien' : 'servicio');
                            return (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTipoCompraChange(previewFile.id, 'servicio')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                                    detectedType === 'servicio'
                                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-500'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <Briefcase size={14} />
                                  Servicio
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTipoCompraChange(previewFile.id, 'bien')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                                    detectedType === 'bien'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-500'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <Package size={14} />
                                  Bien
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Secciones de Montos */}
                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        <h5 className="font-semibold text-xs uppercase tracking-wider text-slate-400">Montos Facturados</h5>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                              ITBIS Facturado
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-semibold">RD$</span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={previewFile.extractedData.itbisFacturado ?? 0}
                                onChange={(e) => handleCellSave(previewFile.id, 'itbisFacturado', e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Propina Legal
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-semibold">RD$</span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={previewFile.extractedData.montoPropinaLegal ?? 0}
                                onChange={(e) => handleCellSave(previewFile.id, 'montoPropinaLegal', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Otros Impuestos
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-semibold">RD$</span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={previewFile.extractedData.otrosImpuestos ?? 0}
                                onChange={(e) => handleCellSave(previewFile.id, 'otrosImpuestos', e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Monto Total Facturado
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-indigo-400 text-xs font-bold">RD$</span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full text-xs font-bold border border-indigo-200 rounded-lg pl-9 pr-2 py-1.5 text-indigo-900 bg-indigo-50/20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={previewFile.extractedData[reportType === ReportType.REPORT_606 ? 'totalFacturado' : 'montoFacturado'] ?? 0}
                                onChange={(e) => handleCellSave(
                                  previewFile.id,
                                  reportType === ReportType.REPORT_606 ? 'totalFacturado' : 'montoFacturado',
                                  e.target.value
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Subtotal preview details */}
                        {reportType === ReportType.REPORT_606 && (
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-[11px] text-slate-500 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Monto total:</span>
                              <span className="font-medium text-slate-700">RD$ {(Number(previewFile.extractedData.totalFacturado) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200/40 pb-0.5">
                              <span>Menos Impuestos y Propinas:</span>
                              <span className="text-red-500">
                                - RD$ {(
                                  (Number(previewFile.extractedData.itbisFacturado) || 0) +
                                  (Number(previewFile.extractedData.otrosImpuestos) || 0) +
                                  (Number(previewFile.extractedData.montoPropinaLegal) || 0)
                                ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between font-semibold pt-0.5 text-slate-700">
                              <span>Subtotal calculado:</span>
                              <span className="text-indigo-600 font-bold">
                                RD$ {Math.max(0, 
                                  (Number(previewFile.extractedData.totalFacturado) || 0) -
                                  (Number(previewFile.extractedData.itbisFacturado) || 0) -
                                  (Number(previewFile.extractedData.otrosImpuestos) || 0) -
                                  (Number(previewFile.extractedData.montoPropinaLegal) || 0)
                                ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8 text-slate-400">
                      Hubo un error al procesar este archivo, o no hay datos extraídos para mostrar.
                    </div>
                  )}
                </div>

                {/* Modal Footer actions */}
                <div className="border-t border-slate-100 pt-4 mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setPreviewFileId(null)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
                  >
                    Confirmar y Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
