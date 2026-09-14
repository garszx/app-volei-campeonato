"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../firebase';
import { ref, set } from 'firebase/database';
import styles from './setup.module.css';

interface TimeConfig { id: string; nome: string; escudoUrl: string; }
interface TimeDbSave extends TimeConfig { sets_vencidos: number; total_pontos: number; pontos_classificacao: number; }

export default function Setup() {
  const router = useRouter();
  const [linkGerado, setLinkGerado] = useState('');
  const [erroMsg, setErroMsg] = useState('');

  const [regras, setRegras] = useState({
    nomeCampeonato: 'Torneio de Vôlei',
    mostrarLogos: true,
    horarioInicio: '08:00',
    intervaloMinutos: 45,
    formatoGrupos: 'set_unico_25',
    formatoFinais: 'melhor_de_3_25',
    sistemaClassificacao: 'vitorias_simples',
    turno: 'unico',
    ptsVitoriaPerfeita: 3,
    ptsVitoriaTiebreak: 2,
    ptsDerrotaTiebreak: 1,
    senhaAdmin: '' // Variável adicionada aqui para o TypeScript reconhecer
  });

  const [times, setTimes] = useState<TimeConfig[]>([
    { id: 'time_1', nome: '', escudoUrl: '' }, 
    { id: 'time_2', nome: '', escudoUrl: '' },
    { id: 'time_3', nome: '', escudoUrl: '' }
  ]);

  const handleRegraChange = (campo: string, valor: string | number | boolean) => {
    setRegras(prev => ({ ...prev, [campo]: valor }));
    setErroMsg('');
  };

  const handleTimeChange = (index: number, campo: keyof TimeConfig, valor: string) => { 
    const novos = [...times]; 
    novos[index][campo] = valor; 
    setTimes(novos); 
    setErroMsg('');
  };
  
  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (file) { 
      const reader = new FileReader(); 
      reader.onloadend = () => handleTimeChange(index, 'escudoUrl', reader.result as string); 
      reader.readAsDataURL(file); 
    } 
  };
  
  const adicionarTime = () => { 
    if (times.length >= 12) { setErroMsg("O máximo recomendado é de 12 equipes."); return; } 
    setTimes([...times, { id: `time_${Date.now()}`, nome: '', escudoUrl: '' }]); 
  };
  
  const removerTime = (index: number) => { 
    if (times.length <= 3) { setErroMsg("É necessário no mínimo 3 equipes para um triangular."); return; } 
    setTimes(times.filter((_, i) => i !== index)); 
  };

  const salvarSetup = async () => {
    setErroMsg('');

    if (times.length < 3) { setErroMsg('É necessário cadastrar no mínimo 3 equipes.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (times.some(t => t.nome.trim() === '')) { setErroMsg('Todos os times precisam ter um NOME preenchido.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (regras.mostrarLogos && times.some(t => t.escudoUrl === '')) { setErroMsg('Você escolheu "Mostrar Logos", portanto TODOS os times precisam de uma imagem/brasão.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    const timesObj: Record<string, TimeDbSave> = {};
    times.forEach((t, i) => { 
      const idLimpo = `time_${i + 1}`; 
      timesObj[idLimpo] = { id: idLimpo, nome: t.nome, escudoUrl: t.escudoUrl, sets_vencidos: 0, total_pontos: 0, pontos_classificacao: 0 }; 
    });

    const slug = regras.nomeCampeonato.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const codigoAleatorio = Math.random().toString(36).substring(2, 7);
    const torneioId = `${slug}-${codigoAleatorio}`;

    const primeiraPalavra = regras.nomeCampeonato.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const senhaGerada = `${primeiraPalavra}${new Date().getFullYear()}`; 

    const regrasComSenha = { ...regras, senhaAdmin: senhaGerada };

    try {
      await set(ref(db, `torneios/${torneioId}`), { config: { status: 'aguardando_sorteio', regras: regrasComSenha }, times: timesObj });
      const urlCompleta = `${window.location.origin}/torneio/${torneioId}`;
      setLinkGerado(urlCompleta);
      setRegras(regrasComSenha);
    } catch { 
      setErroMsg('Ocorreu um erro ao conectar com o banco de dados. Tente novamente.'); 
    }
  };

  const copiarLink = () => { navigator.clipboard.writeText(linkGerado); alert('Link copiado!'); };
  const acessarTorneio = () => { const caminho = linkGerado.replace(window.location.origin, ''); router.push(caminho); };

  if (linkGerado) {
    return (
      <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className={styles.configPanel} style={{ textAlign: 'center', maxWidth: '600px', width: '100%', padding: '40px' }}>
          <h1 className={styles.title} style={{ fontSize: '32px', marginBottom: '10px' }}>Torneio Criado! 🎉</h1>
          <p style={{ color: '#94a3b8', fontSize: '18px', marginBottom: '20px' }}>Sua central exclusiva foi gerada. Guarde este link para compartilhar com os times e acessar a mesa.</p>
          <input type="text" readOnly value={linkGerado} className={styles.input} style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', fontSize: '16px', marginBottom: '20px' }} />
          
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Senha de acesso à Mesa Oficial:</p>
            {/* O "any" foi removido daqui pois o TypeScript agora reconhece a variável */}
            <p style={{ margin: '5px 0 0 0', color: '#10b981', fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px' }}>
              {regras.senhaAdmin}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexDirection: 'column' }}>
            <button onClick={copiarLink} className={styles.btnPrimary} style={{ backgroundColor: '#10b981' }}>📋 Copiar Link Oficial</button>
            <button onClick={acessarTorneio} className={styles.btnPrimary}>Acessar Central do Torneio 🚀</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Criar Novo Campeonato</h1>
      {erroMsg && (<div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>⚠️ {erroMsg}</div>)}
      <div className={styles.configPanel}>
        <h2 className={styles.configTitle}>Regras e Formato</h2>
        <div className={styles.configGrid}>
          <div className={styles.configItem} style={{ gridColumn: '1 / -1' }}><label>Nome do Campeonato</label><input type="text" className={styles.input} value={regras.nomeCampeonato} onChange={(e) => handleRegraChange('nomeCampeonato', e.target.value)} /></div>
          <div className={styles.configItem}><label>Sistema de Disputa</label><select className={styles.select} value={regras.sistemaClassificacao} onChange={(e) => handleRegraChange('sistemaClassificacao', e.target.value)}><option value="vitorias_simples">Pontos Corridos (Campeão pela Tabela)</option><option value="sistema_pontos">Fase de Grupos + Mata-Mata</option></select></div>
          <div className={styles.configItem}><label>Formato de Confrontos</label><select className={styles.select} value={regras.turno} onChange={(e) => handleRegraChange('turno', e.target.value)}><option value="unico">Turno Único (1 jogo contra cada)</option><option value="ida_volta">Ida e Volta (2 jogos contra cada)</option></select></div>
          <div className={styles.configItem}><label>Horário do 1º Jogo</label><input type="time" className={styles.input} value={regras.horarioInicio} onChange={(e) => handleRegraChange('horarioInicio', e.target.value)} /></div>
          <div className={styles.configItem}><label>Intervalo (Minutos)</label><input type="number" className={styles.input} value={regras.intervaloMinutos} onChange={(e) => handleRegraChange('intervaloMinutos', Number(e.target.value))} /></div>
          <div className={styles.configItem}><label>Fase de Grupos</label><select className={styles.select} value={regras.formatoGrupos} onChange={(e) => handleRegraChange('formatoGrupos', e.target.value)}><option value="set_unico_25">Set Único (até 25)</option><option value="set_unico_21">Set Único (até 21)</option><option value="melhor_de_3_25">Melhor de 3 (até 25)</option><option value="melhor_de_3_21">Melhor de 3 (até 21)</option></select></div>
          <div className={styles.configItem}><label>Finais e Semifinais</label><select className={styles.select} value={regras.formatoFinais} onChange={(e) => handleRegraChange('formatoFinais', e.target.value)}><option value="melhor_de_3_25">Melhor de 3 (até 25)</option><option value="melhor_de_3_21">Melhor de 3 (até 21)</option><option value="set_unico_25">Set Único (até 25)</option><option value="set_unico_21">Set Único (até 21)</option></select></div>
          <div className={styles.configItem}><label>Logos/Brasões</label><select className={styles.select} value={regras.mostrarLogos ? 'sim' : 'nao'} onChange={(e) => handleRegraChange('mostrarLogos', e.target.value === 'sim')}><option value="sim">Mostrar logos</option><option value="nao">Ocultar logos</option></select></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className={styles.title} style={{ margin: 0 }}>Equipes ({times.length})</h2>
        <button onClick={adicionarTime} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>+ Adicionar Equipe</button>
      </div>
      <div className={styles.grid}>
        {times.map((time, index) => (
          <div key={time.id} className={styles.card} style={{ position: 'relative' }}>
            {times.length > 3 && ( <button onClick={() => removerTime(index)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>)}
            <h3>Time {index + 1}</h3>
            <div className={styles.configItem}><label>Nome:</label><input type="text" className={styles.input} value={time.nome} onChange={(e) => handleTimeChange(index, 'nome', e.target.value)} placeholder="Nome da equipe" /></div>
            {regras.mostrarLogos && (<div className={styles.configItem}><label>Logo:</label><input type="file" accept="image/*" className={styles.input} onChange={(e) => handleImageUpload(index, e)} /></div>)}
          </div>
        ))}
      </div>
      <button onClick={salvarSetup} className={styles.btnPrimary} style={{ marginTop: '20px', padding: '20px', fontSize: '20px' }}>Criar Campeonato Exclusivo</button>
    </div>
  );
}