import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CheckCircle2, XCircle, Activity, FileJson, ChevronDown, ChevronRight, Upload, Clock, Info, X } from 'lucide-react';

// Basic Types
type TestStatus = 'pass' | 'error';
interface TestResult {
  name: string;
  status: TestStatus;
  logs: string[];
  durationStr: string;
  durationSecs: number;
}

const parseLogFile = (text: string): TestResult[] => {
  const lines = text.split('\n');
  const tests: TestResult[] = [];
  
  let currentTestName: string | null = null;
  let testLines: string[] = [];

  const finishCurrentTest = () => {
    if (!currentTestName) return;

    const hasError = testLines.some(l => 
      l.includes('[error]') || 
      l.includes('Exception') || 
      (l.includes('TRACEBACK:') && !l.includes('TRACEBACK: None')) || 
      l.includes('Erro -') ||
      l.includes('Erro(') ||
      l.includes('Erro (')
    );

    let durationStr = '-';
    let durationSecs = 0;
    // Try to calculate duration from timestamps at the start of lines
    // Example: 2026-03-16T19:57:55.7831895Z
    if (testLines.length > 0) {
      const timeRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z)/;
      const startMatch = testLines[0].match(timeRegex);
      const endMatch = testLines[testLines.length - 1].match(timeRegex);
      
      if (startMatch && endMatch) {
        const start = new Date(startMatch[1]).getTime();
        const end = new Date(endMatch[1]).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          durationSecs = Math.max(0, Math.floor((end - start) / 1000));
          const mins = Math.floor(durationSecs / 60);
          const secs = durationSecs % 60;
          durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        }
      }
    }

    tests.push({
      name: currentTestName,
      status: hasError ? 'error' : 'pass',
      logs: [...testLines],
      durationStr,
      durationSecs
    });
    
    currentTestName = null;
    testLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('Logs do Sikulix - Teste:')) {
      finishCurrentTest();
      const match = trimmed.match(/"([^"]+)"/);
      if (match) {
        currentTestName = match[1];
      }
    } else if (currentTestName !== null) {
      testLines.push(line); // preserve original formatting including timestamp
    }
  }
  
  finishCurrentTest();
  return tests;
};

const APP_VERSION = "v1.1.1";
const CHANGELOG = [
  {
    version: 'v1.1.1',
    date: '18/03/2026',
    changes: [
      'Adicionado Scroll Automático (Auto-scroll) para que ao abrir um log detalhado a visão já inicie no fim do log (onde geralmente ficam os erros)'
    ]
  },
  {
    version: 'v1.1.0',
    date: '18/03/2026',
    changes: [
      'Salvar automaticamente o log no navegador (localStorage) para não perder ao atualizar a página',
      'Adicionado botão de Changelog com histórico de versões do projeto',
      'Correção na identificação de falhas: o sistema agora reconhece variações de erro ("Erro(" e "Erro (")'
    ]
  },
  {
    version: 'v1.0.0',
    date: '17/03/2026',
    changes: [
      'Versão Inicial do Dashboard de conversão em React',
      'Leitura de arquivos de log brutais do SikuliX (tasklog.log)',
      'Dashboard visual com gráficos de pizza e Resumo de Execução',
      'Painel de detalhamento expansível com log de erro destacado e duração'
    ]
  }
];

const App: React.FC = () => {
  const [data, setData] = useState<TestResult[]>(() => {
    const saved = localStorage.getItem('tfa_dashboard_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Falha ao ler cache", e);
      }
    }
    return [];
  });
  const [showChangelog, setShowChangelog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pass' | 'error'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll para o final do log quando expandir uma linha
  useEffect(() => {
    if (expandedRow) {
      setTimeout(() => {
        const openLogContainer = document.querySelector('.log-row .log-content');
        if (openLogContainer) {
          openLogContainer.scrollTop = openLogContainer.scrollHeight;
        }
      }, 50);
    }
  }, [expandedRow]);

  useEffect(() => {
    if (data.length > 0) {
      try {
        localStorage.setItem('tfa_dashboard_data', JSON.stringify(data));
      } catch (e) {
        console.warn("Storage cheio ou erro ao salvar localmente: ", e);
      }
    } else {
      localStorage.removeItem('tfa_dashboard_data');
    }
  }, [data]);

  // Calculate stats
  const stats = useMemo(() => {
    const passed = data.filter(d => d.status === 'pass').length;
    const failed = data.filter(d => d.status === 'error').length;
    const total = data.length;
    
    // Calculate total duration
    const totalSecs = data.reduce((acc, curr) => acc + curr.durationSecs, 0);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    let timeStr = '';
    if (hours > 0) timeStr += `${hours}h `;
    if (mins > 0 || hours > 0) timeStr += `${mins}m `;
    timeStr += `${secs}s`;

    return { passed, failed, total, totalTime: timeStr };
  }, [data]);

  const pieData = [
    { name: 'Passed', value: stats.passed, color: '#10b981' }, // Emerald 500
    { name: 'Failed', value: stats.failed, color: '#ef4444' }  // Red 500
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '10px 15px',
          borderRadius: '8px',
          color: '#f8fafc',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
        }}>
          <p style={{ fontWeight: 600, margin: 0 }}>{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsedData = parseLogFile(text);
      
      if (parsedData.length === 0) {
        alert("O arquivo não contém os marcadores esperados ('Logs do Sikulix - Teste:'). Verifique se é o arquivo de log correto.");
      }
      
      setData(parsedData);
      setFilter('all');
      setExpandedRow(null);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = ''; // Reset input to allow re-uploading the same file
  };

  const filteredData = useMemo(() => {
    if (filter === 'all') return data;
    return data.filter(item => item.status === filter);
  }, [data, filter]);

  const changelogModal = showChangelog && (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '650px', maxHeight: '80vh', overflowY: 'auto',
        position: 'relative', padding: '2.5rem', border: '1px solid var(--accent-purple)'
      }}>
        <button 
          onClick={() => setShowChangelog(false)}
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <X size={24} />
        </button>
        
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontSize: '1.75rem' }}>
          <Info size={28} color="var(--accent-purple)" /> 
          Changelog do Projeto
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {CHANGELOG.map((release, i) => (
            <div key={i} style={{ borderBottom: i < CHANGELOG.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingBottom: i < CHANGELOG.length - 1 ? '2rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--accent-purple)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {release.version}
                </div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={14} /> {release.date}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {release.changes.map((change, j) => (
                  <li key={j} style={{ lineHeight: 1.6 }}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
           <button 
            className="filter-btn" 
            style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '0.75rem 2rem' }}
            onClick={() => setShowChangelog(false)}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  if (data.length === 0) {
    return (
      <div key="empty-state" className="dashboard-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <header className="header" style={{ marginBottom: '3rem', position: 'relative', width: '100%', maxWidth: '800px' }}>
          <div style={{ position: 'absolute', top: '-40px', right: '0' }}>
            <button 
              className="filter-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--accent-purple)', color: 'var(--text-primary)' }}
              onClick={() => setShowChangelog(true)}
            >
              <Info size={16} color="var(--accent-purple)" /> Changelog ({APP_VERSION})
            </button>
          </div>
          <h1>Dashboard de Testes TFA</h1>
          <p>Faça o upload do seu arquivo de log para iniciar a análise.</p>
        </header>

        <div 
          className="glass-panel" 
          style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', borderStyle: 'dashed', borderWidth: '2px', cursor: 'pointer' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".log,.txt" 
            style={{ display: 'none' }} 
          />
          <Upload size={64} color="var(--accent-blue)" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Selecionar arquivo de Log</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Clique ou arraste um arquivo tasklog.log aqui para gerar o dashboard automaticamente.
          </p>
        </div>
        {changelogModal}
      </div>
    );
  }

  return (
    <div key="dashboard-state" className="dashboard-container">
      <header className="header" style={{ position: 'relative' }}>
        <h1>Teste de Automação TFA</h1>
        <p>Dashboard Analítico de Execução dos Testes</p>
        
        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '1rem' }}>
          <button 
            className="filter-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid var(--accent-purple)', color: 'var(--text-primary)' }}
            onClick={() => setShowChangelog(true)}
          >
            <Info size={16} color="var(--accent-purple)" /> Changelog ({APP_VERSION})
          </button>
          <button 
            className="filter-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-blue)', color: 'white', border: 'none' }}
            onClick={() => fileInputRef.current?.click()}
          >
             <Upload size={16} /> Novo Log
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".log,.txt" 
          style={{ display: 'none' }} 
        />
      </header>

      <div className="top-section">
        {/* KPI Card */}
        <div className="glass-panel stats-card" style={{ position: 'relative' }}>
          <Activity size={48} color="var(--accent-blue)" style={{ marginBottom: '1rem', opacity: 0.8 }} />
          <h2>Resumo de Execução</h2>
          <div className="stat-group">
            <div className="stat-item">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-value success">{stats.passed}</span>
              <span className="stat-label">Sucesso</span>
            </div>
            <div className="stat-item">
              <span className="stat-value error">{stats.failed}</span>
              <span className="stat-label">Falha</span>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={14} /> Tempo Total de Execução: <strong>{stats.totalTime}</strong>
          </div>
        </div>

        {/* Chart Card */}
        <div className="glass-panel">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Proporção de Resultados</h2>
          <div className="chart-container" style={{ minHeight: 300, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1500}
                  animationEasing="ease-out"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-panel table-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileJson size={24} color="var(--accent-purple)" />
            Detalhamento da Planilha
          </h2>
          
          <div className="filter-container" style={{ marginBottom: 0 }}>
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Todos ({stats.total})
            </button>
            <button 
              className={`filter-btn ${filter === 'pass' ? 'active' : ''}`}
              onClick={() => setFilter('pass')}
            >
              Sucesso ({stats.passed})
            </button>
            <button 
              className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
              onClick={() => setFilter('error')}
            >
              Erro ({stats.failed})
            </button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Nome do Teste</th>
              <th style={{ width: '120px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Clock size={16} /> Duração
                </div>
              </th>
              <th style={{ width: '150px', textAlign: 'center' }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <React.Fragment key={item.name}>
                <tr 
                  className={`test-row ${expandedRow === item.name ? 'expanded' : ''}`}
                  onClick={() => setExpandedRow(expandedRow === item.name ? null : item.name)}
                  style={{ animation: `fadeInUp 0.3s ease-out ${Math.min(index * 0.02, 0.5)}s both` }}
                >
                  <td>
                    <div className="test-name">
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        {expandedRow === item.name ? (
                          <ChevronDown size={18} color="var(--text-secondary)" />
                        ) : (
                          <ChevronRight size={18} color="var(--text-secondary)" />
                        )}
                      </span>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                    {item.durationStr}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.status === 'pass' ? (
                      <span className="status-badge pass">
                        <CheckCircle2 size={16} /> Passou
                      </span>
                    ) : (
                      <span className="status-badge error">
                        <XCircle size={16} /> Erro
                      </span>
                    )}
                  </td>
                </tr>
                
                {/* Expandable Content for Logs */}
                {expandedRow === item.name && (
                  <tr className="log-row">
                    <td colSpan={3} style={{ padding: 0 }}>
                      <div className="log-container">
                        <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Fluxo Completo de Execução</span>
                          <span>{item.logs.length} linhas analisadas</span>
                        </div>
                        <pre className="log-content">
                          {item.logs && item.logs.length > 0 
                            ? item.logs.map((logLine, lineIdx) => (
                                <div key={lineIdx} className={logLine.includes('[error]') || logLine.includes('TRACEBACK:') || logLine.includes('Erro -') || logLine.includes('Erro(') || logLine.includes('Erro (') ? 'log-line-error' : 'log-line'}>
                                  {logLine}
                                </div>
                              ))
                            : <div>Nenhum log detalhado encontrado.</div>
                          }
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {changelogModal}
    </div>
  );
};

export default App;
