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
    ptsDerrotaTiebreak: 1
  });

  const [times, setTimes] = useState<TimeConfig[]>([
    { id: 'time_1', nome: '', escudoUrl: '' }, { id: 'time_2', nome: '', escudoUrl: '' },
    { id: 'time_3', nome: '', escudoUrl: '' }, { id: 'time_4', nome: '', escudoUrl: '' },
  ]);

  const handleRegraChange = (campo: string, valor: string | number | boolean) => setRegras(prev => ({ ...prev, [campo]: valor }));
  const handleTimeChange = (index: number, campo: keyof TimeConfig, valor: string) => { const novos = [...times]; novos[index][campo] = valor; setTimes(novos); };
  
  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (file) { const reader = new FileReader(); reader.onloadend = () => handleTimeChange(index, 'escudoUrl', reader.result as string); reader.readAsDataURL(file); } 
  };
  
  const adicionarTime = () => { if (times.length >= 12) { alert("Max 12 equipes."); return; } setTimes([...times, { id: `time_${times.length + 1}`, nome: '', escudoUrl: '' }]); };
  const removerTime = (index: number) => { if (times.length <= 3) { alert("Min 3 equipes."); return; } setTimes(times.filter((_, i) => i !== index)); };

  const salvarSetup = async () => {
    if (times.length < 3) { alert('Mínimo de 3 equipes.'); return; }
    if (regras.mostrarLogos && times.some(t => !t.nome || !t.escudoUrl)) { alert('Preencha nome e brasão das equipes!'); return; }
    if (!regras.mostrarLogos && times.some(t => !t.nome)) { alert('Preencha o nome das equipes!'); return; }

    const timesObj: Record<string, TimeDbSave> = {};
    times.forEach((t, i) => { const id = `time_${i + 1}`; timesObj[id] = { ...t, id, sets_vencidos: 0, total_pontos: 0, pontos_classificacao: 0 }; });

    const slug = regras.nomeCampeonato.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const codigoAleatorio = Math.random().toString(36).substring(2, 7);
    const torneioId = `${slug}-${codigoAleatorio}`;

    try {
      await set(ref(db, `torneios/${torneioId}`), { config: { status: 'aguardando_sorteio', regras: regras }, times: timesObj });
      const urlCompleta = `${window.location.origin}/torneio/${torneioId}`;
      setLinkGerado(urlCompleta);
    } catch { 
      alert('Erro ao salvar os dados no banco.'); 
    }
  };

  const copiarLink = () => { navigator.clipboard.writeText(linkGerado); alert('Link copiado!'); };
  const acessarTorneio = () => { const caminho = linkGerado.replace(window.location.origin, ''); router.push(caminho); };

  if (linkGerado) {
    return (
      <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className={styles.configPanel} style={{ textAlign: 'center', maxWidth: '600px', width: '100%', padding: '40px' }}>
          <h1 className={styles.title} style={{ fontSize: '32px', marginBottom: '10px' }}>Torneio Criado! 🎉</h1>
          <p style={{ color: '#94a3b8', fontSize: '18px', marginBottom: '30px' }}>Sua central exclusiva foi gerada. Guarde este link para compartilhar com os times e acessar a mesa.</p>
          <input type="text" readOnly value={linkGerado} className={styles.input} style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', fontSize: '16px', marginBottom: '20px' }} />
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 className={styles.title} style={{ margin: 0 }}>Equipes ({times.length})</h2><button onClick={adicionarTime} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>+ Adicionar Equipe</button></div>
      <div className={styles.grid}>
        {times.map((time, index) => (
          <div key={index} className={styles.card} style={{ position: 'relative' }}>
            {times.length > 3 && <button onClick={() => removerTime(index)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>}
            <h3>Time {index + 1}</h3>
            <div className={styles.configItem}><label>Nome:</label><input type="text" className={styles.input} value={time.nome} onChange={(e) => handleTimeChange(index, 'nome', e.target.value)} /></div>
            {regras.mostrarLogos && <div className={styles.configItem}><label>Logo:</label><input type="file" accept="image/*" className={styles.input} onChange={(e) => handleImageUpload(index, e)} /></div>}
          </div>
        ))}
      </div>
      <button onClick={salvarSetup} className={styles.btnPrimary} style={{ marginTop: '20px' }}>Criar Campeonato Exclusivo</button>
    </div>
  );
}