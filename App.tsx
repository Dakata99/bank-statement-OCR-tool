
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
  ChevronRight
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
    
    // Group by category for chart
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
        
        // Add source file tag to each transaction
        const taggedResults = result.map(t => ({ ...t, sourceFile: files[i].name }));
        
        allExtractedTransactions.push(...taggedResults);
        setProcessedCount(i + 1);
      }
      
      setTransactions(allExtractedTransactions);
      setStatus(ProcessingStatus.SUCCESS);
      setCurrentlyProcessingIdx(null);
      setSelectedView('all'); // Default to overview after success
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
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">StatementSnap</span>
            </div>
            {status === ProcessingStatus.SUCCESS && (
              <button onClick={reset} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors px-4 py-2 hover:bg-indigo-50 rounded-lg">
                Start New Batch
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
            {/* View Switcher / Tabs */}
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
              <button
                onClick={() => setSelectedView('all')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-semibold border-2 ${
                  selectedView === 'all' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Aggregate Overview
              </button>
              <div className="h-8 w-px bg-slate-200 self-center mx-2 hidden sm:block"></div>
              {files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedView(file.name)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-semibold border-2 ${
                    selectedView === file.name 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  {file.name}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  {selectedView === 'all' ? (
                    <><CheckCircle2 className="w-7 h-7 text-emerald-500" /> Batch Summary</>
                  ) : (
                    <><FileText className="w-7 h-7 text-indigo-500" /> {selectedView}</>
                  )}
                </h1>
                <p className="text-slate-500">
                  {selectedView === 'all' 
                    ? `Showing data from ${files.length} consolidated documents.` 
                    : `Showing individual results for the selected file.`}
                </p>
              </div>
              <button onClick={exportToCSV} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                <Download className="w-4 h-4" />
                Export {selectedView === 'all' ? 'Batch' : 'File'} CSV
              </button>
            </div>

            {/* Dashboard Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg"><Hash className="w-5 h-5 text-indigo-600" /></div>
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Entries</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{summary.count}</div>
                <p className="text-xs text-slate-400 mt-1">Transaction count</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Income</span>
                </div>
                <div className="text-3xl font-bold text-emerald-600">${summary.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-400 mt-1">Total credit volume</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-rose-50 rounded-lg"><TrendingDown className="w-5 h-5 text-rose-600" /></div>
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Expenses</span>
                </div>
                <div className="text-3xl font-bold text-rose-600">-${summary.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-400 mt-1">Total debit volume</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-100 rounded-lg"><Scale className="w-5 h-5 text-slate-600" /></div>
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Net Change</span>
                </div>
                <div className={`text-3xl font-bold ${summary.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                  {summary.net >= 0 ? '+' : ''}${summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-400 mt-1">Statement net impact</p>
              </div>
            </div>

            {/* Visuals & Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Breakdown Chart */}
              <div className="lg:col-span-1 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-8">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-indigo-600" />
                    Category Breakdown
                  </h3>
                </div>
                
                <div className="relative w-48 h-48 mb-8">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {summary.categoryData.length > 0 ? (
                      <>
                        {renderDonutSegments()}
                        <circle cx="100" cy="100" r="55" fill="white" />
                        <text x="100" y="95" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-slate-400 uppercase tracking-widest">
                          Spent
                        </text>
                        <text x="100" y="115" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-slate-800">
                          ${summary.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </text>
                      </>
                    ) : (
                      <circle cx="100" cy="100" r="70" fill="#f1f5f9" />
                    )}
                  </svg>
                </div>

                <div className="w-full space-y-3 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
                  {summary.categoryData.map((data, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
                        <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{data.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs">{data.percentage.toFixed(1)}%</span>
                        <span className="text-slate-900 font-bold">${data.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  ))}
                  {summary.categoryData.length === 0 && (
                    <p className="text-center text-slate-400 italic text-sm py-4">No expense categories detected.</p>
                  )}
                </div>
              </div>

              {/* Transaction Ledger Table */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                  <h3 className="font-semibold text-slate-800">
                    {selectedView === 'all' ? 'Consolidated Ledger' : `Ledger for ${selectedView}`}
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-tighter">
                    {currentTransactions.length} Entries
                  </span>
                </div>
                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Description</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Category</th>
                        {selectedView === 'all' && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Source</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap font-mono">{t.date}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900 max-w-[200px] truncate">{t.description}</td>
                          <td className={`px-6 py-4 text-sm font-bold whitespace-nowrap ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-tighter">
                              {t.category}
                            </span>
                          </td>
                          {selectedView === 'all' && (
                            <td className="px-6 py-4">
                              <span className="text-[10px] text-slate-400 truncate max-w-[100px] inline-block font-medium italic">
                                {t.sourceFile}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                      {currentTransactions.length === 0 && (
                        <tr>
                          <td colSpan={selectedView === 'all' ? 5 : 4} className="px-6 py-12 text-center text-slate-400 italic">
                            No transactions found for this selection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 text-center pb-8">
        <div className="flex justify-center gap-4 mb-2">
          <div className="h-1 w-12 bg-slate-200 rounded-full"></div>
        </div>
        <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">
          StatementSnap Professional Batch OCR • Secure In-Browser Processing
        </p>
      </footer>
    </div>
  );
};

export default App;
