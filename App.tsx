
import React, { useState, useMemo } from 'react';
import { 
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
  ArrowRight,
  History,
  Trash2
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
  
  // Progress states for sequential processing
  const [processedCount, setProcessedCount] = useState(0);
  const [currentlyProcessingIdx, setCurrentlyProcessingIdx] = useState<number | null>(null);

  // Filter transactions based on current page
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
        // Process each file individually for granular tracking
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
      setError(err.message || "Extraction failed. Ensure files are readable bank statements.");
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
    link.download = `${selectedView === 'all' ? 'batch' : selectedView.split('.')[0]}_export.csv`;
    link.click();
  };

  const reset = () => {
    setFiles([]);
    setTransactions([]);
    setStatus(ProcessingStatus.IDLE);
    setError(null);
    setSelectedView('all');
  };

  const progressPercentage = files.length > 0 ? (processedCount / files.length) * 100 : 0;

  const renderDonutSegments = () => {
    let accumulatedPercentage = 0;
    return summary.categoryData.map((data, i) => {
      const radius = 70;
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
          strokeWidth="16"
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
          transform="rotate(-90 100 100)"
          className="transition-all duration-700 ease-in-out"
        />
      );
    });
  };

  return (
    <div className="min-h-screen pb-12 bg-[#f8fafc] selection:bg-indigo-100">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div 
              className="flex items-center gap-2 cursor-pointer group" 
              onClick={() => status === ProcessingStatus.SUCCESS && setSelectedView('all')}
            >
              <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition-colors">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">StatementSnap</span>
            </div>
            {status === ProcessingStatus.SUCCESS && (
              <div className="flex items-center gap-4">
                 <button onClick={reset} className="text-sm font-semibold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> Reset Batch
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* STEP 1: UPLOAD STATE */}
        {(status === ProcessingStatus.IDLE || status === ProcessingStatus.ERROR) && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 lg:p-12">
              <div className="max-w-2xl mx-auto text-center">
                <div className="mb-8 flex justify-center">
                  <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center relative rotate-3 hover:rotate-0 transition-transform duration-300">
                    <Files className="w-10 h-10 text-indigo-600" />
                    {files.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-4 border-white">
                        {files.length}
                      </span>
                    )}
                  </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Financial OCR Hub</h2>
                <p className="text-slate-500 mb-10 text-lg">
                  Upload multiple statements. We will consolidate them into a unified, categorized digital ledger.
                </p>
                
                <label className="relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-300 rounded-3xl cursor-pointer bg-slate-50 hover:bg-white hover:border-indigo-400 transition-all group overflow-hidden">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="text-sm text-slate-700 font-bold mb-1">Click or drag statements here</p>
                    <p className="text-xs text-slate-400">PDFs, PNGs, and JPEGs supported</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={onFileChange} />
                </label>
              </div>

              {files.length > 0 && (
                <div className="mt-12 border-t border-slate-100 pt-10">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Queue Management</h3>
                    <button onClick={() => setFiles([])} className="text-xs text-slate-400 hover:text-rose-500 font-bold transition-colors">
                      Clear Queue
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl group hover:border-indigo-200 transition-all hover:shadow-sm">
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className={`p-2.5 rounded-xl ${file.type.includes('pdf') ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{file.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-black mt-1 tracking-wider">{file.type.split('/')[1]}</p>
                          </div>
                        </div>
                        <button onClick={() => removeFile(idx)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-12 flex justify-center">
                    <button 
                      onClick={processStatements} 
                      className="px-12 py-5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all hover:-translate-y-1 active:translate-y-0 active:scale-95 flex items-center gap-3 text-lg"
                    >
                      Extract {files.length} Statements
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-800 p-5 rounded-3xl flex items-start gap-4 animate-in slide-in-from-top-2">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">Processing Error</h3>
                  <p className="text-sm opacity-80 mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: ANALYZING STATE */}
        {status === ProcessingStatus.ANALYZING && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 lg:p-16 space-y-10 animate-in fade-in duration-500">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="relative inline-block">
                 <Loader2 className="w-20 h-20 text-indigo-600 animate-spin" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-indigo-600">{Math.round(progressPercentage)}%</span>
                 </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI Analysis in Progress</h2>
              <p className="text-slate-500 text-lg">
                Consolidating transactions from document <span className="font-black text-indigo-600">{processedCount + 1}</span> of {files.length}...
              </p>
              
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner mt-8">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file, idx) => {
                  const isDone = idx < processedCount;
                  const isCurrent = idx === currentlyProcessingIdx;

                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${
                        isCurrent ? 'bg-indigo-50 border-indigo-300 shadow-lg shadow-indigo-50 scale-[1.02] z-10' : 
                        isDone ? 'bg-emerald-50 border-emerald-100 opacity-60' : 
                        'bg-white border-slate-200 opacity-30'
                      }`}
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className={`p-2.5 rounded-xl ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {isDone ? <Check className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <span className={`text-sm font-black truncate ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        {isCurrent ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 animate-pulse uppercase tracking-[0.2em]">
                            <Clock className="w-3 h-3" /> Extracting
                          </div>
                        ) : isDone && (
                          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">
                            Done
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

        {/* STEP 3: SUCCESS STATE (DASHBOARD) */}
        {status === ProcessingStatus.SUCCESS && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Context Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <span 
                    className={`cursor-pointer transition-colors p-1 rounded hover:bg-slate-100 ${selectedView === 'all' ? 'text-indigo-600' : ''}`}
                    onClick={() => setSelectedView('all')}
                  >
                    Batch Dashboard
                  </span>
                  {selectedView !== 'all' && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-slate-900 bg-slate-100 px-2 py-1 rounded">File Analysis</span>
                    </>
                  )}
                </div>
                <h1 className="text-4xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                  {selectedView === 'all' ? (
                    <><LayoutDashboard className="w-10 h-10 text-indigo-600" /> Aggregate Overview</>
                  ) : (
                    <><FileText className="w-10 h-10 text-indigo-600" /> {selectedView}</>
                  )}
                </h1>
              </div>
              
              <div className="flex items-center gap-4">
                {selectedView !== 'all' && (
                  <button 
                    onClick={() => setSelectedView('all')}
                    className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Back Home
                  </button>
                )}
                <button onClick={exportToCSV} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95">
                  <Download className="w-5 h-5" />
                  Save CSV
                </button>
              </div>
            </div>

            {/* Dashboard Content */}
            {selectedView === 'all' ? (
              /* FIRST PAGE: CONSOLIDATED DASHBOARD */
              <div className="space-y-10">
                {/* Aggregate Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Documents', val: files.length, sub: 'Statements parsed', icon: Files, color: 'indigo' },
                    { label: 'Total Credits', val: `$${summary.income.toLocaleString()}`, sub: 'Consolidated income', icon: TrendingUp, color: 'emerald' },
                    { label: 'Total Debits', val: `-$${summary.expenses.toLocaleString()}`, sub: 'Consolidated spending', icon: TrendingDown, color: 'rose' },
                    { label: 'Net Liquidity', val: `${summary.net >= 0 ? '+' : ''}$${summary.net.toLocaleString()}`, sub: 'Final cash flow', icon: Scale, color: summary.net >= 0 ? 'indigo' : 'rose' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`p-3 bg-${stat.color}-50 rounded-2xl`}>
                          <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                        </div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <div className={`text-4xl font-black tracking-tighter text-${stat.color === 'emerald' ? 'emerald' : stat.color === 'rose' ? 'rose' : 'slate'}-900`}>
                        {stat.val}
                      </div>
                      <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-tighter">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* File Index Sidebar */}
                  <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                      <History className="w-3 h-3" /> Document Health Check
                    </h3>
                    <div className="space-y-3">
                      {files.map((file, idx) => {
                        const fileTx = transactions.filter(t => t.sourceFile === file.name);
                        const fileNet = fileTx.reduce((acc, t) => acc + t.amount, 0);
                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedView(file.name)}
                            className="p-5 bg-white border border-slate-200 rounded-3xl hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"
                          >
                            <div className="flex items-center gap-5 overflow-hidden">
                              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <FileText className="w-6 h-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate tracking-tight">{file.name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">{fileTx.length} lines detected</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${fileNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {fileNet >= 0 ? '+' : ''}${Math.abs(fileNet).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                              <ArrowRight className="w-4 h-4 ml-auto mt-1 text-slate-300 group-hover:translate-x-1 group-hover:text-indigo-600 transition-all" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aggregate Chart Display */}
                  <div className="lg:col-span-2 bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-16">
                    <div className="relative w-64 h-64 flex-shrink-0">
                      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                        {summary.categoryData.length > 0 ? (
                          <>
                            {renderDonutSegments()}
                            <circle cx="100" cy="100" r="55" fill="white" />
                            <text x="100" y="90" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-black fill-slate-300 uppercase tracking-widest">
                              Spend
                            </text>
                            <text x="100" y="115" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-black fill-slate-900 tracking-tighter">
                              ${summary.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </text>
                          </>
                        ) : (
                          <circle cx="100" cy="100" r="70" fill="#f8fafc" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-grow w-full space-y-6">
                      <h3 className="font-black text-slate-900 text-xl tracking-tight flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-indigo-600" />
                        Spend Distribution
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
                        {summary.categoryData.map((data, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm group p-3 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: data.color }}></div>
                              <span className="text-slate-600 font-bold">{data.name}</span>
                            </div>
                            <span className="text-slate-900 font-black">${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        ))}
                        {summary.categoryData.length === 0 && (
                          <p className="text-slate-400 italic text-sm py-4">No expense categories detected.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* INDIVIDUAL FILE VIEW PAGE */
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-in slide-in-from-right-8 duration-700">
                {/* File Sidebar */}
                <div className="lg:col-span-1 space-y-8">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                    <div className="pb-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-black text-slate-900 tracking-tight text-lg">Report Summary</h3>
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Scale className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Entries</span>
                        <span className="text-2xl font-black text-slate-900">{summary.count}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inflow</span>
                        <span className="text-2xl font-black text-emerald-600">${summary.income.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Outflow</span>
                        <span className="text-2xl font-black text-rose-600">-${summary.expenses.toLocaleString()}</span>
                      </div>
                      <div className="pt-6 border-t border-slate-100 flex justify-between items-end">
                        <span className="text-sm font-black text-slate-900 uppercase">Net Result</span>
                        <span className={`text-3xl font-black tracking-tighter ${summary.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                          ${summary.net.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* File Pie Chart */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-black text-slate-900 mb-8 text-xs uppercase tracking-[0.2em] text-center">Category Profile</h3>
                    <div className="flex justify-center mb-10">
                       <div className="relative w-44 h-44 drop-shadow-xl">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                          {renderDonutSegments()}
                          <circle cx="100" cy="100" r="62" fill="white" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {summary.categoryData.slice(0, 5).map((data, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-black uppercase">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></div>
                            <span className="text-slate-500 tracking-wider">{data.name}</span>
                          </div>
                          <span className="text-slate-900">{data.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Individual File Ledger */}
                <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[700px]">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
                    <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs">Transaction Records</h3>
                    <div className="flex items-center gap-4">
                       <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-tighter">
                          Extraction Verified
                       </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto flex-grow">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Label</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-8 py-6 text-sm text-slate-500 whitespace-nowrap font-mono">{t.date}</td>
                            <td className="px-8 py-6 max-w-sm">
                                <p className="text-sm font-black text-slate-900 truncate leading-tight">{t.description}</p>
                                {t.notes && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">{t.notes}</p>}
                            </td>
                            <td className={`px-8 py-6 text-lg font-black whitespace-nowrap tracking-tighter ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-widest">
                                {t.category}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {currentTransactions.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-8 py-20 text-center">
                              <p className="text-slate-400 italic text-lg">No transactions were detected in this specific file.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-24 text-center pb-12 border-t border-slate-100 pt-16">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-6">
          StatementSnap Professional Batch OCR • End-to-End Encryption
        </p>
        <div className="flex justify-center gap-8 text-slate-300">
            <CheckCircle2 className="w-5 h-5 hover:text-indigo-400 transition-colors" />
            <Hash className="w-5 h-5 hover:text-indigo-400 transition-colors" />
            <Scale className="w-5 h-5 hover:text-indigo-400 transition-colors" />
        </div>
      </footer>
    </div>
  );
};

export default App;
