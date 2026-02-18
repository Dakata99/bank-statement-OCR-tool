
import React, { useState, useMemo } from 'react';
import { 
  FileUp, 
  Trash2, 
  FileSpreadsheet, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Wallet,
  Plus,
  Download,
  TrendingUp,
  TrendingDown,
  Hash,
  Scale,
  X,
  Files,
  Clock,
  Check,
  PieChart as PieChartIcon,
  LayoutDashboard,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { Transaction, ProcessingStatus, FileData } from './types';
import { extractTransactions } from './services/geminiService';

const COLORS = [
  '#4f46e5', // Indigo
  '#f43f5e', // Rose
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
];

const App: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>('all');
  
  // Progress states
  const [processedCount, setProcessedCount] = useState(0);
  const [currentlyProcessingIdx, setCurrentlyProcessingIdx] = useState<number | null>(null);

  // Derived data based on selected view
  const currentTransactions = useMemo(() => {
    if (selectedView === 'all') return transactions;
    return transactions.filter(t => t.sourceFile === selectedView);
  }, [transactions, selectedView]);

  const summary = useMemo(() => {
    const income = currentTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expenses = currentTransactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0);
    
    const categoryMap: Record<string, number> = {};
    currentTransactions.forEach(t => {
      if (t.amount < 0) {
        const absAmount = Math.abs(t.amount);
        categoryMap[t.category] = (categoryMap[t.category] || 0) + absAmount;
      }
    });

    const totalExpenseAbs = Math.abs(expenses);
    const categoryData = Object.entries(categoryMap)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: totalExpenseAbs > 0 ? (value / totalExpenseAbs) * 100 : 0,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);

    return {
      count: currentTransactions.length,
      income,
      expenses: totalExpenseAbs,
      net: income + expenses,
      categoryData
    };
  }, [currentTransactions]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: Promise<FileData>[] = (Array.from(selectedFiles) as File[]).map((file: File) => {
      return new Promise<FileData>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            name: file.name,
            base64,
            type: file.type
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newFiles).then(results => {
      setFiles(prev => [...prev, ...results]);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    setError(null);
  };

  const processStatements = async () => {
    if (files.length === 0) return;
    
    setStatus(ProcessingStatus.ANALYZING);
    setError(null);
    setProcessedCount(0);
    setTransactions([]);
    
    const allExtractedTransactions: Transaction[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentlyProcessingIdx(i);
        const result = await extractTransactions([files[i]]);
        const taggedResults = result.map(t => ({ ...t, sourceFile: files[i].name }));
        allExtractedTransactions.push(...taggedResults);
        setProcessedCount(i + 1);
      }
      
      setTransactions(allExtractedTransactions);
      setStatus(ProcessingStatus.SUCCESS);
      setCurrentlyProcessingIdx(null);
      setSelectedView('all');
    } catch (err: any) {
      setError(err.message || "Failed to extract data. Please ensure the files are valid PDFs or images.");
      setStatus(ProcessingStatus.ERROR);
      setCurrentlyProcessingIdx(null);
    }
  };

  const exportToCSV = () => {
    if (currentTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Notes', 'Source'];
    const csvContent = [
      headers.join(','),
      ...currentTransactions.map(t => [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount,
        t.category,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
        `"${t.sourceFile}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedView === 'all' ? 'batch' : selectedView.split('.')[0]}_statement_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const reset = () => {
    setFiles([]);
    setTransactions([]);
    setStatus(ProcessingStatus.IDLE);
    setError(null);
    setProcessedCount(0);
    setCurrentlyProcessingIdx(null);
    setSelectedView('all');
  };

  const progressPercentage = files.length > 0 ? (processedCount / files.length) * 100 : 0;

  const renderDonutSegments = () => {
    let accumulatedPercentage = 0;
    return summary.categoryData.map((data, i) => {
      const radius = 70;
      const strokeWidth = 14;
      const circumference = 2 * Math.PI * radius;
      const offset = (accumulatedPercentage / 100) * circumference;
      const length = (data.percentage / 100) * circumference;
      accumulatedPercentage += data.percentage;

      return (
        <circle
          key={i}
          cx="100"
          cy="100"
          r={radius}
          fill="transparent"
          stroke={data.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
          transform="rotate(-90 100 100)"
          className="transition-all duration-1000 ease-out"
        />
      );
    });
  };

  return (
    <div className="min-h-screen pb-12 bg-[#f8fafc]">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => status === ProcessingStatus.SUCCESS && setSelectedView('all')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">StatementSnap</span>
            </div>
            {status === ProcessingStatus.SUCCESS && (
              <button onClick={reset} className="text-sm font-medium text-slate-400 hover:text-rose-600 transition-colors px-4 py-2 hover:bg-rose-50 rounded-lg">
                Discard & Reset
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {(status === ProcessingStatus.IDLE || status === ProcessingStatus.ERROR) && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="max-w-2xl mx-auto text-center">
                <div className="mb-6 flex justify-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center relative">
                    <Files className="w-8 h-8 text-indigo-600" />
                    {files.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                        {files.length}
                      </span>
                    )}
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Statement Batch Processor</h2>
                <p className="text-slate-500 mb-8">
                  Upload multiple PDFs or images. We will extract and consolidate all transactions into an organized report.
                </p>
                
                <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all group border-spacing-4">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Plus className="w-10 h-10 text-slate-400 group-hover:text-indigo-600 mb-3 transition-transform group-hover:scale-110" />
                    <p className="text-sm text-slate-600 font-medium">Drop statements here to start</p>
                    <p className="text-xs text-slate-400 mt-2">Supports multi-page PDF and JPG/PNG images</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={onFileChange} />
                </label>
              </div>

              {files.length > 0 && (
                <div className="mt-10 border-t border-slate-100 pt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Queue Management ({files.length})</h3>
                    <button onClick={clearFiles} className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`flex-shrink-0 p-2 rounded-lg ${file.type.includes('pdf') ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-slate-700 truncate leading-none mb-1">{file.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{file.type.split('/')[1]}</span>
                          </div>
                        </div>
                        <button onClick={() => removeFile(idx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-center">
                    <button onClick={processStatements} className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center gap-2">
                      Begin Extraction
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl flex items-start gap-3 animate-in fade-in duration-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Processing Error</h3>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {status === ProcessingStatus.ANALYZING && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 lg:p-12 space-y-8 animate-in fade-in duration-500">
            <div className="max-w-xl mx-auto text-center space-y-4">
              <div className="relative inline-block">
                 <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-indigo-600">{Math.round(progressPercentage)}%</span>
                 </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Processing Batch</h2>
              <p className="text-slate-500">
                Extracted <span className="font-bold text-slate-900">{processedCount}</span> of <span className="font-bold text-slate-900">{files.length}</span> documents
              </p>
              
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner mt-4">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Batch Progress Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map((file, idx) => {
                  const isDone = idx < processedCount;
                  const isCurrent = idx === currentlyProcessingIdx;

                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                        isCurrent ? 'bg-indigo-50 border-indigo-200 shadow-sm scale-[1.02]' : 
                        isDone ? 'bg-emerald-50 border-emerald-100 opacity-70' : 
                        'bg-white border-slate-200 opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-lg ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {isDone ? <Check className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                        </div>
                        <span className={`text-sm font-medium truncate ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isCurrent ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 animate-pulse uppercase tracking-wider">
                            <Clock className="w-3 h-3" /> Analyzing
                          </div>
                        ) : isDone ? (
                          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                            Ready
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Pending
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {status === ProcessingStatus.SUCCESS && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                  <span 
                    className={`cursor-pointer transition-colors ${selectedView === 'all' ? 'text-indigo-600' : 'hover:text-indigo-400'}`}
                    onClick={() => setSelectedView('all')}
                  >
                    Batch Dashboard
                  </span>
                  {selectedView !== 'all' && (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span className="text-slate-900">File Details</span>
                    </>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                  {selectedView === 'all' ? (
                    <><LayoutDashboard className="w-8 h-8 text-indigo-600" /> Aggregate Overview</>
                  ) : (
                    <><FileText className="w-8 h-8 text-indigo-600" /> {selectedView}</>
                  )}
                </h1>
              </div>
              
              <div className="flex items-center gap-3">
                {selectedView !== 'all' && (
                  <button 
                    onClick={() => setSelectedView('all')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Dashboard
                  </button>
                )}
                <button onClick={exportToCSV} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                  <Download className="w-4 h-4" />
                  Export {selectedView === 'all' ? 'Batch' : 'File'} (.csv)
                </button>
              </div>
            </div>

            {/* Main Content Layout */}
            {selectedView === 'all' ? (
              /* PAGE 1: AGGREGATE OVERVIEW */
              <div className="space-y-8">
                {/* Aggregate Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-indigo-200 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors"><Files className="w-5 h-5 text-indigo-600" /></div>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Documents</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900">{files.length}</div>
                    <p className="text-xs text-slate-400 mt-1">Processed in batch</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Income</span>
                    </div>
                    <div className="text-3xl font-black text-emerald-600">${summary.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-slate-400 mt-1">Sum of all document credits</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-rose-200 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-rose-50 rounded-lg group-hover:bg-rose-100 transition-colors"><TrendingDown className="w-5 h-5 text-rose-600" /></div>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Expenses</span>
                    </div>
                    <div className="text-3xl font-black text-rose-600">-${summary.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-slate-400 mt-1">Sum of all document debits</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors"><Scale className="w-5 h-5 text-slate-600" /></div>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Net Flow</span>
                    </div>
                    <div className={`text-3xl font-black ${summary.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {summary.net >= 0 ? '+' : ''}${summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Consolidated bottom line</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* File List / Navigation */}
                  <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Individual File Reports</h3>
                    <div className="space-y-2">
                      {files.map((file, idx) => {
                        const fileTx = transactions.filter(t => t.sourceFile === file.name);
                        const fileNet = fileTx.reduce((acc, t) => acc + t.amount, 0);
                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedView(file.name)}
                            className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4 overflow-hidden">
                              <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                                <p className="text-xs text-slate-400">{fileTx.length} transactions</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${fileNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {fileNet >= 0 ? '+' : ''}${Math.abs(fileNet).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                              <ArrowRight className="w-4 h-4 ml-auto mt-1 text-slate-300 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aggregate Chart */}
                  <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-12">
                    <div className="relative w-56 h-56 flex-shrink-0">
                      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl">
                        {summary.categoryData.length > 0 ? (
                          <>
                            {renderDonutSegments()}
                            <circle cx="100" cy="100" r="55" fill="white" />
                            <text x="100" y="90" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-slate-400 uppercase tracking-widest">
                              Spend
                            </text>
                            <text x="100" y="115" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-black fill-slate-800">
                              ${summary.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </text>
                          </>
                        ) : (
                          <circle cx="100" cy="100" r="70" fill="#f1f5f9" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-grow w-full space-y-4">
                      <h3 className="font-black text-slate-800 text-lg mb-6">Aggregate Categories</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {summary.categoryData.map((data, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: data.color }}></div>
                              <span className="text-slate-600 font-bold truncate max-w-[80px] sm:max-w-none">{data.name}</span>
                            </div>
                            <span className="text-slate-900 font-black">${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* SEPARATE PAGE: INDIVIDUAL FILE OVERVIEW */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4 duration-500">
                {/* File Statistics Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-black text-slate-900">File Metrics</h3>
                      <span className="text-[10px] font-black px-2 py-1 bg-indigo-50 text-indigo-600 rounded uppercase tracking-widest">Report</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-medium text-slate-400">Transaction Count</span>
                        <span className="text-xl font-black text-slate-900">{summary.count}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-medium text-slate-400">Total Credits</span>
                        <span className="text-xl font-black text-emerald-600">${summary.income.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-medium text-slate-400">Total Debits</span>
                        <span className="text-xl font-black text-rose-600">-${summary.expenses.toLocaleString()}</span>
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                        <span className="text-sm font-bold text-slate-900">Net Impact</span>
                        <span className={`text-2xl font-black ${summary.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                          ${summary.net.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* File Category Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-black text-slate-900 mb-6 text-sm uppercase tracking-widest">Spending Profile</h3>
                    <div className="flex justify-center mb-8">
                       <div className="relative w-40 h-40">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                          {renderDonutSegments()}
                          <circle cx="100" cy="100" r="60" fill="white" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {summary.categoryData.slice(0, 5).map((data, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-bold">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }}></div>
                            <span className="text-slate-500 uppercase">{data.name}</span>
                          </div>
                          <span className="text-slate-900">{data.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Transaction Ledger for File */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Transaction Ledger</h3>
                    <button onClick={exportToCSV} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
                      <Download className="w-3 h-3" /> Save this sheet
                    </button>
                  </div>
                  <div className="overflow-x-auto flex-grow">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap font-mono">{t.date}</td>
                            <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-900 truncate max-w-[250px]">{t.description}</p>
                                {t.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{t.notes}</p>}
                            </td>
                            <td className={`px-6 py-4 text-sm font-black whitespace-nowrap ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                                {t.category}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-20 text-center pb-8 border-t border-slate-100 pt-12">
        <p className="text-slate-400 text-[10px] uppercase tracking-[0.4em] font-black mb-4">
          StatementSnap Professional Batch OCR
        </p>
        <div className="flex justify-center gap-6 text-slate-300">
            <CheckCircle2 className="w-4 h-4" />
            <Hash className="w-4 h-4" />
            <Scale className="w-4 h-4" />
        </div>
      </footer>
    </div>
  );
};

export default App;
